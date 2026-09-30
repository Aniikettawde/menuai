import type { Metadata } from 'next'
import Link from 'next/link'

import Header from '@/components/Header'
import QrGeneratorClient from './QrGeneratorClient'

const SITE_URL = 'https://dinezy.in'
const PAGE_PATH = '/qr-generator'
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title:
    'Free QR Code Generator — Create Custom QR Codes | Dinezy',

  description:
    'Create free QR codes for links, WhatsApp, WiFi, UPI, email, phone, SMS and text. Customize colors, shapes and logos, then download or print instantly.',

  alternates: {
    canonical: PAGE_PATH,
  },

  openGraph: {
    title:
      'Free QR Code Generator — Create Custom QR Codes | Dinezy',

    description:
      'Create free QR codes for links, WhatsApp, WiFi, UPI, email, phone, SMS and text. Customize colors, shapes and logos, then download or print instantly.',

    url: PAGE_URL,
    siteName: 'Dinezy',
    type: 'website',

    images: [
      {
        url: '/og/qr-generator-og.png',
        width: 1200,
        height: 630,
        alt:
          'Dinezy free QR code generator with custom colors, logos and bulk generation',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',

    title:
      'Free QR Code Generator — Create Custom QR Codes | Dinezy',

    description:
      'Create free QR codes for links, WhatsApp, WiFi, UPI, email, phone, SMS and text.',

    images: ['/og/qr-generator-og.png'],
  },

  robots: {
    index: true,
    follow: true,
  },
}

const pageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${PAGE_URL}#webpage`,
  url: PAGE_URL,
  name:
    'Free QR Code Generator — Create Custom QR Codes | Dinezy',
  description:
    'Create free QR codes for links, WhatsApp, WiFi, UPI, email, phone, SMS and text. Customize colors, shapes and logos, then download or print instantly.',
  isPartOf: {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Dinezy',
  },
  about: {
    '@type': 'Thing',
    name: 'QR code generator',
  },
  mainEntity: {
    '@type': 'Thing',
    name: 'Free QR Code Generator',
  },
}

const STEPS = [
  {
    n: '01',
    title: 'Pick a content type',
    body:
      'Choose what the code should open — a link, WhatsApp chat, WiFi network, UPI payment, email, SMS, phone number, or plain text. Fill in the fields for that type.',
  },
  {
    n: '02',
    title: 'Customize the look',
    body:
      'Pick a color palette or set your own, switch on a gradient, choose dot and corner shapes, add your logo to the center, and set the export size and margin.',
  },
  {
    n: '03',
    title: 'Generate one or hundreds',
    body:
      'Download a single styled code instantly, or switch to Bulk mode to generate up to 200 at once from a pasted list or a sequential range like table numbers.',
  },
  {
    n: '04',
    title: 'Export and use it',
    body:
      'Save as PNG, JPEG, WEBP, or SVG, composite it onto a poster background, or download a whole batch as a ZIP and print a ready-to-cut sheet.',
  },
]

const QR_TYPES = [
  {
    title: 'URL QR Code',
    body:
      'Turn any website, landing page, booking page, menu, social profile, or other web address into a scannable QR code.',
  },
  {
    title: 'WhatsApp QR Code',
    body:
      'Create a QR code that opens a WhatsApp conversation using a phone number and an optional pre-filled message.',
  },
  {
    title: 'WiFi QR Code',
    body:
      'Share WiFi network details through a QR code so guests can connect without manually typing the network information.',
  },
  {
    title: 'UPI QR Code',
    body:
      'Create a UPI payment QR using a UPI ID with an optional payee name, amount, and payment note.',
  },
  {
    title: 'Email QR Code',
    body:
      'Open an email address from a scan, with optional subject and message fields.',
  },
  {
    title: 'Phone QR Code',
    body:
      'Let customers, guests, or visitors scan a code that opens a phone call on a compatible device.',
  },
  {
    title: 'SMS QR Code',
    body:
      'Create a code that opens an SMS with a phone number and optional message.',
  },
  {
    title: 'Text QR Code',
    body:
      'Encode plain text into a QR code for instructions, notes, labels, signs, and other offline use cases.',
  },
]

