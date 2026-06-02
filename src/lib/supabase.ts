// lib/supabase.ts
// Two clients: one for browser (with anon key), one for server actions
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client — used in React components and hooks
// Singleton pattern to avoid re-creating on every render
let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },  // anonymous users, no auth needed
      global: {
        fetch: (url, options) => {
          // Add cache hints for menu data fetching
          return fetch(url, {
            ...options,
            // Next.js 14 fetch caching
            next: { revalidate: 300 }, // 5 min cache
          } as RequestInit)
        }
      }
    })
  }
  return browserClient
}

// Server client — used in API routes and server components
export function getSupabaseServer() {
  // Server-side: use service role for analytics writes (bypasses RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}
