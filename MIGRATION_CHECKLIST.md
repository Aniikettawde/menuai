# Dinezy migration checklist

## Replace

- `app/page.tsx`
- `app/robots.ts`
- `app/sitemap.ts`
- marketing navbar/footer/components used by the old homepage

## Add

- `lib/marketing-seo.ts`
- `components/dinezy-landing/JsonLd.tsx`
- `components/dinezy-landing/MarketingHeader.tsx`
- `components/dinezy-landing/MarketingFooter.tsx`
- `components/dinezy-landing/HomePage.tsx`
- `components/dinezy-landing/FeaturePage.tsx`
- all route folders under `app/restaurant-*`, `app/ai-menu-assistant`, and the Pune route
- compatibility redirect routes under `app/product`, `app/menu`, `app/whatsapp`, `app/analytics`, `app/ai`, `app/loyalty`

## Preserve

- `app/r/[slug]` restaurant pages
- dish routes and `lib/dish-url`
- dashboard/auth routes
- Supabase integration
- existing QR generator functionality
- existing blog functionality
- existing privacy/terms pages

## Verify after deploy

- `NEXT_PUBLIC_SITE_URL=https://dinezy.in`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- no accidental `noindex` on public pages
- no blocked public route in `robots.txt`
- no duplicate canonical URLs
- no placeholder testimonials, fake metrics or invented restaurant/customer names on public marketing pages
