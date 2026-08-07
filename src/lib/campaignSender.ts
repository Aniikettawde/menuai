// src/lib/campaignSender.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lookupTemplate, sendTemplateMessage, parseMetaTemplateVariables } from '@/lib/whatsapp/metaApi';

const BATCH_SIZE = 20; // stays well under Meta's per-second template send limits

type Credentials = { phoneNumberId: string; token: string; wabaId: string };

async function resolveCredentials(restaurantId: string | null): Promise<Credentials | { error: string }> {
  if (restaurantId === null) {
    // Dinezy's own number — same env vars src/lib/whatsapp.ts already uses.
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    if (!phoneNumberId || !token || !wabaId) return { error: 'Dinezy WhatsApp env vars not configured' };
    return { phoneNumberId, token, wabaId };
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('phone_number_id, access_token, waba_id')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data?.access_token) return { error: 'No WhatsApp connection for this restaurant' };
  return { phoneNumberId: data.phone_number_id, token: data.access_token, wabaId: data.waba_id };
}

export async function processCampaignBatch(campaignId: string) {
  const { data: campaign, error: campaignErr } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignErr || !campaign) return { campaignId, error: campaignErr?.message || 'Campaign not found' };
  if (campaign.status === 'completed') return { campaignId, done: true, campaign };
  if (!['queued', 'sending'].includes(campaign.status)) {
    return { campaignId, skipped: true, status: campaign.status };
  }

  const restaurantId: string | null = campaign.restaurant_id ?? null;

  const creds = await resolveCredentials(restaurantId);
  if ('error' in creds) {
    await supabaseAdmin.from('whatsapp_campaigns').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', campaignId);
    return { campaignId, error: creds.error };
  }

  // Re-check the template is still approved and get its live shape — never
  // trust the snapshot taken when the campaign was created.
  const lookup = await lookupTemplate(creds.wabaId, creds.token, campaign.template_name, campaign.template_language);
  if (!lookup.ok) {
    await supabaseAdmin.from('whatsapp_campaigns').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', campaignId);
    return { campaignId, error: lookup.error };
  }
  const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(lookup.template.components);

  // Billing only applies to restaurant-owned campaigns. Dinezy's own global
  // sends (restaurant_id null) are free — that's Dinezy's own cost to eat.
  let creditBalance = 0;
  let perMessageCost = 0;
  if (restaurantId) {
    const { data: billing } = await supabaseAdmin
      .from('whatsapp_billing')
      .select('credit_balance')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!billing) {
      await supabaseAdmin.from('whatsapp_campaigns').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', campaignId);
      return { campaignId, error: 'No billing profile for this restaurant' };
    }
    creditBalance = billing.credit_balance;
    perMessageCost = campaign.total_recipients > 0 ? campaign.estimated_cost / campaign.total_recipients : 0;
  }

  if (campaign.status === 'queued') {
    await supabaseAdmin.from('whatsapp_campaigns').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', campaignId);
  }

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .or('status.is.null,status.eq.pending')
    .limit(BATCH_SIZE);

  if (batchErr) return { campaignId, error: batchErr.message };

  let sentInBatch = 0;
  let failedInBatch = 0;
  let spentInBatch = 0;

  for (const r of batch ?? []) {
    // Stop mid-batch if a restaurant runs out of credit — remaining recipients stay pending.
    if (restaurantId && creditBalance - spentInBatch < perMessageCost) break;

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
        .from('whatsapp_campaign_recipients')
        .update({ status: 'sent', wamid: result.wamid, sent_at: new Date().toISOString() })
        .eq('id', r.id);

     const { error: msgErr } = await supabaseAdmin.from('whatsapp_messages').insert({
   restaurant_id: restaurantId,
   campaign_id: campaign.id,
   wa_id: r.wa_id,
   wamid: result.wamid,
   direction: 'outbound',
   message_type: 'template',
   body: `[Campaign: ${campaign.name}]`,
   status: 'sent',
   cost: restaurantId ? perMessageCost : 0,
 });

if (msgErr) console.error(`Failed to insert whatsapp_messages for wamid ${result.wamid}:`, msgErr);

      await supabaseAdmin.from('whatsapp_contacts').upsert(
        {
          restaurant_id: restaurantId,
          wa_id: r.wa_id,
          last_message_at: new Date().toISOString(),
          last_message_preview: `[Campaign: ${campaign.name}]`.slice(0, 120),
        },
        { onConflict: 'restaurant_id,wa_id' }
      );

      sentInBatch += 1;
      spentInBatch += perMessageCost;
    } else {
      await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .update({ status: 'failed', error_message: result.error.slice(0, 300) })
        .eq('id', r.id);
      failedInBatch += 1;
    }
  }

  if (restaurantId && spentInBatch > 0) {
    await supabaseAdmin
      .from('whatsapp_billing')
      .update({ credit_balance: creditBalance - spentInBatch, updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId);
  }

  const { count: remaining } = await supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .or('status.is.null,status.eq.pending');

  const isDone = !remaining || remaining === 0;
  const outOfCredit = !!restaurantId && creditBalance - spentInBatch < perMessageCost && !isDone;

  const { data: updated } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .update({
      sent_count: campaign.sent_count + sentInBatch,
      failed_count: campaign.failed_count + failedInBatch,
      actual_cost: (campaign.actual_cost || 0) + spentInBatch,
      status: isDone ? 'completed' : outOfCredit ? 'insufficient_credits' : 'sending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  return { campaignId, batchSent: sentInBatch, batchFailed: failedInBatch, done: isDone, campaign: updated };
}