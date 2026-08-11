'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, MessageCircle, Send, Users } from 'lucide-react'
import { Eyebrow, FadeIn, SectionHeading, SectionLead, SectionShell } from './shared'

const FLOW = [
  { label: 'Customer visits', icon: Users },
  { label: 'Relationship built', icon: CheckCircle2 },
  { label: 'WhatsApp message', icon: MessageCircle },
  { label: 'Customer returns', icon: ArrowRight },
]

const FEATURES = [
  'Connect your own WhatsApp Business account',
  'WhatsApp campaigns & approved templates',
  'Automated post-visit messages',
  'Win-back campaigns for inactive guests',
  'Two-way customer conversations',
  'Engagement tracking per campaign',
]

export function WhatsAppSection() {
  return (
    <SectionShell id="whatsapp" className="bg-canvas">
      <FadeIn>
        <Eyebrow>WhatsApp marketing</Eyebrow>
        <SectionHeading>
          Stay connected <span className="text-accent">after they leave.</span>
        </SectionHeading>
        <SectionLead>
          Connect your restaurant&apos;s own WhatsApp Business account. Dinezy turns visit data
          into personal messages that bring guests back — without feeling spammy.
        </SectionLead>
      </FadeIn>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <FadeIn delay={0.05}>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {FLOW.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-elegant-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#128C7E]">
                    <step.icon size={15} />
                  </div>
                  <span className="text-[12px] font-semibold">{step.label}</span>
                </div>
                {i < FLOW.length - 1 && (
                  <ArrowRight size={14} className="hidden text-ink-faint sm:block" />
                )}
              </div>
            ))}
          </div>

          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[14px] text-ink-soft">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-elegant-md sm:p-6">
            <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white">
                <MessageCircle size={18} />
              </div>
              <div>
                <p className="text-[14px] font-semibold">Spice Route Kitchen</p>
                <p className="text-[11px] text-ink-faint">WhatsApp Business · Verified</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-[#DCF8C6] px-4 py-3 text-[13px] leading-relaxed text-ink">
                <p className="mb-1 text-[10px] font-semibold text-[#128C7E]">Campaign · Win-back</p>
                Hi Priya! It&apos;s been a while since your last visit. We&apos;ve saved your
                favourite Paneer Tikka spot — come back this week and earn 50 bonus points. 🍽️
                <p className="mt-2 text-[10px] text-ink-faint">Delivered · Read</p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="max-w-[75%] rounded-2xl rounded-tl-md border border-line bg-canvas px-4 py-3 text-[13px]"
              >
                Sounds great! Can I book for Saturday?
              </motion.div>

              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-[#DCF8C6] px-4 py-3 text-[13px]">
                Absolutely! Reply with your preferred time and we&apos;ll confirm your table.
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5">
              <Send size={14} className="text-ink-faint" />
              <span className="text-[12px] text-ink-faint">Type a message…</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  )
}
