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

function daysUntil(date: string) {
  const diff =
    new Date(date).getTime() -
    Date.now()

  return Math.max(
    0,
    Math.ceil(
      diff /
        (1000 * 60 * 60 * 24),
    ),
  )
}

export async function GET(
  req: NextRequest,
) {
  try {
    const response =
      NextResponse.next()

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
    } =
      await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const {
      data: partner,
      error: partnerError,
    } = await admin
      .from('partners')
      .select(
        'id, full_name, city, whatsapp, email, referral_code, status',
      )
      .eq(
        'auth_user_id',
        user.id,
      )
      .single()

    if (
      partnerError ||
      !partner
    ) {
      return NextResponse.json(
        {
          error:
            'Partner account not found.',
        },
        { status: 403 },
      )
    }

    let {
      data: links,
      error: linksError,
    } = await admin
      .from(
        'partner_restaurant_attributions',
      )
      .select('*')
      .eq(
        'partner_id',
        partner.id,
      )
      .order('created_at', {
        ascending: false,
      })

    if (linksError) {
      console.error(
        '[partner dashboard links]',
        linksError,
      )

      return NextResponse.json(
        {
          error:
            'Could not load restaurants.',
        },
        { status: 500 },
      )
    }

    const restaurantIds =
      (links ?? [])
        .map(
          (row) =>
            row.restaurant_id,
        )
        .filter(Boolean)

    const ownerIds =
      (links ?? [])
        .map(
          (row) =>
            row.restaurant_owner_id,
        )
        .filter(Boolean)

    const [
      restaurantsResult,
      subscriptionsResult,
      commissionsResult,
    ] = await Promise.all([
      restaurantIds.length
        ? admin
            .from('restaurants')
            .select(
              'id, owner_id, name, slug, logo_url, cover_url, total_tables, is_active, created_at',
            )
            .in(
              'id',
              restaurantIds,
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      ownerIds.length
        ? admin
            .from('subscriptions')
            .select(
              'user_id, plan, trial_end, current_period_end',
            )
            .in(
              'user_id',
              ownerIds,
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      admin
        .from('partner_commissions')
        .select('*')
        .eq(
          'partner_id',
          partner.id,
        ),
    ])

    const restaurantsById =
      new Map(
        (
          restaurantsResult.data ??
          []
        ).map((row) => [
          row.id,
          row,
        ]),
      )

    const subscriptionsByOwner =
      new Map(
        (
          subscriptionsResult.data ??
          []
        ).map((row) => [
          row.user_id,
          row,
        ]),
      )

    // Auto-settle commissions whose
    // 30-day hold has elapsed.
    const now =
      new Date().toISOString()

    const pendingToSettle =
      (
        commissionsResult.data ??
        []
      ).filter(
        (commission) =>
          commission.status ===
            'pending' &&
          new Date(
            commission.eligible_at,
          ).getTime() <=
            Date.now(),
      )

    if (
      pendingToSettle.length
    ) {
      await Promise.all(
        pendingToSettle.map(
          (commission) =>
            admin
              .from(
                'partner_commissions',
              )
              .update({
                status: 'settled',
                settled_at:
                  now,
              })
              .eq(
                'id',
                commission.id,
              ),
        ),
      )

      ;(commissionsResult.data ?? [])
        .forEach(
          (commission) => {
            if (
              pendingToSettle.some(
                (item) =>
                  item.id ===
                  commission.id,
              )
            ) {
              commission.status =
                'settled'
              commission.settled_at =
                now
            }
          },
        )
    }

    const restaurants = (
      links ?? []
    ).map((link) => {
      const restaurant =
        link.restaurant_id
          ? restaurantsById.get(
              link.restaurant_id,
            )
          : null

      const subscription =
        subscriptionsByOwner.get(
          link.restaurant_owner_id,
        )

      let status =
        link.status

      if (
        subscription &&
        [
          'active',
          'paid',
          'subscription',
        ].includes(
          subscription.plan,
        )
      ) {
        status = 'active'
      }

      return {
        id: link.id,
        restaurantId:
          link.restaurant_id,
        name:
          restaurant?.name ??
          'Restaurant setup',
        slug:
          restaurant?.slug ??
          null,
        logoUrl:
          restaurant?.logo_url ??
          null,
        status,
        progress:
          restaurant
            ? Math.max(
                link.onboarding_progress,
                status ===
                  'active'
                  ? 100
                  : link.onboarding_progress,
              )
            : link.onboarding_progress,
        createdAt:
          link.created_at,
        paymentPlan:
          subscription?.plan ??
          null,
        subscriptionEnds:
          subscription?.current_period_end ??
          null,
      }
    })

    const commissions =
      commissionsResult.data ??
      []

    const totalEarned =
      commissions.reduce(
        (
          sum,
          commission,
        ) =>
          sum +
          Number(
            commission.amount,
          ),
        0,
      )

    const pendingCommission =
      commissions
        .filter(
          (commission) =>
            commission.status ===
            'pending',
        )
        .reduce(
          (
            sum,
            commission,
          ) =>
            sum +
            Number(
              commission.amount,
            ),
          0,
        )

    const settledCommission =
      commissions
        .filter(
          (commission) =>
            commission.status ===
            'settled',
        )
        .reduce(
          (
            sum,
            commission,
          ) =>
            sum +
            Number(
              commission.amount,
            ),
          0,
        )

    return NextResponse.json({
      partner,
      stats: {
        totalRestaurants:
          restaurants.length,
        activeRestaurants:
          restaurants.filter(
            (r) =>
              r.status ===
              'active',
          ).length,
        inSetup:
          restaurants.filter(
            (r) =>
              r.status ===
                'account_created' ||
              r.status ===
                'setup_in_progress',
          ).length,
        totalEarned,
        pendingCommission,
        settledCommission,
      },
      restaurants,
      commissions: commissions.map(
        (commission) => ({
          ...commission,
          settleInDays:
            commission.status ===
            'pending'
              ? daysUntil(
                  commission.eligible_at,
                )
              : 0,
        }),
      ),
    })
  } catch (error) {
    console.error(
      '[partner dashboard]',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Internal server error',
      },
      { status: 500 },
    )
  }
}