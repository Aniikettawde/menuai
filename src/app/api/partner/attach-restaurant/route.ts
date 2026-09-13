import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
)

export async function POST(
  req: NextRequest,
) {
  try {
    const body = await req
      .json()
      .catch(() => ({}))

    const restaurantId = String(
      body?.restaurantId || '',
    ).trim()

    if (!restaurantId) {
      return NextResponse.json(
        {
          error:
            'Missing restaurant id.',
        },
        { status: 400 },
      )
    }

    const response =
      NextResponse.json({
        ok: true,
      })

    const supabase =
      createServerClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!,
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll()
            },
            setAll(
              cookiesToSet,
            ) {
              cookiesToSet.forEach(
                ({
                  name,
                  value,
                  options,
                }) => {
                  response.cookies.set(
                    name,
                    value,
                    options,
                  )
                },
              )
            },
          },
        },
      )

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    // Make sure the restaurant actually belongs
    // to the authenticated owner.
    const {
      data: restaurant,
      error: restaurantError,
    } = await admin
      .from('restaurants')
      .select(
        'id, owner_id, name, total_tables',
      )
      .eq('id', restaurantId)
      .eq('owner_id', user.id)
      .single()

    if (
      restaurantError ||
      !restaurant
    ) {
      return NextResponse.json(
        {
          error:
            'Restaurant not found.',
        },
        { status: 404 },
      )
    }

    const {
      data: attribution,
      error: attributionError,
    } = await admin
      .from(
        'partner_restaurant_attributions',
      )
      .select(
        'id, partner_id, status, onboarding_progress',
      )
      .eq(
        'restaurant_owner_id',
        user.id,
      )
      .is('restaurant_id', null)
      .order('created_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

    if (attributionError) {
      console.error(
        '[partner attach attribution]',
        attributionError,
      )

      return NextResponse.json(
        { error: 'Could not attach partner attribution.' },
        { status: 500 },
      )
    }

    // No referral is perfectly valid.
    if (!attribution) {
      return response
    }

    await admin
      .from(
        'partner_restaurant_attributions',
      )
      .update({
        restaurant_id: restaurant.id,
        status:
          'setup_in_progress',
        onboarding_progress: 20,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        attribution.id,
      )

    return response
  } catch (error) {
    console.error(
      '[partner attach restaurant]',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Internal server error.',
      },
      { status: 500 },
    )
  }
}