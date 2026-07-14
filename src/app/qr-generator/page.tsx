import type { Metadata } from 'next'
import Header from '@/components/Header'
import QrGeneratorClient from './QrGeneratorClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://dinezy.in'),
  title: 'Free QR Code Generator with Logo, Colors & Bulk Creation | Dinezy',
  description:
    'Create fully customizable QR codes free, forever — colors, gradients, logos, and bulk generation for restaurant menus, WhatsApp, WiFi, UPI payments, and links. No sign-up, no watermark, no scan limit, codes never expire.',
  keywords: [
    'free qr code generator',
    'qr code generator free',
    'restaurant qr code generator',
    'menu qr code',
    'free qr generator india',
    'create qr code online',
    'link to qr code',
    'wifi qr code',
    'whatsapp qr code',
    'payment qr code',
    'upi qr code generator',
    'qr code generator with logo',
    'bulk qr code generator',
    'qr code generator no expiry',
    'table qr code generator',
    'dinezy qr generator',
  ],
  alternates: {
    canonical: 'https://dinezy.in/qr-generator',
  },
  openGraph: {
    title: 'Free QR Code Generator with Logo, Colors & Bulk Creation | Dinezy',
    description:
      'Generate unlimited free QR codes instantly — custom colors, gradients, logos, and bulk table QR generation. No watermark, no sign-up, no scan limit, codes never expire.',
    url: 'https://dinezy.in/qr-generator',
    siteName: 'Dinezy',
    type: 'website',
    images: [
      {
        url: '/og/qr-generator-og.png',
        width: 1200,
        height: 630,
        alt: 'Dinezy Free QR Code Generator — custom colors, logos, and bulk generation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free QR Code Generator | Dinezy',
    description:
      'Create unlimited free QR codes instantly — custom colors, logos, bulk generation. No watermark, no sign-up, no scan limit.',
    images: ['/og/qr-generator-og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Dinezy QR Code Generator',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (Web-based)',
  url: 'https://dinezy.in/qr-generator',
  description:
    'Free QR code generator with custom colors, gradients, logo embedding, and bulk generation for links, WhatsApp, WiFi, UPI payments, and restaurant table QR codes. No sign-up, no watermark, no expiry.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  featureList: [
    'Custom colors and gradients',
    'Logo embedding',
    'Bulk QR generation',
    'Multiple QR types: URL, WhatsApp, WiFi, UPI, Email, SMS, Phone, Text',
    'PNG, JPEG, SVG, WEBP export',
    'No sign-up required',
    'No watermark',
    'Codes never expire',
  ],
}

// ---- Static landing content. Every claim here maps to a feature that actually
// exists in QrGeneratorClient — no invented stats, testimonials, or numbers. ----

const STEPS = [
  {
    n: '01',
    title: 'Pick a content type',
    body: "Choose what the code should open — a link, WhatsApp chat, WiFi network, UPI payment, email, SMS, phone number, or plain text. Fill in the fields for that type.",
  },
  {
    n: '02',
    title: 'Customize the look',
    body: 'Pick a color palette or set your own, switch on a gradient, choose dot and corner shapes, add your logo to the center, and set the export size and margin.',
  },
  {
    n: '03',
    title: 'Generate one or hundreds',
    body: 'Download a single styled code instantly, or switch to Bulk mode to generate up to 200 at once from a pasted list or a sequential range like table numbers.',
  },
  {
    n: '04',
    title: 'Export and use it',
    body: 'Save as PNG, JPEG, WEBP, or SVG, composite it onto a poster background, or download a whole batch as a ZIP and print a ready-to-cut sheet.',
  },
]

const SERVICES = [
  {
    icon: '🎨',
    title: 'Custom styling',
    body: 'Foreground, background, and gradient colors, six dot shapes, and independent corner-square and corner-dot styles.',
  },
  {
    icon: '🖼️',
    title: 'Logo embedding',
    body: 'Drop your logo into the center of any code — error correction automatically steps up so it keeps scanning reliably.',
  },
  {
    icon: '🧾',
    title: 'Bulk generation',
    body: 'Paste a list or define a sequential range (great for restaurant table codes) and generate up to 200 codes in one pass.',
  },
  {
    icon: '🔗',
    title: '8 content types',
    body: 'URL, WhatsApp, WiFi, UPI payment, email, phone, SMS, and plain text — each with its own guided fields.',
  },
  {
    icon: '🖨️',
    title: 'Poster & print sheets',
    body: 'Composite a single code onto a background image for flyers and table tents, or print a full sheet of a bulk batch.',
  },
  {
    icon: '📈',
    title: 'Optional scan tracking',
    body: 'Sign in with Google if you want a short link and a scan counter for a code — everything else works with no account at all.',
  },
]

export default function QrGeneratorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="bg-white">
        {/* ---------- Hero ---------- */}
       

        {/* ---------- Generator tool ---------- */}
        <QrGeneratorClient />

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="px-4 sm:px-6 py-14 sm:py-20 border-t border-gray-100 scroll-mt-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#C1443A] uppercase mb-2">
                How it works
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                Four steps from idea to printed code
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-2xl border border-gray-200 p-5 sm:p-6">
                  <span className="font-mono text-xs text-gray-300">{s.n}</span>
                  <h3 className="mt-1 text-base font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Services / Features ---------- */}
        <section id="features" className="px-4 sm:px-6 py-14 sm:py-20 border-t border-gray-100 bg-gray-50 scroll-mt-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#C1443A] uppercase mb-2">
                What you get
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                Everything in one free generator
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SERVICES.map((f) => (
                <div key={f.title} className="rounded-2xl bg-white border border-gray-200 p-5 sm:p-6">
                  <span className="text-2xl">{f.icon}</span>
                  <h3 className="mt-3 text-base font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Closing CTA ---------- */}
        <section className="px-4 sm:px-6 py-14 sm:py-16 text-center border-t border-gray-100">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Ready to make your code?</h2>
          <p className="mt-2 text-sm text-gray-500">No sign-up needed to generate or download.</p>
          <a
            href="#generator"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#C1443A] text-white px-6 py-3 text-sm font-medium hover:bg-[#A83A31] active:scale-[0.97] transition-all"
          >
            Start now
          </a>
        </section>
      </main>
    </>
  )
}