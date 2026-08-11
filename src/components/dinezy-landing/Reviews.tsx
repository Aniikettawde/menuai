'use client'

import { Star } from 'lucide-react'
import { Eyebrow, FadeIn, SectionHeading, SectionLead, SectionShell } from './shared'

const REVIEWS = [
  {
    name: 'Ananya R.',
    text: 'The biryani was incredible — perfectly spiced and the portion was generous. Will definitely come back with friends.',
    rating: 5,
    dish: 'Veg Biryani',
  },
  {
    name: 'Rohit M.',
    text: 'Great ambience and the staff was attentive. Paneer tikka was smoky and fresh. Highly recommend.',
    rating: 5,
    dish: 'Paneer Tikka',
  },
]

export function Reviews() {
  return (
    <SectionShell id="reviews" className="bg-canvas">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <Eyebrow>Reviews</Eyebrow>
          <SectionHeading>
            More genuine reviews. <span className="text-accent">Better reputation.</span>
          </SectionHeading>
          <SectionLead>
            Dinezy helps you request honest feedback after visits — at the right moment, from real
            guests. No review gating. No manipulation. Just genuine voices that build trust.
          </SectionLead>
          <ul className="mt-6 space-y-2 text-[14px] text-ink-soft">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Post-visit review requests via WhatsApp
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Dish-level feedback to improve your menu
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Transparent, guest-first approach
            </li>
          </ul>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="space-y-4">
            {REVIEWS.map((r) => (
              <div
                key={r.name}
                className="rounded-2xl border border-line bg-white p-5 shadow-elegant-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} size={14} className="fill-accent text-accent" />
                    ))}
                  </div>
                  <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-semibold text-ink-soft">
                    {r.dish}
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed text-ink-soft">&ldquo;{r.text}&rdquo;</p>
                <p className="mt-3 text-[12px] font-semibold text-ink">{r.name}</p>
              </div>
            ))}

            <div className="rounded-2xl border border-dashed border-accent/25 bg-accent/5 p-4 text-center">
              <p className="text-[13px] font-medium text-accent">
                Feedback collected after verified visits only
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  )
}
