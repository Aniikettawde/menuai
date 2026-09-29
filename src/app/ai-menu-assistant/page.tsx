import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'AI Menu Assistant for Restaurants | Dinezy',
  description:
    'Help restaurant guests choose dishes with an AI menu assistant. Dinezy answers menu questions and guides customers based on taste and preferences.',
  path: '/ai-menu-assistant',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'AI Menu Assistant', path: '/ai-menu-assistant' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'AI Menu Assistant for Restaurants', url: absoluteUrl('/ai-menu-assistant') }} />
      <FeaturePage
        eyebrow="AI menu assistant"
        title="When guests ask ‘what should I order?’, give them a useful answer."
        intro="Dinezy’s AI menu assistant helps guests understand dishes and choose from the menu based on their preferences, instead of leaving them to guess."
        path="/ai-menu-assistant"
        bullets={[
          'Answer questions about menu items',
          'Guide undecided guests toward suitable dishes',
          'Support taste and dietary preference questions',
          'Keep the AI experience inside the restaurant menu',
          'Designed for a phone-first guest journey',
        ]}
        steps={[
          { title: 'Guest asks', body: 'A diner asks about a dish, preference or what to choose.' },
          { title: 'Dinezy explains', body: 'The assistant uses the menu context to provide a relevant response.' },
          { title: 'Guest decides', body: 'The customer can return to the menu with more confidence.' },
        ]}
        whoItsFor={[
          'Restaurants with menus that need more explanation than a short description can provide.',
          'Teams that want to reduce repetitive “what is this?” questions.',
          'Restaurants looking for a practical AI feature rather than a generic chatbot on the homepage.',
        ]}
        faq={[
          { question: 'Does the AI know my whole website?', answer: 'The intended experience is menu-focused: the assistant works around the restaurant’s menu content and guest questions.' },
          { question: 'Can guests ask about preferences?', answer: 'Yes. The product is designed for taste and dietary preference questions when the menu contains enough information to answer responsibly.' },
          { question: 'Is the AI a replacement for the waiter?', answer: 'No. Dinezy’s AI is a menu-assistance layer; the product also includes call-waiter functionality for situations that still need staff.' },
        ]}
        related={[
          { label: 'Digital menu', href: '/restaurant-digital-menu' },
          { label: 'QR menu', href: '/restaurant-qr-menu' },
          { label: 'Restaurant analytics', href: '/restaurant-analytics' },
        ]}
      />
    </>
  )
}
