import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { resolveDashboardContext } from '@/lib/dashboard-access'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  try {
    let userId: string | null = null
    let userEmail: string | null = null

    // 1. Try Bearer token first (Android / API clients)
    const authHeader = req.headers.get('authorization') ?? ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (bearerToken) {
      const { data: { user }, error } = await getServiceClient().auth.getUser(bearerToken)
      if (!error && user) {
        userId = user.id
        userEmail = user.email ?? null
      }
    }

    // 2. Fall back to cookie session (web browser)
    if (!userId) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll() {},
          },
        },
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        userEmail = user.email ?? null
      }
    }

    if (!userId) {
      return NextResponse.json({ context: null }, { status: 401 })
    }

    const context = await resolveDashboardContext(userId, userEmail)
    return NextResponse.json({ context })

  } catch (err) {
    console.error('dashboard/context error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}