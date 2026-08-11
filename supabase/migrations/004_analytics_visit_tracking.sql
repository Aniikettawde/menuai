-- Visit-page analytics: ensure table_number column + helpful indexes

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS table_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_analytics_table
  ON analytics_events (restaurant_id, table_number)
  WHERE table_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_entry_source
  ON analytics_events (restaurant_id, ((metadata->>'entry_source')))
  WHERE metadata->>'entry_source' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_menu_search
  ON analytics_events (restaurant_id, timestamp DESC)
  WHERE event_type = 'menu_search';

-- Per-table scan summary (QR table sessions)
CREATE OR REPLACE VIEW analytics_table_scans AS
SELECT
  restaurant_id,
  table_number,
  COUNT(*) AS scan_count,
  COUNT(DISTINCT DATE(created_at)) AS active_days,
  MIN(created_at) AS first_scan_at,
  MAX(created_at) AS last_scan_at
FROM table_sessions
GROUP BY restaurant_id, table_number;
