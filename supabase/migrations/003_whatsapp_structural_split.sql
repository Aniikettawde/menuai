-- ============================================================
-- Phase 2 Step 1: Structural split of WhatsApp tables
-- Restaurant domain vs Platform (Dinezy) domain
--
-- IMPORTANT — do NOT drop the _deprecated tables in this migration.
-- Run the DROP statements at the bottom of the companion report
-- only after the app has been verified against the new tables.
--
-- Backfill rule (credential / number based, NOT UUID based):
--   • restaurant_id IS NULL  → platform
--   • restaurant-owned campaigns (restaurant_id IS NOT NULL) and their
--     recipients / billed outbound messages → restaurant
--   • inbound messages with restaurant_id set → restaurant
--     (webhook only sets that when phone_number_id matches
--     whatsapp_connections; Dinezy's env phone_number_id is different)
--   • outbound messages whose parent campaign has restaurant_id IS NULL
--     → platform, even if the row's restaurant_id was set for audience
--     attribution; that value moves to context_restaurant_id
--   • contacts: restaurant if they have restaurant-bound messages;
--     otherwise platform (covers the DINEZY_RESTAURANT_ID /contacts/add
--     split-brain rows that never belonged on the restaurant number)
--
-- whatsapp_connections / whatsapp_billing: left named as-is
-- (already restaurant-scoped; renaming touches connect/disconnect with
-- no isolation benefit).
-- ============================================================

-- ── Restaurant-domain tables ─────────────────────────────────
CREATE TABLE restaurant_whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int DEFAULT 0,
  opted_out boolean DEFAULT false,
  source text DEFAULT 'manual',
  restaurant_name text,
  UNIQUE (restaurant_id, wa_id)
);

CREATE TABLE restaurant_whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text,
  template_name text,
  template_language text,
  header_variable text,
  body_variables jsonb,
  status text DEFAULT 'queued',
  total_recipients int DEFAULT 0,
  sent_count int DEFAULT 0,
  delivered_count int DEFAULT 0,
  read_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  audience_filter jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE restaurant_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  wamid text,
  direction text NOT NULL,
  message_type text DEFAULT 'text',
  body text,
  media_url text,
  status text DEFAULT 'sent',
  campaign_id uuid REFERENCES restaurant_whatsapp_campaigns(id) ON DELETE SET NULL,
  cost numeric DEFAULT 0,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX restaurant_whatsapp_messages_thread_idx
  ON restaurant_whatsapp_messages (restaurant_id, wa_id, created_at);
CREATE INDEX restaurant_whatsapp_messages_wamid_idx
  ON restaurant_whatsapp_messages (wamid);

CREATE TABLE restaurant_whatsapp_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES restaurant_whatsapp_campaigns(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  name text,
  status text DEFAULT 'pending',
  wamid text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX restaurant_whatsapp_campaign_recipients_wamid_idx
  ON restaurant_whatsapp_campaign_recipients (wamid);

-- ── Platform-domain tables — NO restaurant_id column ─────────
-- context_restaurant_id is optional attribution only (audience /
-- rating deep-link), never used for credentials or tenancy.
CREATE TABLE platform_whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  name text,
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int DEFAULT 0,
  opted_out boolean DEFAULT false,
  source text DEFAULT 'manual',
  restaurant_name text
);

CREATE TABLE platform_whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  template_name text,
  template_language text,
  header_variable text,
  body_variables jsonb,
  status text DEFAULT 'queued',
  total_recipients int DEFAULT 0,
  sent_count int DEFAULT 0,
  delivered_count int DEFAULT 0,
  read_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  audience_filter jsonb,
  context_restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE platform_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL,
  wamid text,
  direction text NOT NULL,
  message_type text DEFAULT 'text',
  body text,
  media_url text,
  status text DEFAULT 'sent',
  campaign_id uuid REFERENCES platform_whatsapp_campaigns(id) ON DELETE SET NULL,
  cost numeric DEFAULT 0,
  is_read boolean DEFAULT false,
  context_restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX platform_whatsapp_messages_thread_idx
  ON platform_whatsapp_messages (wa_id, created_at);
CREATE INDEX platform_whatsapp_messages_wamid_idx
  ON platform_whatsapp_messages (wamid);

