import type { Metadata } from 'next'
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

export default function QrGeneratorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <QrGeneratorClient />
    </>
  )
}