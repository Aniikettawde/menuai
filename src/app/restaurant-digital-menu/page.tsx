import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Digital Menu for Restaurants | Dinezy',
  description:
    'Create a mobile-first digital menu for your restaurant. Add dishes, photos, pricing, categories and guest tools without reprinting menus.',
  path: '/restaurant-digital-menu',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Digital Menu', path: '/restaurant-digital-menu' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Digital Menu for Restaurants', url: absoluteUrl('/restaurant-digital-menu') }} />
      <FeaturePage
        eyebrow="Restaurant digital menu"
        title="A digital menu made for the way guests use their phones."
        intro="Dinezy replaces printed menus and static PDFs with a mobile-first restaurant digital menu that is easy to browse, easy to update and connected to the rest of the guest experience."
        path="/restaurant-digital-menu"
        bullets={[
          'Branded menu pages for your restaurant',
          'Dish photos, descriptions, prices and categories',
          'Fast browsing and search on mobile',
          'AI help for guests who are unsure what to choose',
          'Call-waiter access from the menu experience',
        ]}
        steps={[
          { title: 'Build the menu', body: 'Manage your dishes and menu content from the restaurant dashboard.' },
          { title: 'Share the QR code', body: 'Put your menu QR code where guests naturally reach for their phone.' },
          { title: 'Keep it current', body: 'Update dishes and pricing in the dashboard instead of printing new menus.' },
        ]}
        whoItsFor={[
          'Restaurants replacing printed menus with a digital experience.',
          'Cafes and casual dining businesses that change dishes, prices or offers regularly.',
          'Restaurant teams that want the menu to be the starting point for guest engagement.',
          'Businesses that want a branded mobile menu without asking guests to install an app.',
        ]}
        faq={[
          { question: 'Do guests need to download an app?', answer: 'No. The menu opens in a mobile browser from the restaurant QR code.' },
          { question: 'Can I change prices after the menu is live?', answer: 'Yes. Menu content is managed from Dinezy, so you do not need to reprint the menu every time something changes.' },
          { question: 'Can I use Dinezy with my existing POS?', answer: 'Yes. Dinezy is designed as a guest experience and engagement layer, so your restaurant can keep its existing POS where required.' },
        ]}
        related={[
          { label: 'QR menu for restaurants', href: '/restaurant-qr-menu' },
          { label: 'AI menu assistant', href: '/ai-menu-assistant' },
          { label: 'Restaurant analytics', href: '/restaurant-analytics' },
        ]}
      />
    </>
  )
}
