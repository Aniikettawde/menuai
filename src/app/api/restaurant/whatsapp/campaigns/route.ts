// src/app/api/restaurant/whatsapp/campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lookupTemplate, parseMetaTemplateVariables } from '@/lib/whatsapp/metaApi'
import { requireRestaurantAccess } from '@/lib/restaurant-access'

const MAX_RECIPIENTS_PER_CAMPAIGN = 500

function cleanPhone(raw: string): string | null {
  const digits = String(raw).replace(/[^\d]/g, '')
  return digits.length >= 10 ? digits : null
}

export async function GET(req: NextRequest) {
  const auth = await requireRestaurantAccess(req, req.nextUrl.searchParams.get('restaurantId'))
  if (!auth.ok) return auth.response

  const restaurantId = auth.restaurantId

  const { data, error } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const auth = await requireRestaurantAccess(req, body.restaurantId)
    if (!auth.ok) return auth.response

    const restaurantId = auth.restaurantId
    const {
      name,
      templateName,
      languageCode,
      headerVariable,
      bodyVariables, // (string | "__CUSTOMER_NAME__")[]
      recipients, // { wa_id: string; name?: string }[]
    } = body

    if (!name?.trim() || !templateName || !Array.isArray(recipients)) {
      return NextResponse.json(
        { error: 'name, templateName, and recipients[] are required' },
        { status: 400 }
      )
    }

    // ── Validation: dedupe + clean recipient numbers ──
    const seen = new Set<string>()
    const cleanRecipients: { wa_id: string; name: string | null }[] = []
    const invalidNumbers: string[] = []

    for (const r of recipients) {
      const cleaned = cleanPhone(r.wa_id)
      if (!cleaned) {
        invalidNumbers.push(String(r.wa_id))
        continue
      }
      if (seen.has(cleaned)) continue
      seen.add(cleaned)
      cleanRecipients.push({ wa_id: cleaned, name: r.name || null })
    }

    if (cleanRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipients after validation.', invalidNumbers },
        { status: 400 }
      )
    }

    if (cleanRecipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      return NextResponse.json(
        {
          error: `A single campaign can send to at most ${MAX_RECIPIENTS_PER_CAMPAIGN} recipients. You provided ${cleanRecipients.length} — split into multiple campaigns.`,
        },
        { status: 400 }
      )
    }

    // ── Fetch connection + validate template is live-approved on Meta ──
    const { data: connection, error: connErr } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('waba_id, access_token')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })
    if (!connection?.access_token) {
      return NextResponse.json({ error: 'No WhatsApp connection found for this restaurant.' }, { status: 400 })
    }

    const lookup = await lookupTemplate(connection.waba_id, connection.access_token, templateName, languageCode)
    if (!lookup.ok) return NextResponse.json({ error: lookup.error, details: lookup.details }, { status: lookup.status })
    const template = lookup.template

    if (template.status !== 'APPROVED') {
      return NextResponse.json({ error: `Template "${templateName}" is ${template.status} — not deliverable yet.` }, { status: 409 })
    }

    const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(template.components)

    const providedBodyVars: string[] = Array.isArray(bodyVariables) ? bodyVariables : []
    if (providedBodyVars.length !== bodyVariableCount) {
      return NextResponse.json(
        { error: `Template body expects ${bodyVariableCount} variable(s), got ${providedBodyVars.length}.` },
        { status: 400 }
      )
    }
    if (headerFormat === 'TEXT' && headerVariableCount > 0 && !String(headerVariable || '').trim()) {
      return NextResponse.json({ error: 'Template header needs a value (headerVariable).' }, { status: 400 })
    }
    // Every literal (non-personalized) variable must be non-blank; "__CUSTOMER_NAME__" is filled in at send time.
    if (providedBodyVars.some((v) => v !== '__CUSTOMER_NAME__' && !String(v).trim())) {
      return NextResponse.json({ error: 'Every body variable must have a value, or be set to use the customer name.' }, { status: 400 })
    }

    // ── Credit balance check ──
    const category = (template.category || 'MARKETING').toUpperCase()
    const { data: billing } = await supabaseAdmin
      .from('whatsapp_billing')
      .select('credit_balance, cost_per_marketing_message, cost_per_utility_message')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (!billing) {
      return NextResponse.json({ error: 'No billing profile set up for this restaurant yet.' }, { status: 402 })
    }

    const costPerMessage = category === 'UTILITY' ? billing.cost_per_utility_message : billing.cost_per_marketing_message
    const estimatedCost = costPerMessage * cleanRecipients.length

    if (billing.credit_balance < estimatedCost) {
      const affordable = Math.floor(billing.credit_balance / costPerMessage)
      return NextResponse.json(
        {
          error: `Insufficient credits. This campaign needs ₹${estimatedCost.toFixed(2)} (₹${costPerMessage} × ${cleanRecipients.length}), but only ₹${billing.credit_balance} available — enough for ${affordable} recipients. Recharge or reduce the recipient list.`,
          code: 'INSUFFICIENT_CREDITS',
        },
        { status: 402 }
      )
    }

    // ── Create campaign + recipient rows ──
    const { data: campaign, error: campaignErr } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .insert({
        restaurant_id: restaurantId,
        name: name.trim(),
        template_name: template.name,
        template_language: template.language,
        header_variable: headerFormat === 'TEXT' ? headerVariable ?? null : null,
        body_variables: providedBodyVars,
        status: 'queued',
        total_recipients: cleanRecipients.length,
        estimated_cost: estimatedCost,
      })
      .select()
      .single()

    if (campaignErr) return NextResponse.json({ error: campaignErr.message }, { status: 500 })

    const { error: recipientsErr } = await supabaseAdmin.from('whatsapp_campaign_recipients').insert(
      cleanRecipients.map((r) => ({
        campaign_id: campaign.id,
        restaurant_id: restaurantId,
        wa_id: r.wa_id,
        name: r.name,
      }))
    )

    if (recipientsErr) return NextResponse.json({ error: recipientsErr.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      campaign,
      invalidNumbers: invalidNumbers.length > 0 ? invalidNumbers : undefined,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}