import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Restaurant Loyalty Program | Dinezy',
  description:
    'Create a digital restaurant loyalty program with visits, points and rewards. Dinezy helps restaurants encourage repeat visits without physical loyalty cards.',
  path: '/restaurant-loyalty-program',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Restaurant Loyalty Program', path: '/restaurant-loyalty-program' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Restaurant Loyalty Program', url: absoluteUrl('/restaurant-loyalty-program') }} />
      <FeaturePage
        eyebrow="Restaurant loyalty program"
        title="Give regular customers a reason to come back."
        intro="Dinezy gives restaurants a digital loyalty experience built around real visits, points and rewards — without relying on physical cards."
        path="/restaurant-loyalty-program"
        bullets={[
          'Digital loyalty experience for restaurant guests',
          'Visit-based points and rewards',
          'A simple way to explain loyalty to customers',
          'Connect loyalty with your menu and guest journey',
          'Use rewards as part of repeat-visit campaigns',
        ]}
        steps={[
          { title: 'Define the reward', body: 'Set the loyalty rules your restaurant wants to offer.' },
          { title: 'Guests earn', body: 'Customers interact with the loyalty experience around restaurant visits.' },
          { title: 'Guests return', body: 'Rewards give customers a clear reason to visit again.' },
        ]}
        whoItsFor={[
          'Restaurants that want a digital alternative to punch cards.',
          'Teams focused on repeat visits and customer retention.',
          'Businesses that want loyalty connected to the same guest journey as the menu.',
        ]}
        faq={[
          { question: 'Do customers need a physical card?', answer: 'No. The product is designed as a digital loyalty experience.' },
          { question: 'Can loyalty be combined with the QR menu?', answer: 'Yes. Loyalty is designed as part of the connected Dinezy guest journey.' },
          { question: 'Can I change rewards later?', answer: 'Your loyalty configuration is managed as part of the Dinezy dashboard workflow.' },
        ]}
        related={[
          { label: 'Restaurant marketing', href: '/restaurant-marketing' },
          { label: 'WhatsApp marketing', href: '/restaurant-whatsapp-marketing' },
          { label: 'Restaurant analytics', href: '/restaurant-analytics' },
        ]}
      />
    </>
  )
}
