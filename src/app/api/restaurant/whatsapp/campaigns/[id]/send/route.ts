// src/app/api/restaurant/whatsapp/campaigns/[id]/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lookupTemplate, parseMetaTemplateVariables, renderTemplateBody, sendTemplateMessage } from '@/lib/whatsapp/metaApi'

const BATCH_SIZE = 20
const DELAY_BETWEEN_SENDS_MS = 200

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { restaurantId } = await req.json()
    if (!restaurantId) return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })

    const { data: campaign, error: campaignErr } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (campaignErr) return NextResponse.json({ error: campaignErr.message }, { status: 500 })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      return NextResponse.json({ done: true, campaign })
    }

    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('phone_number_id, waba_id, access_token')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (!connection?.access_token) {
      return NextResponse.json({ error: 'No WhatsApp connection for this restaurant.' }, { status: 400 })
    }

    const lookup = await lookupTemplate(connection.waba_id, connection.access_token, campaign.template_name, campaign.template_language)
    if (!lookup.ok) {
      return NextResponse.json({ error: `Template lookup failed mid-campaign: ${lookup.error}` }, { status: lookup.status })
    }
    const template = lookup.template
    const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(template.components)
    const category = (template.category || 'MARKETING').toUpperCase()

    const { data: billing } = await supabaseAdmin
      .from('whatsapp_billing')
      .select('cost_per_marketing_message, cost_per_utility_message')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    const costPerMessage = category === 'UTILITY' ? (billing?.cost_per_utility_message ?? 0.3) : (billing?.cost_per_marketing_message ?? 1.2)

    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('whatsapp_campaign_recipients')
      .select('id, wa_id, name')
      .eq('campaign_id', params.id)
      .eq('status', 'pending')
      .limit(BATCH_SIZE)

    if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 })

    if (!batch || batch.length === 0) {
      await supabaseAdmin.from('whatsapp_campaigns').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', params.id)
      const { data: finalCampaign } = await supabaseAdmin.from('whatsapp_campaigns').select('*').eq('id', params.id).single()
      return NextResponse.json({ done: true, processed: 0, campaign: finalCampaign })
    }

    await supabaseAdmin.from('whatsapp_campaigns').update({ status: 'sending' }).eq('id', params.id).eq('status', 'queued')

    let sentInBatch = 0
    let failedInBatch = 0
    let costSpent = 0
    let outOfCredits = false

    for (const recipient of batch) {
      if (outOfCredits) break

      const { data: debited } = await supabaseAdmin.rpc('debit_whatsapp_credits', {
        p_restaurant_id: restaurantId,
        p_amount: costPerMessage,
        p_reason: `Campaign: ${campaign.name} → ${recipient.wa_id}`,
      })

      if (!debited) {
        outOfCredits = true
        break
      }

      const bodyVars: string[] = (campaign.body_variables || []).map((v: string) =>
        v === '__CUSTOMER_NAME__' ? recipient.name || 'there' : v
      )

      const sendResult = await sendTemplateMessage({
        phoneNumberId: connection.phone_number_id,
        token: connection.access_token,
        to: recipient.wa_id,
        templateName: template.name,
        languageCode: template.language,
        headerVariable: campaign.header_variable ?? undefined,
        headerFormat,
        headerVariableCount,
        bodyVariableCount,
        bodyVariables: bodyVars,
      })

      if (!sendResult.ok) {
        failedInBatch += 1
        await supabaseAdmin
          .from('whatsapp_campaign_recipients')
          .update({ status: 'failed', error_message: sendResult.error })
          .eq('id', recipient.id)
        // Refund the credit since Meta never charged for a failed send.
        await supabaseAdmin.rpc('debit_whatsapp_credits', {
          p_restaurant_id: restaurantId,
          p_amount: -costPerMessage,
          p_reason: `Refund: failed send to ${recipient.wa_id}`,
        })
      } else {
        sentInBatch += 1
        costSpent += costPerMessage
        const bodyPreview = renderTemplateBody(template.components, bodyVars).slice(0, 120)

        await supabaseAdmin
          .from('whatsapp_campaign_recipients')
          .update({ status: 'sent', wamid: sendResult.wamid, sent_at: new Date().toISOString() })
          .eq('id', recipient.id)

        await supabaseAdmin.from('whatsapp_messages').insert({
          restaurant_id: restaurantId,
          wa_id: recipient.wa_id,
          wamid: sendResult.wamid,
          direction: 'outbound',
          message_type: 'template',
          body: bodyPreview || `Template: ${template.name}`,
          status: 'sent',
          campaign_id: params.id,
          cost: costPerMessage,
        })

        const { data: existingContact } = await supabaseAdmin
          .from('whatsapp_contacts')
          .select('unread_count')
          .eq('restaurant_id', restaurantId)
          .eq('wa_id', recipient.wa_id)
          .maybeSingle()

        await supabaseAdmin.from('whatsapp_contacts').upsert(
          {
            restaurant_id: restaurantId,
            wa_id: recipient.wa_id,
            name: recipient.name,
            last_message_at: new Date().toISOString(),
            last_message_preview: bodyPreview || `Template: ${template.name}`,
            unread_count: existingContact?.unread_count ?? 0,
          },
          { onConflict: 'restaurant_id,wa_id' }
        )
      }

      await sleep(DELAY_BETWEEN_SENDS_MS)
    }

    if (outOfCredits) {
      await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .update({ status: 'failed', error_message: 'Insufficient credits — recharge to resume this campaign.' })
        .eq('campaign_id', params.id)
        .eq('status', 'pending')
    }

    const { count: remainingPending } = await supabaseAdmin
      .from('whatsapp_campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', params.id)
      .eq('status', 'pending')

    const { data: updatedCampaign } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .select('sent_count, failed_count, actual_cost')
      .eq('id', params.id)
      .single()

    await supabaseAdmin
      .from('whatsapp_campaigns')
      .update({
        sent_count: (updatedCampaign?.sent_count ?? 0) + sentInBatch,
        failed_count: (updatedCampaign?.failed_count ?? 0) + failedInBatch,
        actual_cost: (updatedCampaign?.actual_cost ?? 0) + costSpent,
        status: (remainingPending ?? 0) > 0 ? 'sending' : 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    const { data: finalCampaign } = await supabaseAdmin.from('whatsapp_campaigns').select('*').eq('id', params.id).single()

    return NextResponse.json({
      done: (remainingPending ?? 0) === 0,
      processed: batch.length,
      outOfCredits,
      campaign: finalCampaign,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}