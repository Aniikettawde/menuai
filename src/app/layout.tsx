import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

// Inter is loaded only as a fallback layer behind Geist — never rendered directly,
// but keeps the font-family stack solid if Geist fails to load.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-fallback',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://dinezy.in'),
  title: {
    default: 'Dinezy — Restaurant Growth Platform',
    template: '%s | Dinezy',
  },
  description:
    'Dinezy brings QR menus, WhatsApp automation, customer loyalty, AI menu assistance and analytics into one platform built to bring diners back.',
  keywords: [
    'restaurant growth platform',
    'QR menu',
    'digital menu India',
    'restaurant WhatsApp automation',
    'restaurant loyalty program',
    'AI restaurant menu assistant',
    'restaurant analytics software',
    'restaurant software India',
  ],
  openGraph: {
    title: 'Dinezy — Restaurant Growth Platform',
    description:
      'QR menus, WhatsApp automation, loyalty and analytics — the platform that turns first-time diners into regulars.',
    url: 'https://dinezy.in',
    siteName: 'Dinezy',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dinezy — Restaurant Growth Platform',
    description:
      'QR menus, WhatsApp automation, loyalty and analytics — built to bring diners back.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FFFFFF',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} scroll-smooth`}
    >
      <body className="bg-white text-[#111111] antialiased">
        {children}

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LCD36NFH1B"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', 'G-LCD36NFH1B');
          `}
        </Script>
      </body>
    </html>
  )
}
