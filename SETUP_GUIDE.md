# MenuAI — Complete Setup Guide
## AI-Powered Restaurant Menu Web App

---

## 🗂️ Project Structure

```
menuai/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, fonts, PWA meta
│   │   ├── globals.css             # Design tokens, animations
│   │   ├── page.tsx                # Home/landing page
│   │   ├── r/[slug]/
│   │   │   └── page.tsx            # QR landing page per restaurant
│   │   └── api/
│   │       ├── chat/route.ts       # Gemini 2.5 Flash chat endpoint
│   │       └── analytics/route.ts  # Event ingestion endpoint
│   ├── components/
│   │   ├── RestaurantShell.tsx     # Main app shell (client)
│   │   ├── RestaurantHeader.tsx    # Name, rating, open/closed
│   │   ├── CategoryTabs.tsx        # Sticky horizontal tabs
│   │   ├── MenuGrid.tsx            # Menu items grouped by category
│   │   ├── MenuItemCard.tsx        # Individual item card
│   │   ├── ChatPanel.tsx           # AI chatbot UI (mobile drawer + desktop sidebar)
│   │   ├── ChatMessage.tsx         # Individual message bubble
│   │   ├── RatingModal.tsx         # Star rating modal
│   │   └── OfflineBanner.tsx       # "You're offline" banner
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client (browser + server)
│   │   ├── cache.ts                # IndexedDB offline cache
│   │   ├── analytics.ts            # Event tracking utility
│   │   └── nanoid.ts               # Tiny ID generator
│   ├── store/
│   │   └── app-store.ts            # Zustand global state
│   ├── hooks/
│   │   └── usePWA.ts               # Service worker registration
│   └── types/
│       └── index.ts                # All TypeScript types
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Complete DB schema
├── public/
│   ├── sw.js                       # Service Worker (offline support)
│   └── manifest.json               # PWA manifest
├── .env.example
├── next.config.js
├── tailwind.config.js
└── vercel.json
```

---

## 🚀 Step 1: Supabase Setup

### 1.1 Create Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `menuai`
3. Region: **ap-south-1** (Mumbai — best for India)
4. Note your Project URL and API keys

### 1.2 Run Database Schema
1. Open **SQL Editor** in Supabase dashboard
2. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run**
4. Verify tables created: `restaurants`, `menu_categories`, `menu_items`, `ratings`, `analytics_events`

### 1.3 Get Your Keys
Go to **Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon` `public` key
- `SUPABASE_SERVICE_ROLE_KEY` = `service_role` key (keep secret!)

---

## 🤖 Step 2: Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create an API key (free tier = generous limits)
3. Set as `GEMINI_API_KEY` in your env

---

## 💻 Step 3: Local Development

```bash
# Clone / create the project folder
cd menuai

# Install dependencies
npm install

# Copy and fill env vars
cp .env.example .env.local
# Edit .env.local with your keys

# Run dev server
npm run dev

# Visit http://localhost:3000/r/spice-garden
# (The sample restaurant from the migration)
```

---

## 🍽️ Step 4: Add Your Restaurant Data

### Via Supabase Dashboard (easiest)

```sql
-- 1. Insert restaurant
INSERT INTO restaurants (name, slug, description, cuisine_type, address, opening_hours)
VALUES (
  'Your Restaurant Name',
  'your-slug',           -- This becomes the URL: /r/your-slug
  'Your description',
  'Cuisine type',
  'Your address',
  '{"monday":{"open":"11:00","close":"23:00"},"tuesday":{"open":"11:00","close":"23:00"},"wednesday":{"open":"11:00","close":"23:00"},"thursday":{"open":"11:00","close":"23:00"},"friday":{"open":"11:00","close":"23:00"},"saturday":{"open":"11:00","close":"23:00"},"sunday":{"open":"11:00","close":"22:00"}}'
);

-- 2. Get the restaurant ID
SELECT id FROM restaurants WHERE slug = 'your-slug';

-- 3. Insert categories (use the ID from above)
INSERT INTO menu_categories (restaurant_id, name, position) VALUES
  ('RESTAURANT_ID', 'Starters', 1),
  ('RESTAURANT_ID', 'Main Course', 2),
  ('RESTAURANT_ID', 'Breads', 3),
  ('RESTAURANT_ID', 'Desserts', 4),
  ('RESTAURANT_ID', 'Beverages', 5);

-- 4. Insert menu items (price in paise: ₹299 = 29900)
INSERT INTO menu_items (restaurant_id, category_id, name, description, price, is_veg, is_bestseller, tags) VALUES
  ('RESTAURANT_ID', 'CATEGORY_ID', 
   'Dal Makhani', 
   'Slow-cooked black lentils in rich tomato-butter gravy. Simmered overnight for deep flavor.',
   29900, true, true, ARRAY['chef-special']),
  
  ('RESTAURANT_ID', 'CATEGORY_ID',
   'Butter Chicken',
   'Tender chicken in silky tomato-cream sauce. Our signature dish since 2010.',
   34900, false, true, ARRAY['bestseller']);
