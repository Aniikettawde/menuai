import type { Metadata } from 'next'
import QrGeneratorClient from './QrGeneratorClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://dinezy.in'),
  title: 'Free QR Code Generator for Restaurants & Links | Dinezy',
  description:
    'Create free QR codes instantly for restaurant menus, websites, WhatsApp, Wi-Fi, payments, and more. No sign-up, no watermark, no scan limit, completely free.',
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
    'dinezy qr generator',
  ],
  alternates: {
    canonical: 'https://dinezy.in/qr-generator',
  },
  openGraph: {
    title: 'Free QR Code Generator for Restaurants & Links | Dinezy',
    description:
      'Generate unlimited free QR codes instantly. No watermark, no sign-up, no scan limit. Perfect for restaurant menus, websites, WhatsApp, Wi-Fi and more.',
    url: 'https://dinezy.in/qr-generator',
    siteName: 'Dinezy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free QR Code Generator | Dinezy',
    description:
      'Create unlimited free QR codes instantly. No watermark, no sign-up, no scan limit.',
  },
  robots: {
    index: true,
    follow: true,
  },
}
 
export default function QrGeneratorPage() {
  return <QrGeneratorClient />
}