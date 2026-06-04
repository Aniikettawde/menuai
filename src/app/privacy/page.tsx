import Link from 'next/link'
import { Shield, Lock, Database, Mail, Phone } from 'lucide-react'

export const metadata = {
title: 'Privacy Policy | Dinezy',
description:
'Learn how Dinezy collects, uses, and protects information.',
}

export default function PrivacyPage() {
return ( <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white"> <section className="mx-auto max-w-5xl px-6 py-24"> <div className="text-center"> <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700"> <Shield size={16} />
Privacy Policy </div>

```
      <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
        Privacy Policy
      </h1>

      <p className="mt-4 text-slate-600">
        Last Updated: June 2026
      </p>
    </div>

    <div className="mt-16 rounded-[32px] border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
      <div className="prose prose-slate max-w-none">
        <p>
          Welcome to Dinezy ("Dinezy", "we", "our", or "us").
          This Privacy Policy explains how we collect, use,
          and protect information when restaurants and customers
          use our platform.
        </p>

        <h2>1. About Dinezy</h2>

        <p>
          Dinezy is a digital restaurant platform that enables
          restaurants to create QR-based digital menus,
          manage menu content, receive waiter requests,
          and provide AI-powered food recommendations
          to customers.
        </p>

        <h2>2. Information We Collect</h2>

        <div className="grid gap-6 md:grid-cols-2 not-prose my-8">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <Database className="mb-4 h-8 w-8 text-blue-600" />
            <h3 className="font-semibold text-slate-900">
              Restaurant Information
            </h3>

            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Restaurant Name</li>
              <li>Email Address</li>
              <li>Password (securely stored)</li>
              <li>Restaurant Logo (optional)</li>
              <li>Restaurant Banner (optional)</li>
              <li>Menu Information</li>
              <li>Dish Photos & Prices</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <Lock className="mb-4 h-8 w-8 text-violet-600" />
            <h3 className="font-semibold text-slate-900">
              Customer Information
            </h3>

            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>No account required</li>
              <li>No payment information collected</li>
              <li>No government ID collected</li>
              <li>No sensitive personal information collected</li>
              <li>Limited technical analytics only</li>
            </ul>
          </div>
        </div>

        <h2>3. Information We Do Not Collect</h2>

        <p>
          Dinezy does not intentionally collect:
        </p>

        <ul>
          <li>Credit card information</li>
          <li>UPI information</li>
          <li>Government identification numbers</li>
          <li>Sensitive personal information</li>
          <li>Bank account details</li>
          <li>Precise location information</li>
        </ul>

        <h2>4. Cookies & Local Storage</h2>

        <p>
          Dinezy may use cookies, browser storage,
          and similar technologies to:
        </p>

        <ul>
          <li>Maintain user sessions</li>
          <li>Improve website performance</li>
          <li>Remember preferences</li>
          <li>Enhance user experience</li>
          <li>Improve platform reliability</li>
        </ul>

        <h2>5. How We Use Information</h2>

        <ul>
          <li>Provide and maintain Dinezy services</li>
          <li>Create restaurant accounts</li>
          <li>Display restaurant menus</li>
          <li>Enable waiter-call functionality</li>
          <li>Generate AI-powered food recommendations</li>
          <li>Improve platform performance</li>
          <li>Provide customer support</li>
        </ul>

        <h2>6. AI Features</h2>

        <p>
          Dinezy may use artificial intelligence to recommend
          dishes, suggest food pairings, improve menu discovery,
          and enhance the customer dining experience.
        </p>

        <p>
          AI recommendations are generated using restaurant-provided
          menu information and are not based on sensitive personal data.
        </p>

        <h2>7. Data Sharing</h2>

        <p>
          We do not sell personal information.
        </p>

        <p>
          Information may be shared only with trusted service providers,
          when required by law, or when necessary to protect
          the security and integrity of Dinezy.
        </p>

        <h2>8. Data Security</h2>

        <p>
          We implement reasonable technical and organizational
          safeguards designed to protect information from
          unauthorized access, disclosure, alteration,
          or destruction.
        </p>

        <h2>9. Data Retention</h2>

        <p>
          Restaurant account information and menu content
          may be retained while an account remains active.
        </p>

        <p>
          Upon account deletion, information may be removed
          within a reasonable period unless retention is
          required by law.
        </p>

        <h2>10. Third-Party Services</h2>

        <p>
          Dinezy may utilize trusted third-party providers
          for authentication, hosting, analytics, storage,
          and infrastructure services.
        </p>

        <h2>11. Children's Privacy</h2>

        <p>
          Dinezy is not directed toward children under
          13 years of age, and we do not knowingly collect
          personal information from children.
        </p>

        <h2>12. Changes To This Policy</h2>

        <p>
          We may update this Privacy Policy from time to time.
          Updated versions will be posted on this page.
        </p>

        <h2>13. Contact Us</h2>

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

    <div className="mt-10 text-center">
      <Link
        href="/"
        className="inline-flex items-center rounded-full border border-slate-200 px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Back to Home
      </Link>
    </div>
  </section>
</main>


)
}
