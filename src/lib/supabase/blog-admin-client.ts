import { createClient } from "@supabase/supabase-js";

// IMPORTANT: This client uses the SERVICE ROLE key and must ONLY be
// imported inside server-side code (API routes, Server Actions, Route Handlers).
// Never import this into a "use client" component - it would leak the key.
//
// Add to your .env.local:
// SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   (from Supabase dashboard > Settings > API)
//
// You already have NEXT_PUBLIC_SUPABASE_URL set up for the customer-facing app,
// so we reuse that here.

export function getBlogAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars for blog admin client"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
