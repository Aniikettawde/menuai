import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingHeader } from './MarketingHeader'

type FeaturePageProps = {
  eyebrow: string
  title: string
  intro: string
  path: string
  bullets: string[]
  steps: Array<{ title: string; body: string }>
  whoItsFor: string[]
  faq: Array<{ question: string; answer: string }>
  related: Array<{ label: string; href: string }>
}

export function FeaturePage(props: FeaturePageProps) {
  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#171313]">
      <MarketingHeader />
      <main>
        <div className="mx-auto max-w-6xl px-5 pt-7 sm:px-7">
          <nav className="text-xs text-[#8B8178]" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#171313]">Dinezy</Link>
            <span className="mx-2">/</span>
            <span>{props.eyebrow}</span>
          </nav>
        </div>

        <section className="border-b border-[#E8E0D5]">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-7 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A2333]">{props.eyebrow}</p>
              <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.8rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.05em]">{props.title}</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#756A60] sm:text-lg">{props.intro}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/dashboard/login?mode=signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7A2333] px-5 py-3.5 text-sm font-semibold text-white">Start with Dinezy <ArrowRight size={16} /></Link>
                <Link href="/qr-generator" className="inline-flex items-center justify-center rounded-xl border border-[#DCCFC2] bg-white px-5 py-3.5 text-sm font-semibold text-[#332A24]">Free QR generator</Link>
              </div>
            </div>

            <div className="border-l border-[#E8E0D5] pl-6 sm:pl-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B8178]">What you get</p>
              <div className="mt-5 space-y-3">
                {props.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3 text-sm leading-6 text-[#4D453F]">
                    <Check size={16} className="mt-1 shrink-0 text-[#7A2333]" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-7 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A2333]">How it works</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Simple for your team. Simple for guests.</h2>
            </div>
            <div className="mt-12 grid divide-y divide-[#E8E0D5] border-y border-[#E8E0D5] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              {props.steps.map((step, index) => (
                <div key={step.title} className="px-0 py-7 lg:px-8 lg:py-8 first:lg:pl-0 last:lg:pr-0">
                  <p className="text-xs font-bold tracking-[0.18em] text-[#7A2333]">0{index + 1}</p>
                  <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#756A60]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#E8E0D5] bg-[#F7F2EB]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-7 sm:py-28 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A2333]">Who it is for</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Built around real restaurant workflows.</h2>
            </div>
            <div className="divide-y divide-[#DED5C9] border-y border-[#DED5C9]">
              {props.whoItsFor.map((item) => (
                <p key={item} className="py-4 text-sm leading-6 text-[#4D453F]">{item}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-20 sm:px-7 sm:py-28">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A2333]">FAQ</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Questions before you start</h2>
          </div>
          <div className="mt-10 divide-y divide-[#E8E0D5] border-y border-[#E8E0D5]">
            {props.faq.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-semibold">
                  {item.question}
                  <span className="text-[#8B8178] transition group-open:rotate-45">+</span>
                </summary>
                <p className="pt-3 pr-10 text-sm leading-6 text-[#756A60]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-[#E8E0D5] bg-[#171313] text-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-7 sm:py-20">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Explore another part of Dinezy</p>
            <div className="mt-6 grid gap-2 md:grid-cols-3">
              {props.related.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-4 text-sm font-medium transition hover:bg-white/5">
                  {item.label}
                  <ArrowRight size={16} className="text-white/45" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