CREATE TABLE platform_whatsapp_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES platform_whatsapp_campaigns(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  name text,
  status text DEFAULT 'pending',
  wamid text,
  sent_at timestamptz,
  error_message text,
  context_restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX platform_whatsapp_campaign_recipients_wamid_idx
  ON platform_whatsapp_campaign_recipients (wamid);

-- ── RLS: default-deny (service role bypasses; client must fail closed)
ALTER TABLE restaurant_whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- ── Backfill helpers (credential-aware split) ────────────────
-- Restaurant-owned campaign IDs: created via /api/restaurant/whatsapp
-- (estimated_cost from billing; restaurant_id set; sent via
-- whatsapp_connections.access_token). Platform campaigns always insert
-- restaurant_id NULL and estimated_cost 0.
--
-- Preserve source UUIDs so campaign_id FKs on messages/recipients stay valid.

INSERT INTO restaurant_whatsapp_campaigns (
  id, restaurant_id, name, template_name, template_language, header_variable,
  body_variables, status, total_recipients, sent_count, delivered_count,
  read_count, failed_count, estimated_cost, actual_cost, audience_filter,
  created_at, updated_at
)
SELECT
  id, restaurant_id, name, template_name, template_language, header_variable,
  body_variables, status, total_recipients, sent_count, delivered_count,
  read_count, failed_count, estimated_cost, actual_cost, audience_filter,
  created_at, updated_at
FROM whatsapp_campaigns
WHERE restaurant_id IS NOT NULL;

INSERT INTO platform_whatsapp_campaigns (
  id, name, template_name, template_language, header_variable,
  body_variables, status, total_recipients, sent_count, delivered_count,
  read_count, failed_count, estimated_cost, actual_cost, audience_filter,
  context_restaurant_id, created_at, updated_at
)
SELECT
  id, name, template_name, template_language, header_variable,
  body_variables, status, total_recipients, sent_count, delivered_count,
  read_count, failed_count, estimated_cost, actual_cost, audience_filter,
  NULLIF(audience_filter->>'restaurantId', '')::uuid,
  created_at, updated_at
FROM whatsapp_campaigns
WHERE restaurant_id IS NULL;

INSERT INTO restaurant_whatsapp_campaign_recipients (
  id, campaign_id, restaurant_id, wa_id, name, status, wamid,
  sent_at, error_message, created_at
)
SELECT
  r.id, r.campaign_id, r.restaurant_id, r.wa_id, r.name, r.status, r.wamid,
  r.sent_at, r.error_message, r.created_at
FROM whatsapp_campaign_recipients r
INNER JOIN whatsapp_campaigns c ON c.id = r.campaign_id
WHERE c.restaurant_id IS NOT NULL;

INSERT INTO platform_whatsapp_campaign_recipients (
  id, campaign_id, wa_id, name, status, wamid, sent_at, error_message,
  context_restaurant_id, created_at
)
SELECT
  r.id, r.campaign_id, r.wa_id, r.name, r.status, r.wamid, r.sent_at, r.error_message,
  COALESCE(
    r.restaurant_id,
    NULLIF(c.audience_filter->>'restaurantId', '')::uuid
  ),
  r.created_at
FROM whatsapp_campaign_recipients r
INNER JOIN whatsapp_campaigns c ON c.id = r.campaign_id
WHERE c.restaurant_id IS NULL;

-- Restaurant messages: inbound on a connected restaurant number, OR
-- outbound belonging to a restaurant-owned campaign (sent via connection token).
INSERT INTO restaurant_whatsapp_messages (
  id, restaurant_id, wa_id, wamid, direction, message_type, body, media_url,
  status, campaign_id, cost, is_read, created_at
)
SELECT
  m.id, m.restaurant_id, m.wa_id, m.wamid, m.direction, m.message_type, m.body,
  m.media_url, m.status, m.campaign_id, m.cost, m.is_read, m.created_at
FROM whatsapp_messages m
WHERE m.restaurant_id IS NOT NULL
  AND (
    m.direction = 'inbound'
    OR m.campaign_id IN (SELECT id FROM whatsapp_campaigns WHERE restaurant_id IS NOT NULL)
  );

-- Platform messages: null restaurant_id, OR outbound whose parent campaign
-- is platform-owned (audience attribution restaurant_id → context_restaurant_id).
INSERT INTO platform_whatsapp_messages (
  id, wa_id, wamid, direction, message_type, body, media_url, status,
  campaign_id, cost, is_read, context_restaurant_id, created_at
)
SELECT
  m.id, m.wa_id, m.wamid, m.direction, m.message_type, m.body, m.media_url,
  m.status, m.campaign_id, m.cost, m.is_read,
  CASE
    WHEN m.restaurant_id IS NOT NULL THEN m.restaurant_id
    ELSE NULL
  END,
  m.created_at
FROM whatsapp_messages m
WHERE m.restaurant_id IS NULL
   OR (
     m.campaign_id IS NOT NULL
     AND m.campaign_id IN (SELECT id FROM whatsapp_campaigns WHERE restaurant_id IS NULL)
   );

-- Restaurant contacts: only those with restaurant-bound message history
-- (excludes DINEZY_RESTAURANT_ID placeholder contacts from /contacts/add).
INSERT INTO restaurant_whatsapp_contacts (
  id, restaurant_id, wa_id, name, created_at, last_message_at,
  last_message_preview, unread_count, opted_out, source, restaurant_name
)
SELECT
  c.id, c.restaurant_id, c.wa_id, c.name, c.created_at, c.last_message_at,
  c.last_message_preview, c.unread_count, c.opted_out, c.source, c.restaurant_name
FROM whatsapp_contacts c
WHERE c.restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM whatsapp_messages m
    WHERE m.restaurant_id = c.restaurant_id
      AND m.wa_id = c.wa_id
      AND (
        m.direction = 'inbound'
        OR m.campaign_id IN (SELECT id FROM whatsapp_campaigns WHERE restaurant_id IS NOT NULL)
      )
  );

