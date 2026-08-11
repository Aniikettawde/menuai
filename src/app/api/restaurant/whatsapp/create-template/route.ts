// src/app/api/restaurant/whatsapp/create-template/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRestaurantAccess } from '@/lib/restaurant-access'
import {
  buildMetaComponents,
  validateTemplateDraft,
  type TemplateButton,
  type TemplateCategory,
  type HeaderFormat,
  type TemplateDraft,
} from '@/lib/whatsapp/templateValidation'

const GRAPH_VERSION = 'v21.0'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

function normalizeName(raw: string) {
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 512)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const auth = await requireRestaurantAccess(req, body.restaurantId)
    if (!auth.ok) return auth.response

    const restaurantId = auth.restaurantId
    const {
      name,
      category,
      language,
      headerFormat,
      headerText,
      bodyText,
      bodySamples,
      footerText,
      buttons,
      wabaId: bodyWabaId,
    } = body as {
      name: string
      category: TemplateCategory
      language: string
      headerFormat?: HeaderFormat
      headerText?: string
      bodyText: string
      bodySamples?: string[]
      footerText?: string
      buttons?: TemplateButton[]
      restaurantId?: string
      wabaId?: string
    }

    if (!name || !category || !bodyText) {
      return NextResponse.json(
        { error: 'name, category, and bodyText are required' },
        { status: 400 }
      )
    }

    // Normalize the name the same way the validator expects it, so what we
    // validate is exactly what we submit.
    const safeName = normalizeName(name)

    const draft: TemplateDraft = {
      name: safeName,
      category,
      language: language || 'en_US',
      headerFormat: headerFormat || 'NONE',
      headerText,
      bodyText,
      bodySamples,
      footerText,
      buttons,
    }

    const validation = validateTemplateDraft(draft)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Template failed validation before it was sent to Meta.',
          fieldErrors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 422 }
      )
    }

    // Same rule as send-message: use THIS restaurant's own stored token, not the shared
    // WHATSAPP_ACCESS_TOKEN env var, which has no permission on the restaurant's WABA.
    const supabase = getSupabaseAdmin()
    const { data: connection, error: fetchError } = await supabase
      .from('whatsapp_connections')
      .select('waba_id, access_token')
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

    const wabaId = bodyWabaId || connection.waba_id
    const token = connection.access_token

    const payload = {
      name: safeName,
      category,
      language: draft.language,
      components: buildMetaComponents(draft),
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
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
      // Surface Meta's own rejection reason (e.g. content policy issues our
      // local validation can't catch) rather than a generic message.
      return NextResponse.json(
        {
          error: data?.error?.error_user_msg || data?.error?.message || 'Meta API error',
          details: data,
        },
        { status: res.status }
      )
    }

    // data typically: { id: "...", status: "PENDING", category: "..." }
    return NextResponse.json({ success: true, template: data, warnings: validation.warnings })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Optional: list existing templates so the page can show status (PENDING/APPROVED/REJECTED)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRestaurantAccess(req, req.nextUrl.searchParams.get('restaurantId'))
    if (!auth.ok) return auth.response

    const restaurantId = auth.restaurantId
    const supabase = getSupabaseAdmin()
    const { data: connection, error: fetchError } = await supabase
      .from('whatsapp_connections')
      .select('waba_id, access_token')
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

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${connection.waba_id}/message_templates?fields=name,status,category,language,rejected_reason&limit=25`,
      {
        headers: { Authorization: `Bearer ${connection.access_token}` },
        cache: 'no-store',
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Meta API error', details: data },
        { status: res.status }
      )
    }

    return NextResponse.json({ templates: data?.data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}