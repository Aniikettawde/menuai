'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Gift,
  MessageCircle,
  QrCode,
  Search,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { AnimatedGrowthLoop } from './AnimatedGrowthLoop'
import { MarketingFooter } from './MarketingFooter'
import { MarketingHeader } from './MarketingHeader'
import { PhoneMenuShowcase } from './PhoneMenuShowcase'
import { BookDemoModal } from './BookDemoModal'

const FEATURE_LINKS = [
  {
    href: '/restaurant-digital-menu',
    icon: UtensilsCrossed,
    title: 'Digital menu',
    body: 'A fast, mobile-first menu guests can actually browse.',
  },
  {
    href: '/restaurant-qr-menu',
    icon: QrCode,
    title: 'QR menu',
    body: 'One simple entry point from table, counter or packaging.',
  },
  {
    href: '/ai-menu-assistant',
    icon: Bot,
    title: 'AI menu assistant',
    body: 'Help guests understand dishes and choose with confidence.',
  },
  {
    href: '/restaurant-whatsapp-marketing',
    icon: MessageCircle,
    title: 'WhatsApp marketing',
    body: 'Keep the relationship going after the guest leaves.',
  },
  {
    href: '/restaurant-loyalty-program',
    icon: Gift,
    title: 'Loyalty & rewards',
    body: 'Create a simple reason for guests to come back.',
  },
  {
    href: '/restaurant-analytics',
    icon: BarChart3,
    title: 'Restaurant analytics',
    body: 'Understand menu activity and guest engagement.',
  },
]

const FAQS = [
  {
    question: 'Do guests need to install an app?',
    answer: 'No. A guest can scan the restaurant QR code and open the menu in a mobile browser.',
  },
  {
    question: 'Can I change dishes and prices later?',
    answer: 'Yes. Menu content is managed from the Dinezy dashboard, so you can update the digital menu without reprinting every menu copy.',
  },
  {
    question: 'Can I keep using my existing POS?',
    answer: 'Yes. Dinezy can sit alongside the restaurant’s existing POS as the guest-facing menu and engagement layer.',
  },
  {
    question: 'Is Dinezy only for restaurants in Pune?',
    answer: 'No. Dinezy is built for restaurants across India, with dedicated local content for Pune.',
  },
]