-- Platform contacts: null-restaurant_id rows, deduped by wa_id.
-- The old UNIQUE (restaurant_id, wa_id) treated NULLs as distinct, so the
-- platform inbox accumulated duplicate rows per wa_id. Keep the most recently
-- active row; collapsed duplicate ids remain only in _deprecated.
INSERT INTO platform_whatsapp_contacts (
  id, wa_id, name, created_at, last_message_at, last_message_preview,
  unread_count, opted_out, source, restaurant_name
)
SELECT DISTINCT ON (wa_id)
  id, wa_id, name, created_at, last_message_at, last_message_preview,
  unread_count, opted_out, source, restaurant_name
FROM whatsapp_contacts
WHERE restaurant_id IS NULL
ORDER BY wa_id, last_message_at DESC NULLS LAST, created_at DESC NULLS LAST;

-- Then Vidheevat-tagged /contacts/add placeholders that are NOT restaurant
-- inbox contacts. ON CONFLICT skips wa_ids already present from the null set
-- (e.g. 919371183369 which exists in both).
INSERT INTO platform_whatsapp_contacts (
  id, wa_id, name, created_at, last_message_at, last_message_preview,
  unread_count, opted_out, source, restaurant_name
)
SELECT DISTINCT ON (c.wa_id)
  c.id, c.wa_id, c.name, c.created_at, c.last_message_at, c.last_message_preview,
  c.unread_count, c.opted_out, c.source, c.restaurant_name
FROM whatsapp_contacts c
WHERE c.restaurant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM restaurant_whatsapp_contacts rc
    WHERE rc.restaurant_id = c.restaurant_id AND rc.wa_id = c.wa_id
  )
ORDER BY c.wa_id, c.last_message_at DESC NULLS LAST, c.created_at DESC NULLS LAST
ON CONFLICT (wa_id) DO NOTHING;

-- ── Sanity: every old message/campaign/recipient/contact must land
-- somewhere. These queries return rows that matched neither split —
-- investigate before dropping _deprecated tables.
-- (Left as comments for the operator; uncomment to inspect.)
-- SELECT 'orphan_message' AS kind, m.* FROM whatsapp_messages m
-- WHERE m.id NOT IN (SELECT id FROM restaurant_whatsapp_messages)
--   AND m.id NOT IN (SELECT id FROM platform_whatsapp_messages);
-- SELECT 'orphan_campaign' AS kind, c.* FROM whatsapp_campaigns c
-- WHERE c.id NOT IN (SELECT id FROM restaurant_whatsapp_campaigns)
--   AND c.id NOT IN (SELECT id FROM platform_whatsapp_campaigns);
-- SELECT 'orphan_recipient' AS kind, r.* FROM whatsapp_campaign_recipients r
-- WHERE r.id NOT IN (SELECT id FROM restaurant_whatsapp_campaign_recipients)
--   AND r.id NOT IN (SELECT id FROM platform_whatsapp_campaign_recipients);
-- SELECT 'orphan_contact' AS kind, c.* FROM whatsapp_contacts c
-- WHERE c.id NOT IN (SELECT id FROM restaurant_whatsapp_contacts)
--   AND c.wa_id NOT IN (SELECT wa_id FROM platform_whatsapp_contacts);

-- ── Rename old shared tables (do NOT drop) ───────────────────
ALTER TABLE whatsapp_contacts RENAME TO whatsapp_contacts_deprecated;
ALTER TABLE whatsapp_messages RENAME TO whatsapp_messages_deprecated;
ALTER TABLE whatsapp_campaigns RENAME TO whatsapp_campaigns_deprecated;
ALTER TABLE whatsapp_campaign_recipients RENAME TO whatsapp_campaign_recipients_deprecated;
