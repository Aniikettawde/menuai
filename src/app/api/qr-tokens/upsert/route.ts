import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr'
import { generateToken } from '@/lib/qr-token'

async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    },
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      restaurantId: string
      tableNumbers: number[]
    }

    const { restaurantId, tableNumbers } = body

    if (!restaurantId || !Array.isArray(tableNumbers) || tableNumbers.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (restaurantError) {
      return NextResponse.json({ error: restaurantError.message }, { status: 500 })
    }

    if (!restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('qr_tokens')
      .select('table_number, token')
      .eq('restaurant_id', restaurantId)
      .in('table_number', tableNumbers)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const existingMap = new Map(
      (existing ?? []).map((r) => [r.table_number, r.token]),
    )

    const rows = tableNumbers.map((tableNumber) => ({
      restaurant_id: restaurantId,
      table_number: tableNumber,
      token: existingMap.get(tableNumber) ?? generateToken(),
    }))

    const { data: upserted, error } = await supabase
      .from('qr_tokens')
      .upsert(rows, { onConflict: 'restaurant_id,table_number' })
      .select('table_number, token')

    if (error) {
      console.error('Token upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tokens: upserted ?? [] })
  } catch (err) {
    console.error('qr-tokens upsert route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'