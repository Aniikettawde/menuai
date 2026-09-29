import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Restaurant Analytics Software | Dinezy',
  description:
    'Understand restaurant guest engagement with menu analytics, QR activity, customer behaviour and campaign performance in Dinezy.',
  path: '/restaurant-analytics',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Restaurant Analytics', path: '/restaurant-analytics' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Restaurant Analytics Software', url: absoluteUrl('/restaurant-analytics') }} />
      <FeaturePage
        eyebrow="Restaurant analytics"
        title="See what guests actually do on your menu."
        intro="Dinezy turns guest interactions into practical restaurant analytics so you can understand menu activity, engagement and the response to customer campaigns."
        path="/restaurant-analytics"
        bullets={[
          'QR and menu activity insights',
          'Understand what guests browse and engage with',
          'Customer engagement signals',
          'Campaign performance tracking',
          'A restaurant dashboard for the connected guest journey',
        ]}
        steps={[
          { title: 'Guests interact', body: 'Customers scan, browse and use the menu experience.' },
          { title: 'Dinezy records activity', body: 'Relevant guest interactions become visible in your restaurant dashboard.' },
          { title: 'Use the insight', body: 'Use the information to improve your menu and customer engagement.' },
        ]}
        whoItsFor={[
          'Restaurants that want more than a QR scan counter.',
          'Operators who want to understand menu engagement.',
          'Teams running customer campaigns and looking for response signals.',
        ]}
        faq={[
          { question: 'What can restaurant analytics tell me?', answer: 'Dinezy is positioned around QR/menu activity, engagement and campaign performance rather than only displaying a static menu.' },
          { question: 'Is analytics tied to the menu?', answer: 'Yes. The analytics experience is connected to the guest interactions that happen around the Dinezy menu and related features.' },
          { question: 'Can I use Dinezy analytics without changing my POS?', answer: 'Yes. The analytics layer is part of Dinezy’s customer-facing experience and does not require replacing your existing POS.' },
        ]}
        related={[
          { label: 'Digital menu', href: '/restaurant-digital-menu' },
          { label: 'Restaurant marketing', href: '/restaurant-marketing' },
          { label: 'WhatsApp marketing', href: '/restaurant-whatsapp-marketing' },
        ]}
      />
    </>
  )
}