const SERVICES = [
  {
    icon: '🎨',
    title: 'Custom styling',
    body:
      'Choose foreground and background colors, gradients, dot styles, and corner styles to match your branding.',
  },
  {
    icon: '🖼️',
    title: 'Logo embedding',
    body:
      'Add your logo to the center of the QR code and adjust its size before downloading.',
  },
  {
    icon: '🧾',
    title: 'Bulk generation',
    body:
      'Paste a list or define a sequential range and generate up to 200 QR codes in one batch.',
  },
  {
    icon: '🔗',
    title: '8 content types',
    body:
      'Generate QR codes for URLs, WhatsApp, WiFi, UPI, email, phone, SMS, and plain text.',
  },
  {
    icon: '🖨️',
    title: 'Poster & print sheets',
    body:
      'Place a QR code over a poster background or create a printable sheet from a bulk batch.',
  },
  {
    icon: '📈',
    title: 'Optional scan tracking',
    body:
      'Sign in with Google when you want a Dinezy short link and scan counter. Basic generation and downloads work without an account.',
  },
]

const RESTAURANT_USE_CASES = [
  {
    title: 'Table QR codes',
    body:
      'Generate sequential codes for Table 1, Table 2, Table 3 and more using Bulk mode.',
  },
  {
    title: 'Digital menu QR',
    body:
      'Point customers directly to your restaurant digital menu from tables, counters, packaging, or signage.',
  },
  {
    title: 'Table tents and posters',
    body:
      'Customize the QR style, add your restaurant branding, and place the code on printed table materials.',
  },
]

const FAQS = [
  {
    question: 'What is a QR code generator?',
    answer:
      'A QR code generator creates a scannable QR code that stores information such as a website URL, WhatsApp link, WiFi details, UPI payment information, email address, phone number, SMS content, or plain text.',
  },
  {
    question: 'Can I create a QR code for my restaurant menu?',
    answer:
      'Yes. You can create a QR code that points to your restaurant digital menu and use Bulk mode to create sequential table QR codes.',
  },
  {
    question: 'Can I add my logo to a QR code?',
    answer:
      'Yes. Dinezy lets you upload a logo, place it in the center of the QR code, and adjust the logo size.',
  },
  {
    question: 'Can I generate QR codes in bulk?',
    answer:
      'Yes. Bulk mode supports a pasted list or a sequential range and can generate up to 200 QR codes in one batch.',
  },
  {
    question: 'Do I need an account to generate a QR code?',
    answer:
      'No. The generator is designed to work without an account. Optional Google sign-in is available when you want tracked short links and scan counts.',
  },
]

