// Example pattern for an App Router page with unique metadata + JSON-LD.
// Each SEO page in this bundle follows this pattern.

import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { FeaturePage } from '@/components/dinezy-landing/FeaturePage'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Keyword-focused page title | Dinezy',
  description: 'A unique, human-written description that matches the actual content of this page.',
  path: '/your-route',
})

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Your Page', path: '/your-route' }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Your Page', url: absoluteUrl('/your-route') }} />
      <FeaturePage
        eyebrow="Your page topic"
        title="Use a clear H1 that matches the page intent."
        intro="Explain the actual product capability in plain language; do not pad the page with unrelated keywords."
        path="/your-route"
        bullets={[]}
        steps={[]}
        whoItsFor={[]}
        faq={[]}
        related={[]}
      />
    </>
  )
}
