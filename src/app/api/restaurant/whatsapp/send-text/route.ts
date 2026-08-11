// src/app/api/restaurant/whatsapp/send-message/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRestaurantAccess } from '@/lib/restaurant-access'
import { parseMetaTemplateVariables, type MetaTemplateComponent } from '@/lib/whatsapp/templateValidation'

const GRAPH_VERSION = 'v21.0'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
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

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const data = await res.json()

  if (!res.ok) return { ok: false, status: res.status, error: data?.error?.message || 'Meta API error', details: data }

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
        error: `Template "${name}" doesn't have a "${languageCode}" version. Available languages: ${matches.map((m) => m.language).join(', ')}.`,
      }
    }
    return { ok: true, template: matches[0] }
  }

  if (matches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: `Template "${name}" has multiple language versions (${matches.map((m) => m.language).join(', ')}) — specify languageCode to pick one.`,
    }
  }

  return { ok: true, template: matches[0] }
}

/** Renders the approved template's body text with the actual values that were sent,
 *  so the inbox preview/thread shows real words instead of "Template: xyz". */
function renderTemplateBody(components: MetaTemplateComponent[] | undefined, bodyVars: string[]): string {
  const bodyComponent = components?.find((c: any) => c.type === 'BODY') as any
  let text: string = bodyComponent?.text ?? ''
  bodyVars.forEach((v, i) => {
    text = text.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v)
  })
  return text
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
      return NextResponse.json({ error: 'to and templateName are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: connection, error: fetchError } = await supabase
      .from('whatsapp_connections')
      .select('phone_number_id, waba_id, access_token')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!connection?.access_token) {
      return NextResponse.json({ error: 'No WhatsApp connection found for this restaurant. Connect WhatsApp first.' }, { status: 400 })
    }

    const phoneNumberId = bodyPhoneNumberId || connection.phone_number_id
    const token = connection.access_token

    const lookup = await lookupTemplate(connection.waba_id, token, templateName, languageCode)
    if (!lookup.ok) return NextResponse.json({ error: lookup.error, details: lookup.details }, { status: lookup.status })
    const template = lookup.template

    if (template.status !== 'APPROVED') {
      const reason =
        template.status === 'REJECTED' ? 'Meta rejected it, so it cannot be delivered.'
        : template.status === 'PENDING' ? 'it is still awaiting Meta review.'
        : `its status is ${template.status}.`
      return NextResponse.json({ error: `Template "${templateName}" is not approved — ${reason}` }, { status: 409 })
    }

    const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(template.components)

    const providedVars: string[] = Array.isArray(variables) ? variables : []
    if (providedVars.length !== bodyVariableCount) {
      return NextResponse.json(
        { error: `Template "${templateName}" body expects ${bodyVariableCount} variable${bodyVariableCount === 1 ? '' : 's'}, but ${providedVars.length} ${providedVars.length === 1 ? 'was' : 'were'} provided.` },
        { status: 400 }
      )
    }
    if (providedVars.some((v) => v === undefined || v === null || !String(v).trim())) {
      return NextResponse.json({ error: `Template "${templateName}" body variables cannot be blank.` }, { status: 400 })
    }
    if (headerFormat === 'TEXT' && headerVariableCount > 0 && !String(headerVariable || '').trim()) {
      return NextResponse.json({ error: `Template "${templateName}" has a header variable that needs a value (headerVariable).` }, { status: 400 })
    }

    const cleanTo = String(to).replace(/[^\d]/g, '')
    if (cleanTo.length < 7) {
      return NextResponse.json({ error: 'Recipient phone number looks invalid.' }, { status: 400 })
    }

    const components: Record<string, unknown>[] = []
    if (headerFormat === 'TEXT' && headerVariableCount > 0) {
      components.push({ type: 'header', parameters: [{ type: 'text', text: String(headerVariable) }] })
    }
    if (bodyVariableCount > 0) {
      components.push({ type: 'body', parameters: providedVars.map((v) => ({ type: 'text', text: v })) })
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language },
        ...(components.length > 0 ? { components } : {}),
      },
    }

    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message || 'Meta API error', details: data }, { status: res.status })
    }

    // ── NEW: record this outbound send so it shows up in the restaurant's inbox
    // immediately, instead of only appearing once/if the customer replies. ──
    const wamid = data?.messages?.[0]?.id ?? null
    const bodyPreview = renderTemplateBody(template.components, providedVars).slice(0, 120)

    const { data: existingContact } = await supabase
      .from('whatsapp_contacts')
      .select('unread_count')
      .eq('restaurant_id', restaurantId)
      .eq('wa_id', cleanTo)
      .maybeSingle()

    await supabase.from('whatsapp_contacts').upsert(
      {
        restaurant_id: restaurantId,
        wa_id: cleanTo,
        last_message_at: new Date().toISOString(),
        last_message_preview: bodyPreview || `Template: ${template.name}`,
        unread_count: existingContact?.unread_count ?? 0, // sending doesn't create unread mail
      },
      { onConflict: 'restaurant_id,wa_id' }
    )

    await supabase.from('whatsapp_messages').insert({
      restaurant_id: restaurantId,
      wa_id: cleanTo,
      wamid,
      direction: 'outbound',
      message_type: 'template',
      body: bodyPreview || `Template: ${template.name}`,
      status: 'sent',
    })

    return NextResponse.json({ success: true, result: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}