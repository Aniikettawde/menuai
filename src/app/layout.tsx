import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Script from 'next/script'

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
    default: 'Dinezy - Restaurant Growth Platform',
    template: '%s | Dinezy',
  },
  description:
    'Dinezy is a restaurant growth platform with a QR menu you can update anytime, waiter calling, AI menu, restaurant websites and analytics that bring diners back.',
  keywords: [
    'restaurant growth platform',
    
    'QR menu',
    'digital menu',
    'restaurant CRM India',
    'AI restaurant menu',
    'restaurant software India',
    'waiter calling system',
    'repeat customers restaurant',
  ],
  openGraph: {
    title: 'Dinezy - Restaurant Growth Platform',
    description:
      'QR menu, one-tap waiter calling, AI menu and analytics that bring diners back to your restaurant.',
    url: 'https://dinezy.in',
    siteName: 'Dinezy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dinezy - Restaurant Growth Platform',
     description: 'The restaurant growth platform for Indian restaurants — QR menu, waiter calling and analytics.',
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
  themeColor: '#050816',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} ${jetbrainsMono.variable} scroll-smooth`}
    >
     <body className="bg-[#050816] text-white antialiased">
  {children}
  
 

  {/* Google Analytics */}
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

  {/* Google AdSense */}
  <Script
    id="google-adsense"
    async
    strategy="afterInteractive"
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9875875084938019"
    crossOrigin="anonymous"
  />
</body>
    </html>
  )
}