'use client'

import { FadeIn, PrimaryButton, SecondaryButton, SectionShell } from './shared'

export function FinalCTA({ onBookDemo }: { onBookDemo: () => void }) {
  return (
    <SectionShell id="cta" dark className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_100%,rgba(122,35,51,0.25),transparent_60%)]"
      />
      <FadeIn className="relative text-center">
        <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
          Your next regular is already out there.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-white/55">
          Give every guest a better experience — and give them a reason to come back.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryButton href="/dashboard/login?mode=signup">Sign up now</PrimaryButton>
          <SecondaryButton dark onClick={onBookDemo}>
            Book a Demo
          </SecondaryButton>
        </div>
      </FadeIn>
    </SectionShell>
  )
}
