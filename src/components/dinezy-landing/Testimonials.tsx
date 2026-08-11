'use client'

import { FadeIn, SectionHeading, SectionShell } from './shared'

const TESTIMONIALS = [
  {
    quote:
      'We used to lose track of regulars after their first visit. With Dinezy, we know who came back and who needs a nudge — and our WhatsApp campaigns actually get replies.',
    name: 'Rajesh Verma',
    role: 'Owner',
    place: 'Spice Route Kitchen',
    city: 'Pune',
  },
  {
    quote:
      'The digital menu is beautiful, but what sold us was the retention side. Loyalty points and post-visit messages have noticeably increased our repeat customers.',
    name: 'Kavita Nair',
    role: 'Manager',
    place: 'Café Meridian',
    city: 'Mumbai',
  },
  {
    quote:
      'Setup took less than a day. Our staff didn\'t need training — guests just scan and go. The analytics help us see which dishes to promote.',
    name: 'Amit Desai',
    role: 'Owner',
    place: 'The Curry House',
    city: 'Bangalore',
  },
]

export function Testimonials() {
  return (
    <SectionShell id="testimonials">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <SectionHeading>Trusted by restaurant owners</SectionHeading>
        <p className="mt-3 text-[14px] text-ink-faint">
          Placeholder testimonials from representative restaurant profiles
        </p>
      </FadeIn>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <FadeIn key={t.name} delay={i * 0.08}>
            <blockquote className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-elegant-sm">
              <p className="flex-1 text-[14px] leading-relaxed text-ink-soft">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="mt-5 border-t border-line pt-4">
                <p className="text-[13px] font-semibold">{t.name}</p>
                <p className="text-[12px] text-ink-faint">
                  {t.role}, {t.place} · {t.city}
                </p>
              </footer>
            </blockquote>
          </FadeIn>
        ))}
      </div>
    </SectionShell>
  )
}
