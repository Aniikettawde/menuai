import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
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
      { error: 'failed' },
      { status: 500 }
    )
  }
}