```

---

## 🌐 Step 5: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (first time — follow prompts)
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GEMINI_API_KEY

# Deploy to production
vercel --prod
```

### Or deploy via GitHub:
1. Push code to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Add env vars in Vercel Dashboard → Settings → Environment Variables
4. Every push to `main` auto-deploys

**Your QR URL will be:** `https://your-app.vercel.app/r/your-slug`

---

## 📱 Step 6: Generate QR Codes

```
QR Code URL format: https://your-app.vercel.app/r/{restaurant-slug}

Free QR generators:
- qr-code-generator.com
- goqr.me

Print on table cards, menu boards, etc.
```

---

## ⚡ Performance Architecture

### Why it's fast on 3G:

| Technique | Impact |
|-----------|--------|
| ISR (5-min revalidate) | HTML served from CDN edge |
| Service Worker | Subsequent visits load offline |
| IndexedDB cache | Menu persists 10 min locally |
| Image lazy loading | Images load only when in view |
| Font `display: swap` | Text visible immediately |
| `maxOutputTokens: 512` | AI replies are short → fast |
| Analytics `keepalive` | Tracking doesn't block UI |
| Batch analytics writes | Single DB call for all events |

---

## 📊 Analytics — What Gets Tracked

Every event has: `restaurant_id`, `session_id`, `timestamp`, `hour_of_day`, `day_of_week`

| Event | When |
|-------|------|
| `page_view` | User opens the menu |
| `session_start` | New session begins |
| `item_view` | User taps to expand an item |
| `ai_upsell_shown` | AI suggests a complementary item |
| `ai_upsell_accepted` | User asks about the suggested item |
| `bestseller_shown` | AI mentions a bestseller |
| `rating_submitted` | User submits a star rating |

### Query examples (Supabase SQL):

```sql
-- Busiest hours this week
SELECT hour_of_day, day_of_week, COUNT(DISTINCT session_id) as visitors
FROM analytics_events
WHERE restaurant_id = 'YOUR_ID'
  AND event_type = 'page_view'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY hour_of_day, day_of_week
ORDER BY visitors DESC;

-- Most viewed items
SELECT item_name, COUNT(*) as views
FROM analytics_events
WHERE restaurant_id = 'YOUR_ID' AND event_type = 'item_view'
GROUP BY item_name ORDER BY views DESC LIMIT 10;

-- Upsell conversion rate
SELECT 
  COUNT(*) FILTER (WHERE event_type = 'ai_upsell_shown') as shown,
  COUNT(*) FILTER (WHERE event_type = 'ai_upsell_accepted') as accepted,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'ai_upsell_accepted') /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'ai_upsell_shown'), 0), 1
  ) as conversion_pct
FROM analytics_events WHERE restaurant_id = 'YOUR_ID';
```

---

## 🤖 Customizing the AI

Edit the `buildSystemPrompt()` function in `src/app/api/chat/route.ts`:

```typescript
// Add restaurant-specific personality:
`You are "Raju Bhaiya", the friendly AI waiter at ${restaurantName}...`

// Add specific dish pairing rules:
`When Butter Chicken is mentioned, always suggest Garlic Naan or Laccha Paratha as perfect companions.`

// Add promotional context:
`Today's special: 20% off on all biryanis between 2-5 PM.`
```

---

## 📱 Android / iOS App (Future)

The codebase is designed for easy cross-platform extension:

**React Native migration path:**
- All business logic is in `src/lib/` and `src/store/` — zero UI dependencies
- `supabase.ts` works identically in React Native (swap `@supabase/ssr` for `@supabase/supabase-js`)
- `analytics.ts` — replace IndexedDB with `@react-native-async-storage/async-storage`
- `types/index.ts` — 100% reusable, no changes needed
- Chat API — same `/api/chat` endpoint, just call it from native

**Recommended stack for native:**
- React Native + Expo
- Same Supabase backend
- Same Gemini API (no changes)
- React Native Reanimated for animations (equivalent to framer-motion)
- Expo Router for navigation (similar to Next.js app router)

---

## 🛡️ Security Checklist

- [x] `SUPABASE_SERVICE_ROLE_KEY` is server-only (never in NEXT_PUBLIC_)
- [x] RLS enabled on all tables
- [x] Analytics events validated server-side
- [x] No PII collected — only anonymous session IDs
- [x] Rate limiting: Gemini API has built-in per-key limits
- [ ] Optional: Add rate limiting middleware for `/api/chat` with upstash/redis

---

## 💰 Cost Estimate (Free Tiers)

| Service | Free Tier | Enough For |
|---------|-----------|------------|
| Vercel | 100GB bandwidth, unlimited deployments | ~50K monthly visitors |
| Supabase | 500MB DB, 2GB bandwidth, 50K MAU | ~10 restaurants, 5K users/mo |
| Gemini API | 1,500 req/day free | ~1,500 chat messages/day |
| Domain | vercel.app subdomain | Free forever |

**Total cost to launch: ₹0**
