'use client'

import { Reveal } from './Reveal'

export default function AboutSection() {
  return (
    <section id="about" className="bg-white py-20 px-5 sm:px-8 sm:py-28" aria-labelledby="about-heading">
      <div className="mx-auto max-w-content">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            About us
          </p>
          <h2
            id="about-heading"
            className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl"
          >
            Built for restaurants that want regulars, not just footfall
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-base">
            Dinezy helps independent restaurants in India turn first-time diners into loyal
            regulars — with QR menus, WhatsApp automation, and loyalty tools built for how
            neighborhood restaurants actually run.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-8 border-t border-line pt-8 sm:flex-row sm:gap-14">
            {[
              { name: 'Aniket Tawde', role: 'Founder' },
              { name: 'Omkar Upadhey', role: 'Founder' },
            ].map((f) => (
              <div key={f.name} className="flex flex-col items-center">
                <span className="font-display text-lg font-semibold text-ink">{f.name}</span>
                <span className="mt-1 text-sm text-accent">{f.role}, Dinezy</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
