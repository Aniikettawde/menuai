import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Restaurant Marketing Software | Dinezy',
  description:
    'Restaurant marketing software for customer engagement, repeat visits and post-visit campaigns. Dinezy connects your QR menu with WhatsApp, loyalty and analytics.',
  path: '/restaurant-marketing',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Restaurant Marketing', path: '/restaurant-marketing' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Restaurant Marketing Software', url: absoluteUrl('/restaurant-marketing') }} />
      <FeaturePage
        eyebrow="Restaurant marketing"
        title="Turn a menu visit into an ongoing customer relationship."
        intro="Dinezy connects the guest experience with the tools restaurants use after the meal — WhatsApp engagement, loyalty, feedback and analytics."
        path="/restaurant-marketing"
        bullets={[
          'Post-visit customer engagement',
          'WhatsApp campaigns through your restaurant account',
          'Digital loyalty and rewards',
          'Guest feedback and review requests',
          'Analytics to understand engagement',
        ]}
        steps={[
          { title: 'Capture the interaction', body: 'Guests start with the Dinezy menu and interact with the experience during the visit.' },
          { title: 'Continue the conversation', body: 'Use WhatsApp and loyalty tools to stay connected after the visit.' },
          { title: 'Measure the response', body: 'Use analytics and feedback to understand what guests engage with.' },
        ]}
        whoItsFor={[
          'Restaurants that want more from their existing guest traffic.',
          'Teams currently switching between disconnected marketing tools.',
          'Operators who want post-visit engagement without building a separate guest app.',
        ]}
        faq={[
          { question: 'Does Dinezy send WhatsApp messages from its own number?', answer: 'Dinezy is designed to connect your restaurant’s own WhatsApp Business account for customer engagement.' },
          { question: 'Can I use only the digital menu?', answer: 'Yes. The digital menu can be the starting point, and you can use additional engagement features as needed.' },
          { question: 'Does this replace my POS?', answer: 'No. Dinezy is focused on the guest menu and engagement layer rather than replacing every restaurant back-office system.' },
        ]}
        related={[
          { label: 'WhatsApp marketing', href: '/restaurant-whatsapp-marketing' },
          { label: 'Restaurant loyalty program', href: '/restaurant-loyalty-program' },
          { label: 'Restaurant analytics', href: '/restaurant-analytics' },
        ]}
      />
    </>
  )
}
