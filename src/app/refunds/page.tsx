import Link from 'next/link'
import { CreditCard, RefreshCcw, AlertCircle, Phone, Mail } from 'lucide-react'

export const metadata = {
  title: 'Refund Policy | Dinezy',
  description:
    'Learn about Dinezy subscription billing, cancellations, and refund policies.',
}

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <RefreshCcw size={16} />
            Refund Policy
          </div>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
            Refund Policy
          </h1>

          <p className="mt-4 text-slate-600">
            Last Updated: June 2026
          </p>
        </div>

        <div className="mt-16 rounded-[32px] border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
          <div className="prose prose-slate max-w-none [&_h2]:text-slate-900 [&_h3]:text-slate-900 [&_p]:text-slate-700 [&_li]:text-slate-700 [&_strong]:text-slate-900">
            <p className="text-slate-700">
              Thank you for choosing Dinezy.
            </p>

            <p className="text-slate-700">
              Dinezy is a subscription-based software platform that helps
              restaurants manage QR menus, AI-powered recommendations,
              waiter calling, menu management, and customer experiences.
            </p>

            <h2 className="text-slate-900">1. Free Trial</h2>

            <div className="not-prose my-8 rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                30-Day Free Trial
              </h3>

              <p className="mt-2 text-slate-700">
                Dinezy provides a free 30-day trial period so restaurants
                can evaluate the platform before purchasing a subscription.
              </p>

              <p className="mt-3 text-slate-700">
                No credit card, debit card, or UPI payment is required
                during the trial period.
              </p>
            </div>

            <h2 className="text-slate-900">2. Setup Fee</h2>

            <p className="text-slate-700">
              A one-time, non-refundable setup fee of ₹499 applies when a
              restaurant activates a paid subscription. This fee covers
              onboarding, account configuration, and initial setup of the
              Dinezy platform, and is charged regardless of the
              subscription plan selected.
            </p>

            <h2 className="text-slate-900">3. Subscription Payments</h2>

            <p className="text-slate-700">
              Once a subscription is purchased and activated,
              payments are generally non-refundable.
            </p>

            <p className="text-slate-700">
              Because Dinezy is a digital software service that provides
              immediate access to platform features, refunds are not
              provided for:
            </p>

            <ul>
              <li className="text-slate-700">Partial subscription periods</li>
              <li className="text-slate-700">Unused subscription time</li>
              <li className="text-slate-700">Restaurant inactivity</li>
              <li className="text-slate-700">Business closure or operational changes</li>
              <li className="text-slate-700">Failure to use the platform after purchase</li>
              <li className="text-slate-700">Change of mind after activation</li>
              <li className="text-slate-700">The one-time setup fee, under any circumstances</li>
            </ul>

            <h2 className="text-slate-900">4. Eligible Refund Situations</h2>

            <p className="text-slate-700">
              Refund requests may be reviewed on a case-by-case basis
              under limited circumstances, including:
            </p>

            <ul>
              <li className="text-slate-700">Duplicate charges</li>
              <li className="text-slate-700">Accidental multiple payments</li>
              <li className="text-slate-700">Incorrect billing caused by Dinezy</li>
              <li className="text-slate-700">Subscription activation failures that cannot be resolved</li>
            </ul>

            <h2 className="text-slate-900">5. Subscription Cancellation</h2>

            <p className="text-slate-700">
              Restaurants may cancel future subscription renewals at any time.
            </p>

            <p className="text-slate-700">
              Cancellation prevents future billing but does not result
              in a refund for the current subscription period, except as
              described below for Annual Plans.
            </p>

            <p className="text-slate-700">
              Access to the platform will continue until the end of the
              active billing cycle.
            </p>

            <h2 className="text-slate-900">6. Annual Plans</h2>

            <p className="text-slate-700">
              Annual subscriptions receive discounted pricing compared
              to monthly plans.
            </p>

            <div className="not-prose my-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                60-Day Cancellation Window
              </h3>

              <p className="mt-2 text-slate-700">
                Restaurants on an Annual Plan have 60 days from the date of
                activation to cancel. If cancelled within this 60-day
                window, a pro-rated refund will be issued for the unused
                portion of the annual subscription.
              </p>

              <p className="mt-3 text-slate-700">
                After the 60-day window has passed, the annual subscription
                becomes non-refundable, and no refund — pro-rated or
                otherwise — will be issued for the remainder of the term.
              </p>

              <p className="mt-3 text-slate-700">
                The one-time setup fee is not included in any pro-rated
                refund calculation.
              </p>
            </div>

            <h2 className="text-slate-900">7. Chargebacks</h2>

            <div className="not-prose my-8 rounded-3xl border border-amber-100 bg-amber-50 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />

                <div>
                  <h3 className="font-semibold text-slate-900">
                    Before Filing a Chargeback
                  </h3>

                  <p className="mt-2 text-slate-700">
                    If you believe a charge was made incorrectly,
                    please contact us first so we can investigate
                    and resolve the issue as quickly as possible.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-slate-900">8. Contact Us</h2>

            <p className="text-slate-700">
              For billing questions, refund requests, or subscription support,
              please contact us using the details below.
            </p>

            <div className="not-prose mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-3 text-slate-700">
                <Mail size={18} />
                <a
                  href="mailto:anikettawdee@gmail.com"
                  className="font-medium text-slate-700 hover:text-blue-600"
                >
                  anikettawdee@gmail.com
                </a>
              </div>

              <div className="mt-4 flex items-center gap-3 text-slate-700">
                <Phone size={18} />
                <a
                  href="tel:+918605123549"
                  className="font-medium text-slate-700 hover:text-blue-600"
                >
                  +91 86051 23549
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <CreditCard size={16} />
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  )
}
