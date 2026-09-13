import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch {
              // Ignore cookie writes in this route.
            }
          },
        },
      },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    // Service-role client for secure partner lookup
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    const { data: partner, error: partnerError } = await admin
      .from('partners')
      .select('id, full_name, city, whatsapp, email, referral_code, status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (partnerError) {
      console.error('[partner check]', partnerError)

      return NextResponse.json(
        { error: 'Unable to verify partner account.' },
        { status: 500 },
      )
    }

    if (!partner) {
      return NextResponse.json(
        { error: 'This account is not registered as a Dinezy Partner.' },
        { status: 403 },
      )
    }

    if (partner.status !== 'active') {
      return NextResponse.json(
        { error: 'Your partner account is not active.' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      partner,
    })
  } catch (error) {
    console.error('[partner check exception]', error)

    return NextResponse.json(
      { error: 'Unable to verify partner account.' },
      { status: 500 },
    )
  }
}