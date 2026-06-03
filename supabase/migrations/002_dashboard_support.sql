-- ============================================================
-- MenuAI Dashboard — Additional SQL
-- Run AFTER 001_initial_schema.sql in Supabase SQL Editor
-- ============================================================

-- ── Storage bucket for restaurant assets (logos, cover, item photos) ─────────
-- Create via Supabase Dashboard → Storage → New Bucket OR via SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-assets',
  'restaurant-assets',
  true,  -- public read
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: owner can upload/update/delete their own assets
CREATE POLICY "owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'restaurant-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'restaurant-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'restaurant-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "public_read_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'restaurant-assets');


-- ── Allow restaurant owners to write/edit their OWN menu data ─────────────────

-- Menu categories: owner can INSERT / UPDATE / DELETE
CREATE POLICY "categories_owner_write" ON menu_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

-- Menu items: owner can INSERT / UPDATE / DELETE
CREATE POLICY "items_owner_write" ON menu_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );


-- ── Search terms tracking (optional) ──────────────────────────────────────────
-- The AI chat route already logs 'item_search' events.
-- To capture the raw search query text, update your chat route to include:
--   metadata: { query: userMessage }
-- in the analytics event when event_type = 'item_search'.
-- This is already read by the analytics dashboard above.


-- ── Helpful analytics view: search terms summary ──────────────────────────────
CREATE OR REPLACE VIEW analytics_search_terms AS
SELECT
  restaurant_id,
  metadata->>'query' AS query,
  COUNT(*) AS search_count
FROM analytics_events
WHERE event_type = 'item_search'
  AND metadata->>'query' IS NOT NULL
GROUP BY restaurant_id, metadata->>'query'
ORDER BY search_count DESC;


-- ── Day-of-week heatmap view ───────────────────────────────────────────────────
CREATE OR REPLACE VIEW analytics_day_hour_heatmap AS
SELECT
  restaurant_id,
  day_of_week,
  hour_of_day,
  COUNT(DISTINCT session_id) AS visitors
FROM analytics_events
WHERE event_type = 'page_view'
GROUP BY restaurant_id, day_of_week, hour_of_day
ORDER BY day_of_week, hour_of_day;
