// Merge this into your existing app/layout.tsx. Keep your current fonts,
// providers, analytics scripts and other application-specific setup.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
  title: {
    default: 'Dinezy | QR Digital Menu & Restaurant Marketing',
    template: '%s | Dinezy',
  },
  applicationName: 'Dinezy',
  description:
    'Dinezy helps restaurants in India run a branded QR digital menu, AI menu assistant, WhatsApp marketing, loyalty and restaurant analytics from one platform.',
  icons: {
    icon: '/favicon.ico',
  },
  authors: [{ name: 'Dinezy' }],
  creator: 'Dinezy',
  publisher: 'Dinezy',
}
