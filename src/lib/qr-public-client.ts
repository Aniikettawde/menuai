import { createClient } from "@supabase/supabase-js";

// Public, anon-key client — safe to use in the browser.
// This is intentionally separate from your existing src/lib/supabase.ts
// so this public, unauthenticated tool can never touch anything tied to
// admin-guard, subscription, or billing logic.
//
// If your existing lib/supabase.ts already exports a plain browser/anon
// client, you can delete this file and import that one instead — just
// never use a service-role client here, since this page is public.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing — QR generation history will not be logged, but the generator itself will still work."
  );
}

export const supabasePublic = createClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? ""
);