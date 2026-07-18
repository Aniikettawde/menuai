import Link from 'next/link'
import { Shield, Lock, Database, Mail, Phone } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | Dinezy',
  description:
    'Learn how Dinezy collects, uses, and protects information.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7A2333]/20 bg-[#7A2333]/10 px-4 py-2 text-sm font-medium text-[#7A2333]">
            <Shield size={16} />
            Privacy Policy
          </div>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
            Privacy Policy
          </h1>

          <p className="mt-4 text-slate-600">
            Effective Date: July 18, 2026
          </p>
        </div>

        <div className="mt-16 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm md:p-12">
          <div className="prose prose-slate max-w-none">

            <p>
              Welcome to <strong>Dinezy</strong> ("Dinezy", "we", "our", or
              "us"). This Privacy Policy explains how we collect, use,
              store, disclose, and protect information when restaurants,
              restaurant staff, and customers use the Dinezy platform.
            </p>

            <p>
              By accessing or using Dinezy, you agree to the practices
              described in this Privacy Policy.
            </p>

            <h2>1. About Dinezy</h2>

            <p>
              Dinezy is a cloud-based restaurant growth platform that helps
              restaurants digitize menus, manage QR-based ordering,
              communicate with customers, analyze restaurant performance,
              and improve the dining experience.
            </p>

            <p>Dinezy currently provides features including:</p>

            <ul>
              <li>QR Digital Menus</li>
              <li>AI-powered menu assistance</li>
              <li>Restaurant dashboard</li>
              <li>Menu management</li>
              <li>Restaurant analytics</li>
              <li>Waiter call functionality</li>
              <li>Order management</li>
              <li>Restaurant discovery features</li>
              <li>Customer loyalty and engagement features</li>
              <li>WhatsApp Business integration (where enabled)</li>
            </ul>

            <h2>2. Information We Collect</h2>

            <div className="grid gap-6 md:grid-cols-2 not-prose my-8">

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <Database className="mb-4 h-8 w-8 text-[#7A2333]" />

                <h3 className="font-semibold text-slate-900">
                  Restaurant Information
                </h3>

                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li>Restaurant name</li>
                  <li>Business address</li>
                  <li>Owner name</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                  <li>Subscription information</li>
                  <li>Restaurant logo</li>
                  <li>Restaurant banner</li>
                  <li>Menu categories</li>
                  <li>Menu items</li>
                  <li>Dish photos</li>
                  <li>Pricing information</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <Lock className="mb-4 h-8 w-8 text-[#7A2333]" />

                <h3 className="font-semibold text-slate-900">
                  Customer Information
                </h3>

                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li>Name (if provided)</li>
                  <li>Phone number (when required)</li>
                  <li>Table number</li>
                  <li>Order history</li>
                  <li>Loyalty information</li>
                  <li>Visit history</li>
                  <li>Feedback submitted</li>
                  <li>Limited analytics</li>
                </ul>
              </div>

            </div>

            <h3>Technical Information</h3>

            <p>
              We may automatically collect limited technical information,
              including:
            </p>

            <ul>
              <li>IP address</li>
              <li>Browser type</li>
              <li>Device information</li>
              <li>Operating system</li>
              <li>Language preferences</li>
              <li>Session identifiers</li>
              <li>Website usage analytics</li>
            </ul>

            <h2>3. Information We Do Not Collect</h2>

            <p>Dinezy does not intentionally collect:</p>

            <ul>
              <li>Credit card information</li>
              <li>UPI PINs</li>
              <li>Bank account credentials</li>
              <li>Government-issued identification numbers</li>
              <li>Biometric information</li>
              <li>Sensitive health information</li>
            </ul>

            <h2>4. Cookies & Local Storage</h2>

            <p>
              Dinezy uses cookies, browser storage, and similar
              technologies to:
            </p>

            <ul>
              <li>Maintain secure sessions</li>
              <li>Remember preferences</li>
              <li>Improve platform performance</li>
              <li>Provide analytics</li>
              <li>Enhance user experience</li>
              <li>Improve platform reliability</li>
            </ul>

            <h2>5. How We Use Information</h2>

            <p>We use collected information to:</p>

            <ul>
              <li>Provide Dinezy services</li>
              <li>Create restaurant accounts</li>
              <li>Manage QR menus</li>
              <li>Display restaurant menus</li>
              <li>Manage restaurant dashboards</li>
              <li>Provide analytics</li>
              <li>Support customer loyalty programs</li>
              <li>Generate AI-powered recommendations</li>
              <li>Improve restaurant operations</li>
              <li>Provide technical support</li>
              <li>Prevent fraud and abuse</li>
              <li>Comply with applicable laws</li>
            </ul>

            <h2>6. WhatsApp Business Integration</h2>

            <p>
              Restaurants may choose to connect their own WhatsApp Business
              Account to Dinezy through Meta's Embedded Signup process.
            </p>

            <p>
              When a restaurant authorizes Dinezy:
            </p>

            <ul>
              <li>Dinezy receives authorization from Meta to manage messaging on behalf of the restaurant.</li>
              <li>The restaurant remains the owner of its WhatsApp Business Account.</li>
              <li>Dinezy does not take ownership of restaurant WhatsApp accounts.</li>
              <li>Restaurants may revoke Dinezy's access at any time through Meta.</li>
            </ul>

            <p>
              Where WhatsApp integration is enabled, Dinezy may process:
            </p>

            <ul>
              <li>WhatsApp Business Account ID</li>
              <li>Phone Number ID</li>
              <li>Business Account ID</li>
              <li>Access tokens issued by Meta</li>
              <li>Message delivery status</li>
              <li>Template information</li>
              <li>Customer phone numbers used for messaging</li>
            </ul>

            <p>
              Access tokens are securely stored and used only for services
              authorized by the restaurant.
            </p>

            <h2>7. AI Features</h2>

            <p>
              Dinezy uses artificial intelligence to assist restaurants with:
            </p>

            <ul>
              <li>Menu digitization</li>
              <li>Food recommendations</li>
              <li>Menu categorization</li>
              <li>Restaurant insights</li>
              <li>Customer assistance</li>
            </ul>

            <p>
              AI recommendations are generated using restaurant-provided
              information and are not based on sensitive personal data.
            </p>

            <h2>8. Data Sharing</h2>

            <p>
              Dinezy does <strong>not sell personal information.</strong>
            </p>

            <p>
              Information may be shared only when necessary with trusted
              service providers, including:
            </p>

            <ul>
              <li>Meta Platforms (WhatsApp Business Platform)</li>
              <li>Cloud hosting providers</li>
              <li>Payment providers</li>
              <li>Analytics providers</li>
              <li>Security providers</li>
            </ul>

            <p>
              These providers process information solely to deliver their
              services on our behalf.
            </p>
			            <h2>9. Data Security</h2>

            <p>
              We implement appropriate technical and organizational measures
              designed to protect information from unauthorized access,
              disclosure, alteration, misuse, or destruction.
            </p>

            <p>Security measures include:</p>

            <ul>
              <li>Encrypted HTTPS connections</li>
              <li>Secure authentication systems</li>
              <li>Access controls and permissions</li>
              <li>Secure cloud infrastructure</li>
              <li>Regular platform monitoring</li>
            </ul>

            <p>
              While we strive to protect your information, no internet-based
              service can guarantee absolute security.
            </p>

            <h2>10. Data Retention</h2>

            <p>
              We retain information only for as long as necessary to:
            </p>

            <ul>
              <li>Provide our services</li>
              <li>Maintain restaurant accounts</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes</li>
              <li>Enforce our agreements</li>
            </ul>

            <p>
              Restaurants may request deletion of their account at any time,
              subject to applicable legal and regulatory requirements.
            </p>

            <h2>11. Your Rights</h2>

            <p>
              Depending on your jurisdiction, you may have the right to:
            </p>

            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Restrict certain processing activities</li>
              <li>Object to specific processing activities</li>
              <li>Withdraw consent where applicable</li>
            </ul>

            <p>
              Requests regarding your information may be submitted using the
              contact details below.
            </p>

            <h2>12. Third-Party Services</h2>

            <p>
              Dinezy integrates with trusted third-party platforms and service
              providers to deliver certain features.
            </p>

            <p>These services may include:</p>

            <ul>
              <li>Meta (WhatsApp Business Platform)</li>
              <li>Supabase</li>
              <li>Google services</li>
              <li>Payment gateways</li>
              <li>Cloud infrastructure providers</li>
            </ul>

            <p>
              These providers have their own privacy policies governing the
              processing of data handled through their services.
            </p>

            <h2>13. Children's Privacy</h2>

            <p>
              Dinezy is not intended for children under the age required by
              applicable law, and we do not knowingly collect personal
              information from children.
            </p>

            <h2>14. International Data Transfers</h2>

            <p>
              Information processed through Dinezy may be stored or processed
              in countries where our infrastructure or service providers
              operate.
            </p>

            <p>
              Where required by law, appropriate safeguards are implemented
              for international transfers of personal information.
            </p>

            <h2>15. Changes to This Privacy Policy</h2>

            <p>
              We may update this Privacy Policy from time to time to reflect
              changes in our services, legal requirements, or operational
              practices.
            </p>

            <p>
              When material changes are made, the updated Privacy Policy will
              be published on this page with a revised effective date.
            </p>

            <h2>16. Contact Us</h2>

            <p>
              If you have any questions about this Privacy Policy or how
              Dinezy handles your information, please contact us.
            </p>

            <div className="not-prose mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">

              <div className="flex items-center gap-3 text-slate-700">
                <Mail size={18} />

                <a
                  href="mailto:support@dinezy.in"
                  className="font-medium transition hover:text-[#7A2333]"
                >
                  support@dinezy.in
                </a>
              </div>

              <div className="mt-4 flex items-center gap-3 text-slate-700">
                <Phone size={18} />

                <a
                  href="tel:+918605123549"
                  className="font-medium transition hover:text-[#7A2333]"
                >
                  +91 86051 23549
                </a>
              </div>

              <div className="mt-4 text-slate-700">
                <strong>Website:</strong>{' '}
                <a
                  href="https://dinezy.in"
                  className="font-medium transition hover:text-[#7A2333]"
                >
                  https://dinezy.in
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