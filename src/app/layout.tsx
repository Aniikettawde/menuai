import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  display: 'swap',
  preload: true,
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: false,
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL('https://dinezy.in'),

  title: {
    default: 'Dinezy - AI Powered QR Menu for Restaurants',
    template: '%s | Dinezy',
  },

  description:
    'Dinezy helps restaurants create QR menus with AI recommendations, waiter calling, analytics and digital ordering.',

  keywords: [
    'QR menu',
    'digital menu',
    'restaurant QR code',
    'AI restaurant menu',
    'restaurant software India',
    'digital menu India',
    'restaurant ordering system',
    'waiter calling system',
  ],

  openGraph: {
    title: 'Dinezy - AI Powered QR Menu',
    description:
      'Modern QR menus, AI recommendations, waiter calling and analytics for restaurants.',
    url: 'https://dinezy.in',
    siteName: 'Dinezy',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Dinezy',
    description:
      'AI powered digital menu platform for restaurants.',
  },

  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f8fafc',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}