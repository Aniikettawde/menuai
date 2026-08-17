import Link from 'next/link'
import {
FileText,
Scale,
Shield,
AlertTriangle,
Phone,
Mail,
} from 'lucide-react'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const metadata = {
title: 'Terms & Conditions | Dinezy',
description:
'Terms and Conditions governing the use of the Dinezy platform and services.',
}

export default function TermsPage() {
return ( <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white"> <section className="mx-auto max-w-5xl px-6 py-24"> <div className="text-center"> <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700"> <FileText size={16} />
Terms & Conditions </div>

```
      <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
        Terms & Conditions
      </h1>

      <p className="mt-4 text-slate-600">
        Last Updated: June 2026
      </p>
    </div>

    <div className="mt-16 rounded-[32px] border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
      <div className="prose prose-slate max-w-none">
        <p>
          Welcome to Dinezy. These Terms & Conditions govern your
          access to and use of the Dinezy platform, website,
          dashboard, QR menus, AI features, and related services.
        </p>

        <p>
          By accessing or using Dinezy, you agree to be bound by
          these Terms & Conditions.
        </p>

        <h2>1. About Dinezy</h2>

        <p>
          Dinezy is a Software-as-a-Service (SaaS) platform that
          enables restaurants to create and manage digital menus,
          QR-based ordering experiences, waiter call systems,
          AI-powered food recommendations, and related restaurant
          management features.
        </p>

        <h2>2. Account Registration</h2>

        <p>
          To access certain features, restaurants may be required
          to create an account.
        </p>

        <p>
          You agree to:
        </p>

        <ul>
          <li>Provide accurate information</li>
          <li>Keep login credentials secure</li>
          <li>Maintain updated account information</li>
          <li>Accept responsibility for account activity</li>
        </ul>

        <h2>3. Subscription Services</h2>

        <p>
          Certain Dinezy features are available through paid
          subscription plans.
        </p>

        <p>
          Subscription pricing, features, and limits may be updated
          from time to time. Changes will not affect active billing
          periods already paid for.
        </p>

        <h2>4. Free Trial</h2>

        <p>
          Dinezy may provide a free trial period to allow restaurants
          to evaluate the platform.
        </p>

        <p>
          At the end of the trial period, continued access to premium
          features may require an active subscription.
        </p>

        <h2>5. Restaurant Content</h2>

        <p>
          Restaurants are solely responsible for all content uploaded
          to Dinezy, including:
        </p>

        <ul>
          <li>Menus</li>
          <li>Prices</li>
          <li>Images</li>
          <li>Descriptions</li>
          <li>Promotional content</li>
          <li>Business information</li>
        </ul>

        <p>
          Dinezy is not responsible for inaccuracies, outdated
          information, or misleading content provided by restaurants.
        </p>

        <h2>6. AI Recommendations</h2>

        <div className="not-prose my-8 rounded-3xl border border-blue-100 bg-blue-50 p-6">
          <div className="flex gap-3">
            <Shield className="mt-1 h-5 w-5 text-blue-600" />

            <div>
              <h3 className="font-semibold text-slate-900">
                Important Notice
              </h3>

              <p className="mt-2 text-slate-600">
                AI-generated recommendations and food pairings are
                provided for informational purposes only. Dinezy does
                not guarantee dietary suitability, allergen safety,
                nutritional accuracy, or customer satisfaction.
              </p>
            </div>
          </div>
        </div>

        <h2>7. Acceptable Use</h2>

        <p>
          Users may not:
        </p>

        <ul>
          <li>Use Dinezy for unlawful purposes</li>
          <li>Upload misleading or fraudulent content</li>
          <li>Attempt unauthorized access to systems</li>
          <li>Disrupt platform operations</li>
          <li>Reverse engineer platform functionality</li>
          <li>Use the platform to distribute malicious software</li>
        </ul>

        <h2>8. Intellectual Property</h2>

        <p>
          Dinezy and its associated branding, software,
          interfaces, designs, and technology remain the exclusive
          property of Dinezy.
        </p>

        <p>
          Restaurants retain ownership of their own uploaded menu
          content and images.
        </p>

        <h2>9. Service Availability</h2>

        <p>
          While we strive to provide reliable service, Dinezy does
          not guarantee uninterrupted availability.
        </p>

        <p>
          Maintenance, upgrades, technical issues, or third-party
          service disruptions may occasionally affect availability.
        </p>

        <h2>10. Limitation of Liability</h2>

        <div className="not-prose my-8 rounded-3xl border border-amber-100 bg-amber-50 p-6">
          <div className="flex gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-amber-600" />

            <div>
              <h3 className="font-semibold text-slate-900">
                Liability Limitation
              </h3>

              <p className="mt-2 text-slate-600">
                To the maximum extent permitted by law, Dinezy shall
                not be liable for indirect, incidental, special,
                consequential, or business-related damages arising
                from the use of the platform.
              </p>
            </div>
          </div>
        </div>

        <h2>11. Suspension & Termination</h2>

        <p>
          We reserve the right to suspend or terminate accounts that:
        </p>

        <ul>
          <li>Violate these Terms</li>
          <li>Engage in fraudulent activity</li>
          <li>Abuse platform resources</li>
          <li>Create security risks</li>
        </ul>

        <h2>12. Refunds & Billing</h2>

        <p>
          Subscription billing and refunds are governed by our
          Refund Policy.
        </p>

        <p>
          By subscribing, you acknowledge that you have reviewed
          and accepted the applicable billing terms.
        </p>

        <h2>13. Changes To These Terms</h2>

        <p>
          Dinezy may update these Terms & Conditions at any time.
          Updated versions will be posted on this page with a revised
          effective date.
        </p>

        <h2>14. Governing Law</h2>

        <p>
          These Terms shall be governed and interpreted in accordance
          with the laws of India.
        </p>

        <h2>15. Contact Information</h2>

        <div className="not-prose mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center gap-3 text-slate-700">
            <Mail size={18} />
            <a
              href="mailto:anikettawdee@gmail.com"
              className="font-medium hover:text-blue-600"
            >
              anikettawdee@gmail.com
            </a>
          </div>

          <div className="mt-4 flex items-center gap-3 text-slate-700">
            <Phone size={18} />
            <a
              href="tel:+918605123549"
              className="font-medium hover:text-blue-600"
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
        <Scale size={16} />
        Back to Home
      </Link>
    </div>
  </section>
</main>


)
}
