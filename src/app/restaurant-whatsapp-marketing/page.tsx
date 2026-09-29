import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'WhatsApp Marketing for Restaurants | Dinezy',
  description:
    'Use your restaurant’s WhatsApp Business account for post-visit messages, win-back campaigns, customer conversations and engagement tracking with Dinezy.',
  path: '/restaurant-whatsapp-marketing',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'WhatsApp Marketing', path: '/restaurant-whatsapp-marketing' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'WhatsApp Marketing for Restaurants', url: absoluteUrl('/restaurant-whatsapp-marketing') }} />
      <FeaturePage
        eyebrow="WhatsApp marketing for restaurants"
        title="Stay connected with guests after they leave."
        intro="Use your restaurant’s own WhatsApp Business account to follow up after visits, run win-back campaigns and continue two-way customer conversations."
        path="/restaurant-whatsapp-marketing"
        bullets={[
          'Connect your restaurant’s WhatsApp Business account',
          'Post-visit messages and customer follow-ups',
          'Win-back campaigns for inactive guests',
          'Approved templates and campaign workflows',
          'Engagement tracking for campaigns',
        ]}
        steps={[
          { title: 'Connect WhatsApp', body: 'Link the restaurant’s own WhatsApp Business setup to the engagement workflow.' },
          { title: 'Choose the moment', body: 'Create messages for post-visit follow-up or customer win-back.' },
          { title: 'Learn from the response', body: 'Use engagement signals to understand which campaigns are working.' },
        ]}
        whoItsFor={[
          'Restaurants already using WhatsApp to talk to customers manually.',
          'Operators who want structured post-visit engagement.',
          'Teams looking for a practical alternative to disconnected campaign tools.',
        ]}
        faq={[
          { question: 'Can I keep using my own restaurant WhatsApp account?', answer: 'Yes. Dinezy is designed around the restaurant’s own WhatsApp Business account.' },
          { question: 'Can I send win-back messages?', answer: 'Yes. Win-back campaigns for inactive guests are part of the WhatsApp marketing workflow.' },
          { question: 'Can customers reply?', answer: 'The current product positioning supports two-way customer conversations; message templates and account setup still depend on your WhatsApp Business configuration.' },
        ]}
        related={[
          { label: 'Restaurant marketing', href: '/restaurant-marketing' },
          { label: 'Restaurant loyalty', href: '/restaurant-loyalty-program' },
          { label: 'Restaurant analytics', href: '/restaurant-analytics' },
        ]}
      />
    </>
  )
}
