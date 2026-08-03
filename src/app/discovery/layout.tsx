import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Restaurant Offers in Pune — Deals, Rewards & Top-Rated Places | Dinezy',
  description:
    'Check live restaurant offers in Pune — discounts, loyalty rewards, and top-rated restaurants near you. Discover new places, save your favorites, and earn rewards on every visit.',
  keywords: [
    'restaurant offers in Pune',
    'restaurant deals Pune',
    'best restaurants in Pune',
    'Pune restaurant discounts',
    'top rated restaurants Pune',
    'food offers near me Pune',
    'restaurant loyalty rewards Pune',
  ],
  metadataBase: new URL('https://explore.dinezy.in'),
  alternates: {
    canonical: 'https://explore.dinezy.in',
  },
  openGraph: {
    title: 'Restaurant Offers in Pune | Dinezy',
    description:
      'Live restaurant offers, rewards, and top-rated places in Pune — updated daily.',
    url: 'https://explore.dinezy.in',
    siteName: 'Dinezy',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Restaurant Offers in Pune | Dinezy',
    description: 'Live restaurant offers, rewards, and top-rated places in Pune.',
  },
}

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children
}