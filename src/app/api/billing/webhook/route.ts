// src/app/api/billing/webhook/route.ts

// Razorpay subscription webhook — source of truth for billing state.
// Dashboard → Settings → Webhooks → URL:
// https://YOUR_DOMAIN/api/billing/webhook
//
// Events:
// subscription.authenticated
// subscription.activated
// subscription.charged
// subscription.cancelled
// subscription.completed
// subscription.pending
// subscription.halted
// payment.failed

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

import {
  PLAN_ID,
  TRIAL_DAYS,
  getPlanAmountPaise,
  normalizePlanId,
  type BillingCycle,
} from '@/lib/billing-plans'

import {
  getServiceClient,
  publishRestaurantForOwner,
} from '@/lib/billing-auth'

function addPeriod(
  from: Date,
  cycle: BillingCycle,
): Date {
  const end = new Date(from)

  if (cycle === 'yearly') {
    end.setFullYear(
      end.getFullYear() + 1,
    )
  } else {
    end.setMonth(
      end.getMonth() + 1,
    )
  }

  return end
}

/**
 * Dinezy partner commission.
 *
 * Current business rule:
 * - 10%
 * - Commission is paid once for a referred restaurant's
 *   first successful qualifying subscription payment.
 * - Yearly plan qualifies.
 * - ₹8,999 yearly => ₹900 commission after rounding.
 *
 * You can later move this into a database/config table.
 */
const PARTNER_COMMISSION_RATE = 0.10

function calculatePartnerCommission(
  amountPaise: number,
): number {
  const amountRupees =
    amountPaise / 100

  return Math.round(
    amountRupees *
      PARTNER_COMMISSION_RATE,
  )
}

