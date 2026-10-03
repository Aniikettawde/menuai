import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{
    restaurantId: string
  }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { restaurantId } = await params

    if (!restaurantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Restaurant ID is required',
        },
        { status: 400 },
      )
    }

    // ----------------------------------------
    // Supabase
    // ----------------------------------------

    const supabase = await createClient()

    // ----------------------------------------
    // Authenticate
    // ----------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 },
      )
    }

    // ----------------------------------------
    // Request body
    // ----------------------------------------

    let body: {
      action?: 'pause_today' | 'resume'
      reason?: string | null
      message?: string | null
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
        },
        { status: 400 },
      )
    }

    // ----------------------------------------
    // PAUSE FOR TODAY
    // ----------------------------------------

    if (body.action === 'pause_today') {
      const { data, error } = await supabase.rpc(
        'pause_restaurant_for_today',
        {
          p_restaurant_id: restaurantId,
          p_reason: body.reason ?? 'Closed today',
          p_message:
            body.message ??
            "We're currently unavailable. Please ask our staff for the menu. They'll be happy to assist you.",
        },
      )

      if (error) {
        console.error(
          '[Dinezy Pause] Pause RPC error:',
          error,
        )

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        action: 'pause_today',
        restaurant: data,
      })
    }

    // ----------------------------------------
    // RESUME
    // ----------------------------------------

    if (body.action === 'resume') {
      const { data, error } = await supabase.rpc(
        'resume_restaurant',
        {
          p_restaurant_id: restaurantId,
        },
      )

      if (error) {
        console.error(
          '[Dinezy Pause] Resume RPC error:',
          error,
        )

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        action: 'resume',
        restaurant: data,
      })
    }

    // ----------------------------------------
    // INVALID ACTION
    // ----------------------------------------

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 },
    )
  } catch (error) {
    console.error(
      '[Dinezy Pause] Unexpected error:',
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 },
    )
  }
}