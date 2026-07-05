import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'   // ← add this

let client: ReturnType<typeof createClient<Database>> | null = null   // ← add <Database>

export function getSupabaseService() {
  if (!client) {
    client = createClient<Database>(                                  // ← add <Database>
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
  }
  return client
}