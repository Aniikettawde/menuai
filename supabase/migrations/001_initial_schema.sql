-- ============================================================
-- MenuAI Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── RESTAURANTS ──────────────────────────────────────────────
CREATE TABLE restaurants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,  -- used in QR URL
  description     TEXT,
  cuisine_type    TEXT,
  logo_url        TEXT,
  cover_url       TEXT,
  address         TEXT,
  phone           TEXT,
  avg_rating      DECIMAL(3,2) DEFAULT 0.0,
  total_ratings   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  opening_hours   JSONB DEFAULT '{}',
  owner_id        UUID,                  -- links to auth.users for admin
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MENU CATEGORIES ──────────────────────────────────────────
CREATE TABLE menu_categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  position        INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MENU ITEMS ───────────────────────────────────────────────
CREATE TABLE menu_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id         UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  price               INTEGER NOT NULL,     -- in paise (100 paise = ₹1)
  currency            TEXT DEFAULT 'INR',
  image_url           TEXT,
  is_available        BOOLEAN DEFAULT true,
  is_bestseller       BOOLEAN DEFAULT false,
  is_veg              BOOLEAN DEFAULT true,
  tags                TEXT[] DEFAULT '{}',  -- ['spicy', 'new', 'chef-special']
  allergens           TEXT[] DEFAULT '{}',
  prep_time_minutes   INTEGER,
  calories            INTEGER,
  customizations      JSONB,
  position            INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── RATINGS ──────────────────────────────────────────────────
CREATE TABLE ratings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL,
  score           INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ANALYTICS EVENTS ─────────────────────────────────────────
-- High-volume table — keep simple, query via views
CREATE TABLE analytics_events (
  id              BIGSERIAL PRIMARY KEY,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  item_id         UUID,
  item_name       TEXT,
  metadata        JSONB,
  timestamp       TIMESTAMPTZ NOT NULL,
  hour_of_day     SMALLINT NOT NULL,
  day_of_week     SMALLINT NOT NULL
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_menu_categories_restaurant ON menu_categories(restaurant_id, position);
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id, category_id, position);
CREATE INDEX idx_analytics_restaurant ON analytics_events(restaurant_id, timestamp DESC);
CREATE INDEX idx_analytics_event_type ON analytics_events(restaurant_id, event_type);
CREATE INDEX idx_analytics_item ON analytics_events(restaurant_id, item_id) WHERE item_id IS NOT NULL;
CREATE INDEX idx_ratings_restaurant ON ratings(restaurant_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

-- Restaurants: public read, owner write
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants_public_read" ON restaurants FOR SELECT USING (is_active = true);
CREATE POLICY "restaurants_owner_all" ON restaurants FOR ALL
  USING (owner_id = auth.uid());

-- Menu categories: public read
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON menu_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.is_active = true));

-- Menu items: public read
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_public_read" ON menu_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.is_active = true));

-- Ratings: public insert, restaurant owner read
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_public_insert" ON ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "ratings_owner_read" ON ratings FOR SELECT
  USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

-- Analytics: public insert (via service role in API), owner read
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_service_insert" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_owner_read" ON analytics_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

-- ── FUNCTION: Update restaurant avg_rating ────────────────────
CREATE OR REPLACE FUNCTION update_restaurant_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants
  SET
    avg_rating = (
      SELECT ROUND(AVG(score)::NUMERIC, 2)
      FROM ratings
      WHERE restaurant_id = NEW.restaurant_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM ratings
      WHERE restaurant_id = NEW.restaurant_id
    )
  WHERE id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_rating_insert
AFTER INSERT ON ratings
FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

-- ── ANALYTICS VIEWS (for restaurant dashboard) ───────────────

-- Daily summary view
CREATE OR REPLACE VIEW analytics_daily_summary AS
SELECT
  restaurant_id,
  DATE(timestamp) as date,
  COUNT(DISTINCT session_id) as unique_visitors,
  COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
  COUNT(*) FILTER (WHERE event_type = 'item_view') as item_views,
  COUNT(*) FILTER (WHERE event_type = 'ai_upsell_shown') as upsells_shown,
  COUNT(*) FILTER (WHERE event_type = 'ai_upsell_accepted') as upsells_accepted,
  COUNT(*) FILTER (WHERE event_type = 'bestseller_clicked') as bestseller_clicks
FROM analytics_events
GROUP BY restaurant_id, DATE(timestamp);

-- Hourly traffic view
CREATE OR REPLACE VIEW analytics_hourly_traffic AS
SELECT
  restaurant_id,
  day_of_week,
  hour_of_day,
  COUNT(DISTINCT session_id) as visitors,
  COUNT(*) as events
FROM analytics_events
WHERE event_type = 'page_view'
GROUP BY restaurant_id, day_of_week, hour_of_day;

-- Top items view
CREATE OR REPLACE VIEW analytics_top_items AS
SELECT
  restaurant_id,
  item_id,
  item_name,
  COUNT(*) FILTER (WHERE event_type = 'item_view') as view_count,
  COUNT(*) FILTER (WHERE event_type = 'bestseller_shown') as times_shown_as_bestseller,
  COUNT(*) FILTER (WHERE event_type = 'bestseller_clicked') as bestseller_clicks,
  COUNT(*) FILTER (WHERE event_type = 'ai_upsell_shown') as upsell_shown,
  COUNT(*) FILTER (WHERE event_type = 'ai_upsell_accepted') as upsell_accepted
FROM analytics_events
WHERE item_id IS NOT NULL
GROUP BY restaurant_id, item_id, item_name
ORDER BY view_count DESC;

-- ── SAMPLE DATA ──────────────────────────────────────────────
-- Insert a test restaurant (replace with your own)
INSERT INTO restaurants (name, slug, description, cuisine_type, address, opening_hours)
VALUES (
  'Spice Garden',
  'spice-garden',
  'Authentic Indian cuisine with a modern twist. Every dish tells a story.',
  'North Indian • Mughlai',
  'MG Road, Pune',
  '{
    "monday": {"open": "11:00", "close": "23:00"},
    "tuesday": {"open": "11:00", "close": "23:00"},
    "wednesday": {"open": "11:00", "close": "23:00"},
    "thursday": {"open": "11:00", "close": "23:00"},
    "friday": {"open": "11:00", "close": "23:30"},
    "saturday": {"open": "11:00", "close": "23:30"},
    "sunday": {"open": "11:00", "close": "22:30"}
  }'
);
