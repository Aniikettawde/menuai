// src/app/api/whatsapp/campaigns/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lookupTemplate, parseMetaTemplateVariables } from '@/lib/whatsapp/metaApi';
import { getAudienceRecipients } from '@/lib/whatsapp/audience';

const MAX_RECIPIENTS_PER_CAMPAIGN = 20000; // Dinezy-wide, not per-restaurant — much higher cap

// GET — list only Dinezy's own (restaurant_id null) campaigns, never a restaurant's.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('*')
    .is('restaurant_id', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const {
      name,
      templateName,
      languageCode,
      headerVariable,
      bodyVariables, // (string | "__CUSTOMER_NAME__")[]
      audienceFilter, // { restaurantId?: string; sinceDays?: number }
    } = await req.json();

    if (!name?.trim() || !templateName) {
      return NextResponse.json({ error: 'name and templateName are required' }, { status: 400 });
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    if (!phoneNumberId || !token || !wabaId) {
      return NextResponse.json({ error: 'Dinezy WhatsApp env vars not configured' }, { status: 500 });
    }

    const lookup = await lookupTemplate(wabaId, token, templateName, languageCode);
    if (!lookup.ok) return NextResponse.json({ error: lookup.error, details: lookup.details }, { status: lookup.status });
    const template = lookup.template;

    if (template.status !== 'APPROVED') {
      return NextResponse.json({ error: `Template "${templateName}" is ${template.status} — not deliverable yet.` }, { status: 409 });
    }

    const { headerFormat, headerVariableCount, bodyVariableCount } = parseMetaTemplateVariables(template.components);

    const providedBodyVars: string[] = Array.isArray(bodyVariables) ? bodyVariables : [];
    if (providedBodyVars.length !== bodyVariableCount) {
      return NextResponse.json(
        { error: `Template body expects ${bodyVariableCount} variable(s), got ${providedBodyVars.length}.` },
        { status: 400 }
      );
    }
    if (headerFormat === 'TEXT' && headerVariableCount > 0 && !String(headerVariable || '').trim()) {
      return NextResponse.json({ error: 'Template header needs a value.' }, { status: 400 });
    }
    if (providedBodyVars.some((v) => v !== '__CUSTOMER_NAME__' && !String(v).trim())) {
      return NextResponse.json({ error: 'Every body variable must have a value, or be set to use the customer name.' }, { status: 400 });
    }

    // Build the audience — restaurant-scoped (via restaurant_customers) or
    // Dinezy-wide global list, both resolved through the same helper used
    // by preview-count, so this number always matches what was previewed.
    let recipients;
    try {
      recipients = await getAudienceRecipients({
        restaurantId: audienceFilter?.restaurantId || null,
        sinceDays: audienceFilter?.sinceDays || undefined,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Failed to resolve audience' }, { status: 500 });
    }

    if (recipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      recipients = recipients.slice(0, MAX_RECIPIENTS_PER_CAMPAIGN);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No contacts match this audience filter' }, { status: 400 });
    }

    const { data: campaign, error: campaignErr } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .insert({
        restaurant_id: null, // this is a Dinezy-run send, even when the audience is restaurant-scoped
        name: name.trim(),
        template_name: template.name,
        template_language: template.language,
        header_variable: headerFormat === 'TEXT' ? headerVariable ?? null : null,
        body_variables: providedBodyVars,
        audience_filter: audienceFilter || {},
        status: 'queued',
        total_recipients: recipients.length,
        estimated_cost: 0, // Dinezy's own sends aren't billed to a restaurant
      })
      .select()
      .single();

    if (campaignErr) return NextResponse.json({ error: campaignErr.message }, { status: 500 });

    const CHUNK = 500;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const { error: recErr } = await supabaseAdmin.from('whatsapp_campaign_recipients').insert(
        recipients.slice(i, i + CHUNK).map((r) => ({
          campaign_id: campaign.id,
          restaurant_id: null,
          wa_id: r.wa_id,
          name: r.name,
        }))
      );
      if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create campaign' }, { status: 500 });
  }
}