export function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#171313]">
      <MarketingHeader />

      <main>
        <section className="relative overflow-hidden bg-[#171411] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_74%_22%,rgba(215,175,87,0.18),transparent_28%),radial-gradient(circle_at_10%_80%,rgba(122,35,51,0.15),transparent_32%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-28 sm:px-7 sm:pb-28 sm:pt-32 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:pb-32 lg:pt-40">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/48">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e5bd66]" />
                Digital menu for restaurants
              </div>

              <h1 className="mt-6 max-w-3xl font-display text-[clamp(3.2rem,7.2vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.055em]">
                Your QR menu should do more than show the menu.
              </h1>

              <p className="mt-7 max-w-xl text-[17px] leading-8 text-white/57 sm:text-[18px]">
                Dinezy gives restaurants a premium digital menu guests enjoy using — then adds the tools to help you understand, engage and bring them back.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/dashboard/login?mode=signup" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#e5bd66] px-6 py-3.5 text-sm font-semibold text-[#1e180f] transition hover:-translate-y-0.5">
                  Create your menu
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/restaurant-digital-menu" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.05]">
                  Explore Dinezy
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/34">
                <span className="inline-flex items-center gap-1.5"><Check size={13} />No guest app</span>
                <span className="inline-flex items-center gap-1.5"><Check size={13} />Update anytime</span>
                <span className="inline-flex items-center gap-1.5"><Check size={13} />Works with your existing workflow</span>
              </div>
            </div>

            <div className="relative z-10 lg:pl-8">
              <PhoneMenuShowcase />
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-5 pb-6 sm:px-7 lg:pb-8">
            <div className="flex flex-col gap-2 border-t border-white/8 pt-5 text-[10px] uppercase tracking-[0.18em] text-white/26 sm:flex-row sm:items-center sm:justify-between">
              <span>For restaurants, cafés, bars & food businesses</span>
              <span>Built for a mobile-first guest experience</span>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-7 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div className="max-w-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a2333]">For the restaurant owner</p>
                <h2 className="mt-4 font-display text-[clamp(2.5rem,5vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
                  Make the guest experience easier. Make the next visit easier too.
                </h2>
                <p className="mt-6 text-base leading-7 text-[#756a60] sm:text-lg">
                  The menu is where the guest starts. Dinezy helps you take care of what comes next — without forcing your team to juggle another collection of disconnected tools.
                </p>
              </div>

              <div className="grid gap-px overflow-hidden rounded-[28px] border border-[#e8e0d5] bg-[#e8e0d5] sm:grid-cols-2">
                {[
                  ['01', 'Update once', 'Change dishes, prices, photos and categories from one place.'],
                  ['02', 'Help guests choose', 'Search, AI assistance and a clearer mobile menu reduce the guesswork.'],
                  ['03', 'Stay connected', 'Use WhatsApp and loyalty to keep the relationship going after the meal.'],
                  ['04', 'Learn from the menu', 'See what guests are engaging with and use that information to improve the experience.'],
                ].map(([number, title, body]) => (
                  <div key={number} className="bg-[#fcfaf7] p-6 sm:p-7">
                    <span className="text-[10px] font-bold tracking-[0.18em] text-[#a3978d]">{number}</span>
                    <h3 className="mt-8 font-display text-2xl font-semibold tracking-[-0.025em]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#756a60]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#e8e0d5] bg-[#f6f1ea]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-7 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a2333]">One platform, clear jobs</p>
              <h2 className="mt-4 font-display text-[clamp(2.5rem,5vw,4.2rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
                Every feature has one job: make the restaurant easier to run or easier to return to.
              </h2>
            </div>

            <div className="mt-12 divide-y divide-[#dfd6cb] border-y border-[#dfd6cb]">
              {FEATURE_LINKS.map((item, index) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className="group grid gap-5 py-7 sm:grid-cols-[64px_1fr_auto] sm:items-center sm:gap-8">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#7a2333] shadow-[0_10px_25px_rgba(43,33,24,0.06)] transition-transform duration-300 group-hover:-translate-y-1">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#a3978d]">{String(index + 1).padStart(2, '0')}</p>
                      <h3 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">{item.title}</h3>
                      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#756a60]">{item.body}</p>
                    </div>
                    <ArrowRight size={18} className="text-[#a3978d] transition duration-300 group-hover:translate-x-1 group-hover:text-[#7a2333]" />
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#171411] text-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-7 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e5bd66]">From scan to second visit</p>
                <h2 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.6rem)] font-semibold leading-[0.97] tracking-[-0.05em]">
                  One guest journey. One place to manage it.
                </h2>
                <p className="mt-6 max-w-xl text-base leading-7 text-white/48 sm:text-lg">
                  A QR menu gets the guest in. Dinezy gives you more ways to make the experience useful before, during and after the meal.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/restaurant-marketing" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.05]">
                    See the restaurant tools
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>

              <AnimatedGrowthLoop />
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-7 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a2333]">Why restaurants use Dinezy</p>
                <h2 className="mt-4 max-w-3xl font-display text-[clamp(2.6rem,5vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
                  A premium guest experience without adding friction to the restaurant.
                </h2>
              </div>

              <div className="space-y-6 border-t border-[#e8e0d5] pt-6 text-sm leading-6 text-[#5f564f]">
                <div>
                  <div className="flex items-center gap-3">
                    <QrCode size={17} className="text-[#7a2333]" />
                    <h3 className="font-semibold text-[#171313]">Guests start instantly</h3>
                  </div>
                  <p className="mt-2 pl-7">Scan the QR code. Open the menu. No separate guest app required.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <Sparkles size={17} className="text-[#7a2333]" />
                    <h3 className="font-semibold text-[#171313]">The menu can answer questions</h3>
                  </div>
                  <p className="mt-2 pl-7">Use AI assistance to explain dishes and help guests choose from the actual menu.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <MessageCircle size={17} className="text-[#7a2333]" />
                    <h3 className="font-semibold text-[#171313]">The relationship does not have to end at the table</h3>
                  </div>
                  <p className="mt-2 pl-7">Bring together WhatsApp, loyalty and engagement so you can follow up thoughtfully.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#e8e0d5] bg-[#f7f2eb]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-7 sm:py-28">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a2333]">Start with the problem you have today</p>
                <h2 className="mt-4 font-display text-[clamp(2.5rem,5vw,4.2rem)] font-semibold leading-[0.98] tracking-[-0.045em]">Choose the part of the restaurant you want to improve first.</h2>
              </div>
              <Link href="/restaurant-digital-menu" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#7a2333]">
                View all product pages
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Need a better QR menu?', '/restaurant-qr-menu', QrCode],
                ['Need more repeat visits?', '/restaurant-loyalty-program', Gift],
                ['Need better guest follow-up?', '/restaurant-whatsapp-marketing', MessageCircle],
                ['Need clearer guest data?', '/restaurant-analytics', BarChart3],
              ].map(([label, href, Icon]) => {
                const Component = Icon as typeof QrCode
                return (
                  <Link key={href as string} href={href as string} className="group rounded-[24px] border border-[#e5dcd1] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(43,33,24,0.08)]">
                    <Component size={18} className="text-[#7a2333]" />
                    <p className="mt-10 text-sm font-semibold text-[#171313]">{label as string}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#8c8177] group-hover:text-[#7a2333]">
                      Explore <ArrowRight size={13} />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#171411] text-white">
          <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-7 sm:py-24">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#e5bd66]/25 bg-[#e5bd66]/8 text-[#e5bd66]">
              <UtensilsCrossed size={19} />
            </div>
            <h2 className="mx-auto mt-6 max-w-3xl font-display text-[clamp(2.7rem,5vw,4.7rem)] font-semibold leading-[0.98] tracking-[-0.05em]">
              Give guests a better menu. Give your restaurant more room to grow.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
              Start with your QR menu. Then add the guest engagement tools that matter to your restaurant.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/dashboard/login?mode=signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e5bd66] px-6 py-3.5 text-sm font-semibold text-[#1f180f]">
                Start with Dinezy <ArrowRight size={16} />
              </Link>
              <button
  type="button"
  onClick={() => setDemoOpen(true)}
  className="inline-flex items-center justify-center rounded-full border border-white/12 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.05]"
>
  Book a demo
</button>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-7 sm:py-24">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a2333]">FAQ</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Questions restaurant owners ask first.</h2>
            </div>
            <div className="mt-10 divide-y divide-[#e8e0d5] border-y border-[#e8e0d5]">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-semibold">
                    {faq.question}
                    <span className="text-[#9b8f84] transition duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="max-w-3xl pt-3 pr-8 text-sm leading-6 text-[#756a60]">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
<BookDemoModal
  open={demoOpen}
  onClose={() => setDemoOpen(false)}
/>
      <MarketingFooter />
    </div>
  )
}
