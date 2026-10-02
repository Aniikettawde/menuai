// src/lib/supabase-dashboard.ts

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let browserClient: SupabaseClient | null = null

export function getSupabaseDashboardBrowser(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey)
  }

  return browserClient
}