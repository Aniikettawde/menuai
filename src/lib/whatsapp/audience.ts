// src/lib/whatsapp/audience.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface AudienceFilter {
  restaurantId?: string | null;
  sinceDays?: number;
}

export interface AudienceRecipient {
  wa_id: string;
  name: string | null;
}

function cleanPhone(raw: string): string | null {
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits.length >= 10 ? digits : null;
}

/**
 * Resolves the actual recipient list for a campaign audience filter.
 *
 * - No restaurantId  => Dinezy-wide global contact list (platform_whatsapp_contacts),
 *                        same as before.
 * - restaurantId set  => customers who've visited that restaurant, sourced from
 *                        restaurant_customers (the visit-tracking table), respecting
 *                        each row's marketing_consent AND cross-checked against the
 *                        global opt-out list so a restaurant-specific send never
 *                        messages someone who unsubscribed via the global WhatsApp inbox.
 *
 * Both preview-count and campaign creation call this same function, so the number
 * shown in the UI before sending always matches who actually gets messaged.
 */
export async function getAudienceRecipients(filter: AudienceFilter): Promise<AudienceRecipient[]> {
  if (!filter.restaurantId) {
    let query = supabaseAdmin
      .from('platform_whatsapp_contacts')
      .select('wa_id, name')
      .eq('opted_out', false);

    if (filter.sinceDays) {
      const since = new Date(Date.now() - filter.sinceDays * 86400000).toISOString();
      query = query.gte('last_message_at', since);
    }

    const { data, error } = await query.limit(20000);
    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const out: AudienceRecipient[] = [];
    for (const c of data ?? []) {
      const cleaned = cleanPhone(c.wa_id);
      if (!cleaned || seen.has(cleaned)) continue;
      seen.add(cleaned);
      out.push({ wa_id: cleaned, name: c.name });
    }
    return out;
  }

  // Restaurant-scoped audience — restaurant_customers is the source of truth.
  // Two separate queries instead of an embedded customers ( phone, display_name )
  // join — see the comment in getRestaurantAudienceOptions for why.
  let rcQuery = supabaseAdmin
    .from('restaurant_customers')
    .select('customer_id, last_visit_at, marketing_consent')
    .eq('restaurant_id', filter.restaurantId)
    .eq('marketing_consent', true);

  if (filter.sinceDays) {
    const since = new Date(Date.now() - filter.sinceDays * 86400000).toISOString();
    rcQuery = rcQuery.gte('last_visit_at', since);
  }

  const { data: rcRows, error: rcErr } = await rcQuery.limit(20000);
  if (rcErr) throw new Error(rcErr.message);

  const customerIds = [...new Set((rcRows ?? []).map((r) => r.customer_id as string))];
  if (customerIds.length === 0) return [];

  const { data: customerRows, error: custErr } = await supabaseAdmin
    .from('customers')
    .select('id, phone, display_name')
    .in('id', customerIds);

  if (custErr) throw new Error(custErr.message);

  const phoneById = new Map(
    (customerRows ?? []).map((c) => [c.id as string, { phone: c.phone as string, name: c.display_name as string | null }]),
  );

  const seen = new Set<string>();
  const candidates: AudienceRecipient[] = [];
  for (const cid of customerIds) {
    const cust = phoneById.get(cid);
    if (!cust?.phone) continue;
    const cleaned = cleanPhone(cust.phone);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    candidates.push({ wa_id: cleaned, name: cust.name });
  }

  if (candidates.length === 0) return [];

  // Cross-check against the global opt-out list (platform_whatsapp_contacts)
  const { data: optOutRows, error: optErr } = await supabaseAdmin
    .from('platform_whatsapp_contacts')
    .select('wa_id')
    .eq('opted_out', true)
    .in(
      'wa_id',
      candidates.map((c) => c.wa_id),
    );

  if (optErr) throw new Error(optErr.message);

  const optedOut = new Set((optOutRows ?? []).map((r) => r.wa_id as string));
  return candidates.filter((c) => !optedOut.has(c.wa_id));
}

/**
 * Restaurant options for the campaign "Audience" dropdown — id, name, and how
 * many of their customers currently have marketing consent. This count is a
 * slight over-estimate (shown only as a UI hint before the global opt-out
 * cross-check runs) — the real number comes from getAudienceRecipients / the
 * preview-count endpoint.
 */
export async function getRestaurantAudienceOptions(): Promise<
  { id: string; name: string; count: number }[]
> {
  // Two separate queries instead of an embedded join (restaurant_customers.restaurant_id
  // -> restaurants.id). The embed depends on PostgREST's cached relationship graph, which
  // can silently return an empty/broken embed after a schema change even when the raw SQL
  // join works fine and a manual "reload schema cache" doesn't pick it up. Doing it as two
  // plain queries + an in-memory map has no such dependency.
  const { data: rcRows, error: rcErr } = await supabaseAdmin
    .from('restaurant_customers')
    .select('restaurant_id')
    .eq('marketing_consent', true);

  if (rcErr) throw new Error(rcErr.message);

  const counts = new Map<string, number>();
  for (const row of rcRows ?? []) {
    const rid = row.restaurant_id as string;
    counts.set(rid, (counts.get(rid) ?? 0) + 1);
  }

  const restaurantIds = [...counts.keys()];
  if (restaurantIds.length === 0) return [];

  const { data: restaurantRows, error: restErr } = await supabaseAdmin
    .from('restaurants')
    .select('id, name')
    .in('id', restaurantIds);

  if (restErr) throw new Error(restErr.message);

  const nameById = new Map((restaurantRows ?? []).map((r) => [r.id as string, r.name as string]));

  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: nameById.get(id) ?? 'Unknown restaurant', count }))
    .sort((a, b) => b.count - a.count);
}