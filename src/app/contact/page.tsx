export const metadata = {
title: 'Contact Dinezy',
description:
'Get in touch with Dinezy for demos, support, partnerships, and restaurant onboarding.',
}

import {
Mail,
Phone,
MessageSquare,
ArrowRight,
} from 'lucide-react'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default function ContactPage() {
return ( <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white"> <section className="mx-auto max-w-7xl px-6 py-24"> <div className="mx-auto max-w-3xl text-center"> <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
Contact Dinezy </span>

```
      <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
        Let's Transform Your Restaurant Experience
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-slate-600">
        Whether you're running a restaurant, café, cloud kitchen,
        hotel, or food court, we'd love to show you how Dinezy can
        help you deliver a smarter dining experience.
      </p>
    </div>

    <div className="mt-16 grid gap-8 lg:grid-cols-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
          <Phone className="h-6 w-6 text-blue-700" />
        </div>

        <h3 className="text-xl font-semibold text-slate-900">
          Call Us
        </h3>

        <p className="mt-3 text-slate-600">
          Speak directly with us regarding onboarding,
          product demos, or support.
        </p>

        <a
          href="tel:+918605123549"
          className="mt-4 block font-semibold text-blue-700"
        >
          +91 86051 23549
        </a>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
          <Mail className="h-6 w-6 text-violet-700" />
        </div>

        <h3 className="text-xl font-semibold text-slate-900">
          Email Us
        </h3>

        <p className="mt-3 text-slate-600">
          Send us questions, feedback, partnership inquiries,
          or feature requests.
        </p>

        <a
          href="mailto:anikettawdee@gmail.com"
          className="mt-4 block font-semibold text-violet-700"
        >
          anikettawdee@gmail.com
        </a>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
          <MessageSquare className="h-6 w-6 text-emerald-700" />
        </div>

        <h3 className="text-xl font-semibold text-slate-900">
          Product Demo
        </h3>

        <p className="mt-3 text-slate-600">
          Schedule a live demo and see how Dinezy can improve
          customer experience and restaurant efficiency.
        </p>

        <a
          href="tel:+918605123549"
          className="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-700"
        >
          Book a Demo
          <ArrowRight size={16} />
        </a>
      </div>
    </div>

    <div className="mt-20 rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm">
      <h2 className="text-3xl font-bold text-slate-900">
        Why Restaurants Choose Dinezy
      </h2>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-3xl font-bold text-blue-600">AI</div>
          <p className="mt-2 text-slate-600">
            Intelligent dish recommendations
          </p>
        </div>

        <div>
          <div className="text-3xl font-bold text-violet-600">QR</div>
          <p className="mt-2 text-slate-600">
            Instant digital menu access
          </p>
        </div>

        <div>
          <div className="text-3xl font-bold text-emerald-600">
            Live
          </div>
          <p className="mt-2 text-slate-600">
            Real-time menu management
          </p>
        </div>

        <div>
          <div className="text-3xl font-bold text-orange-600">
            Smart
          </div>
          <p className="mt-2 text-slate-600">
            Waiter call and analytics system
          </p>
        </div>
      </div>
    </div>
  </section>
</main>


)
}
