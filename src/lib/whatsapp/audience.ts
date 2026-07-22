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
 * - No restaurantId  => Dinezy-wide global contact list (whatsapp_contacts, restaurant_id null),
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
      .from('whatsapp_contacts')
      .select('wa_id, name')
      .is('restaurant_id', null)
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

  // Restaurant-scoped audience — restaurant_customers is the source of truth
  let rcQuery = supabaseAdmin
    .from('restaurant_customers')
    .select('customer_id, last_visit_at, marketing_consent, customers ( phone, display_name )')
    .eq('restaurant_id', filter.restaurantId)
    .eq('marketing_consent', true);

  if (filter.sinceDays) {
    const since = new Date(Date.now() - filter.sinceDays * 86400000).toISOString();
    rcQuery = rcQuery.gte('last_visit_at', since);
  }

  const { data: rcRows, error: rcErr } = await rcQuery.limit(20000);
  if (rcErr) throw new Error(rcErr.message);

  const seen = new Set<string>();
  const candidates: AudienceRecipient[] = [];
  for (const row of rcRows ?? []) {
    const cust = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const phone = (cust as { phone?: string } | null)?.phone;
    const displayName = (cust as { display_name?: string | null } | null)?.display_name ?? null;
    if (!phone) continue;
    const cleaned = cleanPhone(phone);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    candidates.push({ wa_id: cleaned, name: displayName });
  }

  if (candidates.length === 0) return [];

  // Cross-check against the global opt-out list (whatsapp_contacts, restaurant_id null)
  const { data: optOutRows, error: optErr } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('wa_id')
    .is('restaurant_id', null)
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
  const { data, error } = await supabaseAdmin
    .from('restaurant_customers')
    .select('restaurant_id, restaurants ( name )')
    .eq('marketing_consent', true);

  if (error) throw new Error(error.message);

  const counts = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    const rid = row.restaurant_id as string;
    const rest = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
    const name = (rest as { name?: string } | null)?.name ?? 'Unknown restaurant';
    const existing = counts.get(rid);
    if (existing) existing.count += 1;
    else counts.set(rid, { name, count: 1 });
  }

  return [...counts.entries()]
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);
}