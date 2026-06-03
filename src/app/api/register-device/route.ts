import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: 'Missing env vars',
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!serviceKey,
        },
        { status: 500 }
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { restaurantSlug, token } = await req.json()

    if (!restaurantSlug || !token) {
      return NextResponse.json(
        { error: 'Missing fields' },
        { status: 400 }
      )
    }

    const { error } = await admin
      .from('device_tokens')
      .upsert(
        {
          restaurant_slug: restaurantSlug,
          fcm_token: token,
        },
        {
          onConflict: 'fcm_token',
        }
      )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (e) {
    console.error(e)

    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'failed',
      },
      { status: 500 }
    )
  }
}