export default function QrGeneratorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageJsonLd),
        }}
      />

      <Header />

      <main className="bg-white text-gray-900">
        {/* ------------------------------------------------------------------ */}
        {/* Hero                                                               */}
        {/* ------------------------------------------------------------------ */}
        <section className="px-4 pb-8 pt-12 sm:px-6 sm:pb-12 sm:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C1443A]">
              Free QR Code Generator
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Create a QR Code Free Online
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              Generate QR codes for links, WhatsApp, WiFi, UPI payments,
              email, phone numbers, SMS, and text. Customize colors, shapes,
              and logos, then download or print your QR code instantly.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Generator tool                                                     */}
        {/* ------------------------------------------------------------------ */}
        <QrGeneratorClient />

        {/* ------------------------------------------------------------------ */}
        {/* QR code types                                                      */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="qr-types"
          className="border-t border-gray-100 px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C1443A]">
                QR code types
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                Create a QR code for every use
              </h2>

              <p className="mt-4 text-sm leading-7 text-gray-600 sm:text-base">
                Choose the format that matches what you want people to open,
                connect to, or read after scanning.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {QR_TYPES.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
                >
                  <h3 className="text-base font-semibold text-gray-900">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Customization / features                                           */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="features"
          className="border-t border-gray-100 bg-gray-50 px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C1443A]">
                Customize your QR code
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                More than a basic QR generator
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
                Style the code for your brand, add a logo, create batches, and
                prepare the result for digital or printed use.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {feature.icon}
                  </span>

                  <h3 className="mt-3 text-base font-semibold text-gray-900">
                    {feature.title}
                  </h3>

                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Restaurant use case                                                */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="restaurant-qr"
          className="border-t border-gray-100 px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C1443A]">
                For restaurants
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                Restaurant QR code generator for tables and menus
              </h2>

              <p className="mt-4 text-sm leading-7 text-gray-600 sm:text-base">
                Create QR codes for restaurant tables, digital menus, takeaway
                materials, posters, and table tents. Generate sequential table
                codes in bulk, customize them with your branding, and download
                the batch for printing.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {RESTAURANT_USE_CASES.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
                >
                  <h3 className="text-base font-semibold text-gray-900">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href="/restaurant-qr-menu"
                className="inline-flex items-center rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-900 transition hover:border-gray-300 hover:bg-gray-50"
              >
                Explore Dinezy restaurant QR menus
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* How it works                                                       */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="how-it-works"
          className="border-t border-gray-100 px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C1443A]">
                How it works
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                Four steps from idea to printed code
              </h2>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {STEPS.map((step) => (
                <article
                  key={step.n}
                  className="rounded-2xl border border-gray-200 p-5 sm:p-6"
                >
                  <span className="font-mono text-xs text-gray-300">
                    {step.n}
                  </span>

                  <h3 className="mt-1 text-base font-semibold text-gray-900">
                    {step.title}
                  </h3>

                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                    {step.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* FAQ                                                                */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="faq"
          className="border-t border-gray-100 bg-gray-50 px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C1443A]">
                FAQ
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                Frequently asked questions
              </h2>
            </div>

            <div className="mt-10 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group px-5 py-5 sm:px-6"
                >
                  <summary className="cursor-pointer list-none pr-8 text-sm font-semibold text-gray-900 marker:hidden">
                    <span className="relative block">
                      {faq.question}

                      <span
                        aria-hidden="true"
                        className="absolute right-0 top-0 text-gray-400 transition group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Related Dinezy resources                                           */}
        {/* ------------------------------------------------------------------ */}
        <section className="border-t border-gray-100 px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
              More from Dinezy
            </h2>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
              <Link
                href="/restaurant-digital-menu"
                className="text-sm font-medium text-[#C1443A] hover:underline"
              >
                Restaurant digital menu
              </Link>

              <Link
                href="/restaurant-qr-menu"
                className="text-sm font-medium text-[#C1443A] hover:underline"
              >
                Restaurant QR menu
              </Link>

              <Link
                href="/restaurant-marketing"
                className="text-sm font-medium text-[#C1443A] hover:underline"
              >
                Restaurant marketing
              </Link>

              <Link
                href="/restaurant-whatsapp-marketing"
                className="text-sm font-medium text-[#C1443A] hover:underline"
              >
                Restaurant WhatsApp marketing
              </Link>

              <Link
                href="/restaurant-loyalty-program"
                className="text-sm font-medium text-[#C1443A] hover:underline"
              >
                Restaurant loyalty program
              </Link>

              <Link
                href="/blog"
                className="text-sm font-medium text-[#C1443A] hover:underline"
              >
                Dinezy restaurant blog
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* CTA                                                                */}
        {/* ------------------------------------------------------------------ */}
        <section className="border-t border-gray-100 px-4 py-14 text-center sm:px-6 sm:py-16">
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Ready to make your QR code?
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            No sign-up is needed to generate or download a QR code.
          </p>

          <a
            href="#generator"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#C1443A] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#A83A31] active:scale-[0.97]"
          >
            Start creating
          </a>
        </section>
      </main>
    </>
  )
}