export async function POST(
  req: NextRequest,
) {
  try {
    const rawBody =
      await req.text()

    const signature =
      req.headers.get(
        'x-razorpay-signature',
      ) ?? ''

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error(
        'RAZORPAY_WEBHOOK_SECRET missing',
      )

      return NextResponse.json(
        { error: 'Misconfigured' },
        { status: 500 },
      )
    }

    const expectedSig =
      crypto
        .createHmac(
          'sha256',
          webhookSecret,
        )
        .update(rawBody)
        .digest('hex')

    if (
      expectedSig !==
      signature
    ) {
      console.error(
        'Webhook signature mismatch',
      )

      return NextResponse.json(
        {
          error:
            'Invalid signature',
        },
        { status: 400 },
      )
    }

    const event =
      JSON.parse(rawBody)

    const sb =
      getServiceClient()

    console.log(
      '[webhook] event:',
      event.event,
    )

    switch (event.event) {
      // =========================================================
      // PAYMENT METHOD AUTHENTICATED / TRIAL START
      // =========================================================

   case 'subscription.authenticated':
case 'subscription.pending': {
  const rzpSub =
    event.payload
      .subscription.entity

  const userId =
    rzpSub.notes
      ?.user_id as
      | string
      | undefined

  if (!userId) break

  const planId =
    normalizePlanId(
      rzpSub.notes?.plan_id,
    )

  const billingCycle =
    (rzpSub.notes
      ?.billing_cycle as BillingCycle) ||
    'monthly'

  const now =
    new Date()

  // Check whether this user already used their free trial
  // (via /api/billing/start-trial or an earlier Razorpay
  // authorization) before overwriting with a fresh trial window.
  const { data: existingSub } = await sb
    .from('subscriptions')
    .select('trial_start')
    .eq('user_id', userId)
    .maybeSingle()

  const alreadyHadTrial = Boolean(
    existingSub?.trial_start,
  )

  if (alreadyHadTrial) {
    // Trial already used — don't stamp a fresh trial_end.
    // Leave as 'pending' until subscription.activated/charged
    // resolves it to 'active' (which should happen within
    // minutes, since start_at was set to "now" in this case).
    await sb
      .from('subscriptions')
      .upsert(
        {
          user_id:
            userId,
          plan: 'pending',
          plan_id:
            planId,
          billing_cycle:
            billingCycle,
          amount_paise:
            getPlanAmountPaise(
              planId,
              billingCycle,
            ),
          razorpay_subscription_id:
            rzpSub.id,
        },
        {
          onConflict:
            'user_id',
        },
      )
  } else {
    const trialEnd =
      new Date(now)

    trialEnd.setDate(
      trialEnd.getDate() +
        TRIAL_DAYS,
    )

    await sb
      .from('subscriptions')
      .upsert(
        {
          user_id:
            userId,
          plan: 'trial',
          plan_id:
            planId,
          billing_cycle:
            billingCycle,
          amount_paise:
            getPlanAmountPaise(
              planId,
              billingCycle,
            ),
          razorpay_subscription_id:
            rzpSub.id,
          trial_start:
            now.toISOString(),
          trial_end:
            trialEnd.toISOString(),
        },
        {
          onConflict:
            'user_id',
        },
      )
  }

  try {
    await publishRestaurantForOwner(
      userId,
    )
  } catch (e) {
    console.warn(
      'publish on authenticated:',
      e,
    )
  }

  break
}

      // =========================================================
      // SUBSCRIPTION ACTIVATED
      // =========================================================

      case 'subscription.activated': {
        const rzpSub =
          event.payload
            .subscription.entity

        const userId =
          rzpSub.notes
            ?.user_id as
            | string
            | undefined

        if (!userId) break

        const planId =
          normalizePlanId(
            rzpSub.notes?.plan_id,
          )

        const billingCycle =
          (rzpSub.notes
            ?.billing_cycle as BillingCycle) ||
          'monthly'

        const now =
          new Date()

        const chargeAt =
          rzpSub.charge_at
            ? rzpSub.charge_at *
              1000
            : null

        const stillTrial =
          chargeAt !== null &&
          chargeAt >
            Date.now()

        if (stillTrial) {
          const trialEnd =
            new Date(chargeAt)

          await sb
            .from('subscriptions')
            .upsert(
              {
                user_id:
                  userId,
                plan: 'trial',
                plan_id:
                  planId,
                billing_cycle:
                  billingCycle,
                amount_paise:
                  getPlanAmountPaise(
                    planId,
                    billingCycle,
                  ),
                razorpay_subscription_id:
                  rzpSub.id,
                trial_start:
                  now.toISOString(),
                trial_end:
                  trialEnd.toISOString(),
              },
              {
                onConflict:
                  'user_id',
              },
            )
        } else {
          const end =
            addPeriod(
              now,
              billingCycle,
            )

          await sb
            .from('subscriptions')
            .upsert(
              {
                user_id:
                  userId,
                plan: 'active',
                plan_id:
                  planId,
                billing_cycle:
                  billingCycle,
                amount_paise:
                  getPlanAmountPaise(
                    planId,
                    billingCycle,
                  ),
                razorpay_subscription_id:
                  rzpSub.id,
                current_period_start:
                  now.toISOString(),
                current_period_end:
                  end.toISOString(),
              },
              {
                onConflict:
                  'user_id',
              },
            )
        }

        try {
          await publishRestaurantForOwner(
            userId,
          )
        } catch (e) {
          console.warn(
            'publish on activated:',
            e,
          )
        }

        break
      }

      // =========================================================
      // SUCCESSFUL PAYMENT
      //
      // THIS IS WHERE PARTNER COMMISSION IS CREATED.
      // =========================================================

      case 'subscription.charged': {
        const rzpSub =
          event.payload
            .subscription.entity

        const payment =
          event.payload
            .payment?.entity

        const userId =
          rzpSub.notes
            ?.user_id as
            | string
            | undefined

        if (!userId) break

        const billingCycle =
          (rzpSub.notes
            ?.billing_cycle as BillingCycle) ||
          'monthly'

        const planId =
          normalizePlanId(
            rzpSub.notes?.plan_id,
          )

        const now =
          new Date()

        const end =
          addPeriod(
            now,
            billingCycle,
          )

        const amountPaise =
          payment?.amount ??
          getPlanAmountPaise(
            planId,
            billingCycle,
          )

        // -------------------------------------------------------
        // 1. Update subscription
        // -------------------------------------------------------

        const {
          error: subscriptionUpdateError,
        } = await sb
          .from('subscriptions')
          .update({
            plan: 'active',
            plan_id:
              planId,
            billing_cycle:
              billingCycle,
            amount_paise:
              amountPaise,
            razorpay_payment_id:
              payment?.id ??
              null,
            razorpay_subscription_id:
              rzpSub.id,
            current_period_start:
              now.toISOString(),
            current_period_end:
              end.toISOString(),
          })
          .eq(
            'user_id',
            userId,
          )

        if (
          subscriptionUpdateError
        ) {
          console.error(
            '[webhook] subscription update failed:',
            subscriptionUpdateError,
          )
        }

        // -------------------------------------------------------
        // 2. Find subscription row
        // -------------------------------------------------------

        const {
          data: sub,
        } = await sb
          .from('subscriptions')
          .select('id')
          .eq(
            'user_id',
            userId,
          )
          .maybeSingle()

        // -------------------------------------------------------
        // 3. Store payment history
        // -------------------------------------------------------

        if (payment?.id) {
          const {
            data: dup,
          } = await sb
            .from(
              'payment_history',
            )
            .select('id')
            .eq(
              'razorpay_payment_id',
              payment.id,
            )
            .maybeSingle()

          if (!dup) {
            await sb
              .from(
                'payment_history',
              )
              .insert({
                user_id:
                  userId,
                subscription_id:
                  sub?.id ??
                  null,
                razorpay_order_id:
                  null,
                razorpay_payment_id:
                  payment.id,
                amount_paise:
                  amountPaise,
                currency:
                  'INR',
                status:
                  'paid',
              })
          }
        }

        // -------------------------------------------------------
        // 4. Publish restaurant
        // -------------------------------------------------------

        try {
          await publishRestaurantForOwner(
            userId,
          )
        } catch (e) {
          console.warn(
            'publish on charged:',
            e,
          )
        }

        // =======================================================
        // 5. PARTNER COMMISSION
        // =======================================================

        try {
          /**
           * Current partner rule:
           *
           * Commission is earned on yearly subscriptions.
           *
           * We don't pay commission on monthly plans.
           *
           * Change this later if you want monthly commission too.
           */
          if (
            billingCycle ===
            'yearly'
          ) {
            // ---------------------------------------------------
            // Find restaurant attribution for this owner
            // ---------------------------------------------------

            const {
              data: attribution,
              error:
                attributionError,
            } = await sb
              .from(
                'partner_restaurant_attributions',
              )
              .select(
                `
                  id,
                  partner_id,
                  restaurant_id,
                  status
                `,
              )
              .eq(
                'restaurant_owner_id',
                userId,
              )
              .not(
                'restaurant_id',
                'is',
                null,
              )
              .maybeSingle()

            if (
              attributionError
            ) {
              console.error(
                '[partner commission] attribution lookup failed:',
                attributionError,
              )
            } else if (
              attribution
                ?.partner_id &&
              attribution
                ?.restaurant_id
            ) {
              // -------------------------------------------------
              // Calculate commission
              // -------------------------------------------------

              const commissionAmount =
                calculatePartnerCommission(
                  amountPaise,
                )

              // -------------------------------------------------
              // Determine settlement date
              // -------------------------------------------------

              const eligibleAt =
                new Date(
                  now.getTime() +
                    30 *
                      24 *
                      60 *
                      60 *
                      1000,
                )

              // -------------------------------------------------
              // Insert commission.
              //
              // Unique(partner_id, restaurant_id)
              // prevents duplicate commissions for renewals
              // or duplicate Razorpay webhook deliveries.
              // -------------------------------------------------

              const {
                error:
                  commissionError,
              } = await sb
                .from(
                  'partner_commissions',
                )
                .upsert(
                  {
                    partner_id:
                      attribution.partner_id,

                    restaurant_id:
                      attribution.restaurant_id,

                    subscription_id:
                      sub?.id ??
                      null,

                    amount:
                      commissionAmount,

                    status:
                      'pending',

                    earned_at:
                      now.toISOString(),

                    eligible_at:
                      eligibleAt.toISOString(),

                    settled_at:
                      null,
                  },
                  {
                    onConflict:
                      'partner_id,restaurant_id',
                    ignoreDuplicates:
                      true,
                  },
                )

              if (
                commissionError
              ) {
                console.error(
                  '[partner commission] insert failed:',
                  commissionError,
                )
              } else {
                console.log(
                  '[partner commission] created:',
                  {
                    partnerId:
                      attribution.partner_id,
                    restaurantId:
                      attribution.restaurant_id,
                    amount:
                      commissionAmount,
                    eligibleAt:
                      eligibleAt.toISOString(),
                  },
                )

                // -------------------------------------------------
                // Mark attribution active
                // -------------------------------------------------

                await sb
                  .from(
                    'partner_restaurant_attributions',
                  )
                  .update({
                    status:
                      'active',
                    onboarding_progress:
                      100,
                    updated_at:
                      now.toISOString(),
                  })
                  .eq(
                    'id',
                    attribution.id,
                  )
              }
            } else {
              console.log(
                '[partner commission] no partner attribution for:',
                userId,
              )
            }
          }
        } catch (partnerError) {
          /**
           * VERY IMPORTANT:
           *
           * Partner commission failure must NOT make the
           * Razorpay webhook fail.
           *
           * Restaurant billing remains successful even if
           * partner attribution has a temporary problem.
           */
          console.error(
            '[partner commission] unexpected error:',
            partnerError,
          )
        }

        break
      }

      // =========================================================
      // CANCELLED
      // =========================================================

      case 'subscription.cancelled': {
        const rzpSub =
          event.payload
            .subscription.entity

        const userId =
          rzpSub.notes
            ?.user_id as
            | string
            | undefined

        if (!userId) break

        await sb
          .from('subscriptions')
          .update({
            plan:
              'cancelled',
          })
          .eq(
            'user_id',
            userId,
          )

        break
      }

      // =========================================================
      // COMPLETED / HALTED
      // =========================================================

      case 'subscription.completed':
      case 'subscription.halted': {
        const rzpSub =
          event.payload
            .subscription.entity

        const userId =
          rzpSub.notes
            ?.user_id as
            | string
            | undefined

        if (!userId) break

        await sb
          .from('subscriptions')
          .update({
            plan:
              'expired',
          })
          .eq(
            'user_id',
            userId,
          )

        break
      }

      // =========================================================
      // FAILED PAYMENT
      // =========================================================

      case 'payment.failed': {
        const payment =
          event.payload
            .payment.entity

        const userId =
          (payment.notes
            ?.user_id as
            | string
            | undefined) ??
          null

        if (!userId) break

        const {
          data: sub,
        } = await sb
          .from('subscriptions')
          .select('id')
          .eq(
            'user_id',
            userId,
          )
          .maybeSingle()

        await sb
          .from('payment_history')
          .insert({
            user_id:
              userId,
            subscription_id:
              sub?.id ??
              null,
            razorpay_order_id:
              null,
            razorpay_payment_id:
              payment.id,
            amount_paise:
              payment.amount,
            currency:
              payment.currency ??
              'INR',
            status:
              'failed',
            failure_reason:
              payment.error_description ??
              'Payment failed',
          })

        break
      }

      // =========================================================
      // DEFAULT
      // =========================================================

      default:
        console.log(
          '[webhook] unhandled event:',
          event.event,
        )
    }

    return NextResponse.json({
      received: true,
    })
  } catch (err) {
    console.error(
      'Webhook error:',
      err,
    )

    return NextResponse.json(
      {
        error:
          'Webhook error',
      },
      { status: 500 },
    )
  }
}