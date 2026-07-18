// src/app/api/restaurant/whatsapp/templates/route.ts
//
// Lists this restaurant's WhatsApp templates from Meta, with body/header
// variable counts already parsed out, so the send-message UI can build the
// right number of input fields and never let someone send a template whose
// parameter count doesn't match what Meta expects.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

export type TemplateSummary = {
  name: string
  status: string
  category: string
  language: string
  rejectedReason: string | null
  headerFormat: string
  headerVariableCount: number
  bodyVariableCount: number
}

export async function GET(req: NextRequest) {
  try {
    const restaurantId = req.nextUrl.searchParams.get('restaurantId')
    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
    }

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
      `https://graph.facebook.com/${GRAPH_VERSION}/${connection.waba_id}/message_templates?fields=name,status,category,language,components,rejected_reason&limit=100`,
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

    const raw = (data?.data ?? []) as {
      name: string
      status: string
      category: string
      language: string
      rejected_reason?: string | null
      components?: MetaTemplateComponent[]
    }[]

    const templates: TemplateSummary[] = raw.map((t) => {
      const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(t.components)
      return {
        name: t.name,
        status: t.status,
        category: t.category,
        language: t.language,
        rejectedReason: t.rejected_reason ?? null,
        headerFormat,
        headerVariableCount,
        bodyVariableCount,
      }
    })

    // "hello_world" is Meta's built-in pre-approved sample template. It's used
    // for zero-setup test sends but doesn't always show up in this account's
    // own message_templates list, so make sure it's always selectable.
    if (!templates.some((t) => t.name === 'hello_world')) {
      templates.unshift({
        name: 'hello_world',
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'en_US',
        rejectedReason: null,
        headerFormat: 'NONE',
        headerVariableCount: 0,
        bodyVariableCount: 0,
      })
    }

    return NextResponse.json({ templates })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}