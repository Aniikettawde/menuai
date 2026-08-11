// src/app/api/restaurant/whatsapp/send-message/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRestaurantAccess } from '@/lib/restaurant-access'
import { parseMetaTemplateVariables, type MetaTemplateComponent } from '@/lib/whatsapp/templateValidation'

const GRAPH_VERSION = 'v21.0'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

type MetaTemplateMatch = {
  name: string
  status: string
  language: string
  category?: string
  components?: MetaTemplateComponent[]
}

type TemplateLookupResult =
  | { ok: true; template: MetaTemplateMatch }
  | { ok: false; status: number; error: string; details?: unknown }

/**
 * Fetches the *live* template definition from Meta before we ever try to send
 * with it. We never trust a name/language/variable-count the caller supplies —
 * the template could have been edited, resubmitted, or rejected since the
 * frontend last loaded its list, and sending against a stale assumption is
 * exactly what produces Meta's opaque "parameter count mismatch" / "template
 * does not exist" errors at delivery time instead of at request time.
 */
async function lookupTemplate(
  wabaId: string,
  token: string,
  name: string,
  languageCode?: string
): Promise<TemplateLookupResult> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`)
  url.searchParams.set('fields', 'name,status,language,category,components')
  url.searchParams.set('name', name)
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json()

  if (!res.ok) {
    return { ok: false, status: res.status, error: data?.error?.message || 'Meta API error', details: data }
  }

  const matches = (data?.data ?? []) as MetaTemplateMatch[]
  if (matches.length === 0) {
    return { ok: false, status: 404, error: `No template named "${name}" exists on this WhatsApp Business Account.` }
  }

  if (languageCode) {
    const exact = matches.find((m) => m.language === languageCode)
    if (exact) return { ok: true, template: exact }
    if (matches.length > 1) {
      return {
        ok: false,
        status: 409,
        error: `Template "${name}" doesn't have a "${languageCode}" version. Available languages: ${matches
          .map((m) => m.language)
          .join(', ')}.`,
      }
    }
    // Only one language variant exists and it didn't match — still usable,
    // but tell the caller so they can correct their languageCode next time.
    return { ok: true, template: matches[0] }
  }

  if (matches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: `Template "${name}" has multiple language versions (${matches
        .map((m) => m.language)
        .join(', ')}) — specify languageCode to pick one.`,
    }
  }

  return { ok: true, template: matches[0] }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const auth = await requireRestaurantAccess(req, body.restaurantId)
    if (!auth.ok) return auth.response

    const restaurantId = auth.restaurantId
    const {
      to,
      templateName,
      languageCode,
      variables,
      headerVariable,
      phoneNumberId: bodyPhoneNumberId,
    } = body

    if (!to || !templateName) {
      return NextResponse.json(
        { error: 'to and templateName are required' },
        { status: 400 }
      )
    }

    // IMPORTANT: each restaurant's messages must go out using THAT restaurant's own access
    // token, obtained when they completed Embedded Signup — never the shared
    // WHATSAPP_ACCESS_TOKEN env var, which belongs to Dinezy's own WABA and has zero
    // permission on a restaurant's WABA/phone number. Using the wrong token is what produces
    // Meta's "Object with ID ... does not exist, cannot be loaded due to missing permissions"
    // error, since Meta is correctly refusing to let one business's token act on another's assets.
    const supabase = getSupabaseAdmin()
    const { data: connection, error: fetchError } = await supabase
      .from('whatsapp_connections')
      .select('phone_number_id, waba_id, access_token')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!connection?.access_token) {
      return NextResponse.json(
        { error: 'No WhatsApp connection found for this restaurant. Connect WhatsApp first.' },
        { status: 400 }
      )
    }

    const phoneNumberId = bodyPhoneNumberId || connection.phone_number_id
    const token = connection.access_token

    // ── Fetch and validate the live template before sending ──
    const lookup = await lookupTemplate(connection.waba_id, token, templateName, languageCode)
    if (!lookup.ok) {
      return NextResponse.json({ error: lookup.error, details: lookup.details }, { status: lookup.status })
    }
    const template = lookup.template

    if (template.status !== 'APPROVED') {
      const reason =
        template.status === 'REJECTED'
          ? 'Meta rejected it, so it cannot be delivered.'
          : template.status === 'PENDING'
            ? 'it is still awaiting Meta review.'
            : `its status is ${template.status}.`
      return NextResponse.json(
        { error: `Template "${templateName}" is not approved — ${reason}` },
        { status: 409 }
      )
    }

    const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(
      template.components
    )

    const providedVars: string[] = Array.isArray(variables) ? variables : []
    if (providedVars.length !== bodyVariableCount) {
      return NextResponse.json(
        {
          error: `Template "${templateName}" body expects ${bodyVariableCount} variable${
            bodyVariableCount === 1 ? '' : 's'
          }, but ${providedVars.length} ${providedVars.length === 1 ? 'was' : 'were'} provided.`,
        },
        { status: 400 }
      )
    }
    if (providedVars.some((v) => v === undefined || v === null || !String(v).trim())) {
      return NextResponse.json(
        { error: `Template "${templateName}" body variables cannot be blank.` },
        { status: 400 }
      )
    }

    if (headerFormat === 'TEXT' && headerVariableCount > 0 && !String(headerVariable || '').trim()) {
      return NextResponse.json(
        { error: `Template "${templateName}" has a header variable that needs a value (headerVariable).` },
        { status: 400 }
      )
    }

    // Normalize recipient to digits only, Meta expects no + or spaces
    const cleanTo = String(to).replace(/[^\d]/g, '')
    if (cleanTo.length < 7) {
      return NextResponse.json({ error: 'Recipient phone number looks invalid.' }, { status: 400 })
    }

    const components: Record<string, unknown>[] = []
    if (headerFormat === 'TEXT' && headerVariableCount > 0) {
      components.push({
        type: 'header',
        parameters: [{ type: 'text', text: String(headerVariable) }],
      })
    }
    if (bodyVariableCount > 0) {
      components.push({
        type: 'body',
        parameters: providedVars.map((v) => ({ type: 'text', text: v })),
      })
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: {
        name: template.name,
        // Use the language Meta actually has this template stored under —
        // not necessarily whatever the caller passed in.
        language: { code: template.language },
        ...(components.length > 0 ? { components } : {}),
      },
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Meta API error', details: data },
        { status: res.status }
      )
    }

    // data typically: { messaging_product, contacts: [...], messages: [{ id: "wamid...." }] }
    return NextResponse.json({ success: true, result: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}