import type { Metadata } from 'next'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { HomePage } from '@/components/dinezy-landing/HomePage'
import { createPageMetadata, organizationJsonLd, websiteJsonLd } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Dinezy | QR Digital Menu & Restaurant Marketing',
  description:
    'Dinezy helps restaurants in India run a branded QR digital menu, AI menu assistant, WhatsApp marketing, loyalty and restaurant analytics from one platform.',
  path: '/',
})

export default function Page() {
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <HomePage />
    </>
  )
}
