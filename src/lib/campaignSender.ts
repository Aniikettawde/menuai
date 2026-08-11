// src/lib/campaignSender.ts
// Platform (Dinezy) campaign batch sender — env credentials + platform_whatsapp_* tables only.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lookupTemplate, sendTemplateMessage, parseMetaTemplateVariables } from '@/lib/whatsapp/metaApi';

const BATCH_SIZE = 20; // stays well under Meta's per-second template send limits

function platformCredentials():
  | { phoneNumberId: string; token: string; wabaId: string }
  | { error: string } {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!phoneNumberId || !token || !wabaId) return { error: 'Dinezy WhatsApp env vars not configured' };
  return { phoneNumberId, token, wabaId };
}

export async function processCampaignBatch(campaignId: string) {
  const { data: campaign, error: campaignErr } = await supabaseAdmin
    .from('platform_whatsapp_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignErr || !campaign) return { campaignId, error: campaignErr?.message || 'Campaign not found' };
  if (campaign.status === 'completed') return { campaignId, done: true, campaign };
  if (!['queued', 'sending'].includes(campaign.status)) {
    return { campaignId, skipped: true, status: campaign.status };
  }

  const contextRestaurantId: string | null =
    campaign.context_restaurant_id ??
    (campaign.audience_filter as any)?.restaurantId ??
    null;

  const creds = platformCredentials();
  if ('error' in creds) {
    await supabaseAdmin
      .from('platform_whatsapp_campaigns')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', campaignId);
    return { campaignId, error: creds.error };
  }

  const lookup = await lookupTemplate(
    creds.wabaId,
    creds.token,
    campaign.template_name,
    campaign.template_language
  );
  if (!lookup.ok) {
    await supabaseAdmin
      .from('platform_whatsapp_campaigns')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', campaignId);
    return { campaignId, error: lookup.error };
  }
  const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(
    lookup.template.components
  );

  if (campaign.status === 'queued') {
    await supabaseAdmin
      .from('platform_whatsapp_campaigns')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', campaignId);
  }

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('platform_whatsapp_campaign_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .or('status.is.null,status.eq.pending')
    .limit(BATCH_SIZE);

  if (batchErr) return { campaignId, error: batchErr.message };

  let sentInBatch = 0;
  let failedInBatch = 0;

  for (const r of batch ?? []) {
    const bodyVars: string[] = Array.isArray(campaign.body_variables)
      ? campaign.body_variables.map((v: string) => (v === '__CUSTOMER_NAME__' ? r.name || r.wa_id : v))
      : [];

    const result = await sendTemplateMessage({
      phoneNumberId: creds.phoneNumberId,
      token: creds.token,
      to: r.wa_id,
      templateName: campaign.template_name,
      languageCode: campaign.template_language,
      headerVariable: campaign.header_variable ?? undefined,
      headerFormat,
      headerVariableCount,
      bodyVariableCount,
      bodyVariables: bodyVars,
    });

    if (result.ok) {
      await supabaseAdmin
        .from('platform_whatsapp_campaign_recipients')
        .update({ status: 'sent', wamid: result.wamid, sent_at: new Date().toISOString() })
        .eq('id', r.id);

      const { error: msgErr } = await supabaseAdmin.from('platform_whatsapp_messages').insert({
        campaign_id: campaign.id,
        wa_id: r.wa_id,
        wamid: result.wamid,
        direction: 'outbound',
        message_type: 'template',
        body: `[Campaign: ${campaign.name}]`,
        status: 'sent',
        cost: 0,
        context_restaurant_id: contextRestaurantId,
      });

      if (msgErr) {
        console.error(`Failed to insert platform_whatsapp_messages for wamid ${result.wamid}:`, msgErr);
      }

      await supabaseAdmin.from('platform_whatsapp_contacts').upsert(
        {
          wa_id: r.wa_id,
          last_message_at: new Date().toISOString(),
          last_message_preview: `[Campaign: ${campaign.name}]`.slice(0, 120),
        },
        { onConflict: 'wa_id' }
      );

      sentInBatch += 1;
    } else {
      await supabaseAdmin
        .from('platform_whatsapp_campaign_recipients')
        .update({ status: 'failed', error_message: result.error.slice(0, 300) })
        .eq('id', r.id);
      failedInBatch += 1;
    }
  }

  const { count: remaining } = await supabaseAdmin
    .from('platform_whatsapp_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .or('status.is.null,status.eq.pending');

  const isDone = !remaining || remaining === 0;

  const { data: updated } = await supabaseAdmin
    .from('platform_whatsapp_campaigns')
    .update({
      sent_count: campaign.sent_count + sentInBatch,
      failed_count: campaign.failed_count + failedInBatch,
      actual_cost: campaign.actual_cost || 0,
      status: isDone ? 'completed' : 'sending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  return { campaignId, batchSent: sentInBatch, batchFailed: failedInBatch, done: isDone, campaign: updated };
}
