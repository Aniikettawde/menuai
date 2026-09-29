import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'QR Menu for Restaurants | Dinezy',
  description:
    'Give guests a restaurant QR menu they can open instantly on their phone. Dinezy connects QR menus with AI help, call waiter, loyalty, WhatsApp and analytics.',
  path: '/restaurant-qr-menu',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'QR Menu', path: '/restaurant-qr-menu' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'QR Menu for Restaurants', url: absoluteUrl('/restaurant-qr-menu') }} />
      <FeaturePage
        eyebrow="Restaurant QR menu"
        title="One QR code can be the front door to your restaurant experience."
        intro="Give diners a simple way to open your menu at the table, counter or takeaway touchpoint. Dinezy turns the restaurant QR code into a mobile-first menu instead of a static PDF."
        path="/restaurant-qr-menu"
        bullets={[
          'QR menu pages that open in a phone browser',
          'Branded restaurant menu experience',
          'Searchable menu with categories and dish details',
          'Optional guest tools such as AI menu help and call waiter',
          'Links to the wider Dinezy engagement experience',
        ]}
        steps={[
          { title: 'Generate your QR', body: 'Create or use your Dinezy menu QR code for the restaurant.' },
          { title: 'Place it where guests scan', body: 'Use tables, counter stands, packaging, printed collateral or other guest touchpoints.' },
          { title: 'Keep the destination live', body: 'Change menu content in Dinezy without changing the QR code itself.' },
        ]}
        whoItsFor={[
          'Dine-in restaurants moving from paper menus to mobile.',
          'Restaurants that need menu changes without repeated printing.',
          'Businesses that want their QR menu to do more than display a PDF.',
          'Restaurants looking for a branded, app-free guest experience.',
        ]}
        faq={[
          { question: 'Is the QR code only for tables?', answer: 'No. A restaurant can place QR codes anywhere guests naturally scan, including counters and takeaway packaging.' },
          { question: 'Can guests use it without installing an app?', answer: 'Yes. Dinezy menus are designed to open in a mobile browser.' },
          { question: 'Can I keep my existing POS?', answer: 'Yes. Dinezy can sit alongside an existing POS as the customer-facing menu and engagement layer.' },
        ]}
        related={[
          { label: 'Digital menu for restaurants', href: '/restaurant-digital-menu' },
          { label: 'Free QR generator', href: '/qr-generator' },
          { label: 'Restaurant marketing', href: '/restaurant-marketing' },
        ]}
      />
    </>
  )
}
