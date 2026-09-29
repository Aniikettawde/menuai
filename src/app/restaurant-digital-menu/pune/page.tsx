import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { JsonLd } from '@/components/dinezy-landing/JsonLd'
import { MarketingFooter } from '@/components/dinezy-landing/MarketingFooter'
import { MarketingHeader } from '@/components/dinezy-landing/MarketingHeader'
import { breadcrumbJsonLd, createPageMetadata, absoluteUrl } from '@/lib/marketing-seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Digital Menu for Restaurants in Pune | Dinezy',
  description:
    'Dinezy helps restaurants in Pune create a mobile-first QR digital menu with menu updates, AI menu help, call waiter, WhatsApp marketing and analytics.',
  path: '/restaurant-digital-menu/pune',
})

const useCases = [
  'Dine-in restaurants replacing printed menus with QR menus.',
  'Cafes and restaurants that change dishes, prices or offers regularly.',
  'Restaurants that want a mobile menu without asking guests to download an app.',
  'Teams that want QR menus connected to customer engagement after the visit.',
]

export default function Page() {
  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#171313]">
      <MarketingHeader />
      <main>
        <div className="mx-auto max-w-6xl px-5 pt-7 sm:px-7">
          <nav className="text-xs text-[#8B8178]" aria-label="Breadcrumb">
            <Link href="/">Dinezy</Link><span className="mx-2">/</span><Link href="/restaurant-digital-menu">Digital Menu</Link><span className="mx-2">/</span><span>Pune</span>
          </nav>
        </div>

        <section className="border-b border-[#E8E0D5]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-7 sm:py-24">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A2333]">Pune restaurant digital menu</p>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.8rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.05em]">Digital menus for restaurants in Pune.</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-[#756A60] sm:text-lg">Dinezy gives Pune restaurants a branded QR menu that opens on a guest’s phone, stays easy to update and can connect with AI menu help, call waiter, loyalty, WhatsApp marketing and analytics.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/login?mode=signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7A2333] px-5 py-3.5 text-sm font-semibold text-white">Start your Dinezy menu <ArrowRight size={16} /></Link>
              <Link href="/restaurant-qr-menu" className="inline-flex items-center justify-center rounded-xl border border-[#DCCFC2] bg-white px-5 py-3.5 text-sm font-semibold text-[#332A24]">See QR menu features</Link>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-7 sm:py-28 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A2333]">Why Pune restaurants use digital menus</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Make the menu easier to change and easier to use.</h2>
            </div>
            <div className="divide-y divide-[#E8E0D5] border-y border-[#E8E0D5]">
              {useCases.map((item) => (
                <div key={item} className="flex gap-3 py-5 text-sm leading-6 text-[#4D453F]"><Check size={16} className="mt-1 shrink-0 text-[#7A2333]" />{item}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#E8E0D5] bg-[#F7F2EB]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-7 sm:py-28">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A2333]">Pune to India</p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Start local. Use the same platform as you grow.</h2>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#756A60]">The Pune page is a local search entry point. The product itself is built for restaurants across India, so the same menu and guest-engagement model can be used beyond Pune.</p>
            <Link href="/restaurant-digital-menu" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#7A2333]">Explore the full digital menu product <ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="bg-[#171313] text-white">
          <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-7 sm:py-24">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Pune restaurants</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Replace the printed menu with a better first screen.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/55">Start with Dinezy’s QR digital menu, then add the customer engagement features that fit your restaurant.</p>
            <Link href="/dashboard/login?mode=signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-[#171313]">Start free <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
