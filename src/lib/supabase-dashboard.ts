// src/lib/supabase-dashboard.ts
import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function getSupabaseDashboardBrowser() {
  return createBrowserClient(url, anonKey)
}