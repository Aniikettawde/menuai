// src/app/api/debug-session/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  
  const { data: { user } } = await supabase.auth.getUser()
  
  return NextResponse.json({
    user: user?.id ?? null,
    cookies: allCookies.map(c => c.name), // just names, not values
  })
}