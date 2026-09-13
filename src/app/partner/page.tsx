"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Menu,
  QrCode,
  Sparkles,
  Store,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";

const partnerBenefits = [
  {
    icon: Wallet,
    title: "Earn real commission",
    body: "Get 10% of what every restaurant you bring on pays Dinezy. There's no cap on how many restaurants you refer.",
  },
  {
    icon: Users,
    title: "No experience needed",
    body: "You don't need a sales background or a tech background. If restaurant owners trust you, that's the whole qualification.",
  },
  {
    icon: QrCode,
    title: "We keep setup simple",
    body: "A guided dashboard walks you and the restaurant through going live — menu, tables and QR codes included.",
  },
  {
    icon: TrendingUp,
    title: "Work on your own time",
    body: "No targets, no fixed hours. Bring on one restaurant this month or ten — it's entirely up to you.",
  },
];

const partnerTypes = [
  {
    icon: Store,
    title: "Local salespeople",
    body: "Already visiting restaurants? Add Dinezy to the products you sell and the conversations you already have.",
  },
  {
    icon: TrendingUp,
    title: "Digital marketers",
    body: "Offer restaurants a useful digital product alongside websites, social media and marketing services.",
  },
  {
    icon: QrCode,
    title: "POS & tech consultants",
    body: "Help restaurants modernize their customer experience without asking them to replace their existing POS.",
  },
  {
    icon: Users,
    title: "Freelancers & local connectors",
    body: "Turn your restaurant network, local relationships or business contacts into an additional income stream.",
  },
];

const faqs = [
  {
    q: "What does a Dinezy Partner actually do?",
    a: "You introduce restaurant owners to Dinezy and help them get started. Our dashboard guides you through the setup step by step — adding the menu, photos, tables and QR codes — so you don't need any technical background to do it.",
  },
  {
    q: "Do I need sales experience?",
    a: "No. If you're comfortable having a conversation with a restaurant owner you already know or can reach, that's all the experience this needs.",
  },
  {
    q: "Who owns the restaurant's account?",
    a: "The restaurant does. You set up their workspace through the partner dashboard, but the owner remains in control of their own Dinezy account.",
  },
  {
    q: "Do I collect the restaurant's payment?",
    a: "No — and you shouldn't. Restaurants pay Dinezy directly through Dinezy's own payment process. Your commission is calculated and recorded separately once they've paid.",
  },
  {
    q: "When do I get paid?",
    a: "Your commission is recorded once the restaurant you referred becomes a paying Dinezy customer. Payout timing and any eligibility conditions follow the current partner terms.",
  },
  {
    q: "Is there a monthly target?",
    a: "No. There's no fixed target in the current program — refer restaurants at whatever pace fits your schedule.",
  },
];

const howItWorks = [
  {
    number: "01",
    title: "Introduce Dinezy",
    body: "Tell a restaurant owner in your network about Dinezy and what it does for their customers.",
  },
  {
    number: "02",
    title: "Help them get set up",
    body: "Our guided dashboard takes you through it — menu, photos, tables and QR codes. Most restaurants are ready within a day.",
  },
  {
    number: "03",
    title: "Get paid",
    body: "Once the restaurant becomes a paying Dinezy customer, your 10% commission is recorded and paid out.",
  },
];

export default function PartnerPage() {
  const [restaurantCount, setRestaurantCount] = useState(10);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  /**
   * Current Dinezy annual plan.
   * Keep pricing centralized so it can be changed later.
   */
  const annualPlan = 8999;

  /**
   * Current partner commission.
   */
  const commissionRate = 0.1;

  /**
   * Example annual-plan commission.
   */
  const commissionPerRestaurant = Math.round(annualPlan * commissionRate);

  const estimatedEarnings = useMemo(
    () => restaurantCount * commissionPerRestaurant,
    [restaurantCount, commissionPerRestaurant]
  );

  return (
    <main
      className="min-h-screen overflow-x-hidden"
      style={
        {
          "--burgundy": "#7A2333",
          "--burgundy-dark": "#5E1827",
          "--ivory": "#FBF6EC",
          "--cream": "#F5EBDD",
          "--ink": "#2B2118",
          "--muted": "#756A60",
          "--amber": "#C98A3E",
          "--rose": "#F1E4E6",
          "--card": "#FFFDF8",
        } as React.CSSProperties
      }
    >
      {/* =========================================================
          NAVBAR
      ========================================================= */}
      <header
        className="sticky top-0 z-50 border-b bg-[#FBF6EC]/90 backdrop-blur-xl"
        style={{ borderColor: "rgba(43,33,24,0.08)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link
            href="/"
            className="text-xl font-semibold tracking-[-0.03em]"
            style={{
              fontFamily: "var(--font-fraunces, Georgia, serif)",
              color: "var(--ink)",
            }}
          >
            Dinezy
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#earnings" className="text-sm transition-opacity hover:opacity-60">
              Earnings
            </a>

            <a href="#what-you-do" className="text-sm transition-opacity hover:opacity-60">
              Why partner
            </a>

            <a href="#how-it-works" className="text-sm transition-opacity hover:opacity-60">
              How it works
            </a>

            <a href="#faq" className="text-sm transition-opacity hover:opacity-60">
              FAQ
            </a>

            <Link href="/partner/login" className="text-sm transition-opacity hover:opacity-60">
              Sign in
            </Link>

            <Link
              href="/partner/signup"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ backgroundColor: "var(--burgundy)" }}
            >
              Become a partner
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            className="rounded-full p-2 md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t px-5 py-4 md:hidden" style={{ borderColor: "rgba(43,33,24,0.08)" }}>
            <div className="flex flex-col gap-1">
              <a href="#earnings" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm">
                Earnings
              </a>

              <a href="#what-you-do" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm">
                Why partner
              </a>

              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm">
                How it works
              </a>

              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm">
                FAQ
              </a>

              <Link href="/partner/login" className="rounded-xl px-3 py-3 text-sm">
                Sign in
              </Link>

              <Link
                href="/partner/signup"
                className="mt-2 rounded-xl px-4 py-3 text-center text-sm font-medium text-white"
                style={{ backgroundColor: "var(--burgundy)" }}
              >
                Become a partner
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:pt-28">
          <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div
                className="mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium"
                style={{
                  borderColor: "rgba(122,35,51,0.15)",
                  backgroundColor: "rgba(241,228,230,0.72)",
                  color: "var(--burgundy)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Dinezy Partner Program
              </div>

              <h1
                className="max-w-3xl text-[2.9rem] leading-[0.96] tracking-[-0.06em] sm:text-6xl lg:text-[5.15rem]"
                style={{
                  fontFamily: "var(--font-fraunces, Georgia, serif)",
                  color: "var(--ink)",
                }}
              >
                Know restaurant
                <br />
                owners?
                <br />
                <span style={{ color: "var(--burgundy)" }}>Get paid for it.</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 sm:text-lg" style={{ color: "var(--muted)" }}>
                Introduce Dinezy to restaurants in your network. When they come
                on board, you earn 10% — with no fixed hours, no targets, and
                nothing to pay upfront.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/partner/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                  style={{ backgroundColor: "var(--burgundy)" }}
                >
                  Become a Dinezy Partner
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a
                  href="#earnings"
                  className="inline-flex items-center justify-center rounded-full border px-6 py-3.5 text-sm font-semibold transition-all hover:bg-black/[0.03]"
                  style={{ borderColor: "rgba(43,33,24,0.14)", color: "var(--ink)" }}
                >
                  See what you could earn
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" style={{ color: "var(--amber)" }} />
                  10% commission
                </span>

                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" style={{ color: "var(--amber)" }} />
                  No joining fee
                </span>

                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" style={{ color: "var(--amber)" }} />
                  Flexible schedule
                </span>
              </div>
            </div>

            {/* Hero earnings preview */}
            <div className="relative lg:pl-8">
              <div
                className="rounded-[2rem] border p-4 shadow-2xl sm:p-5"
                style={{ borderColor: "rgba(43,33,24,0.08)", backgroundColor: "var(--card)" }}
              >
                <div
                  className="rounded-[1.5rem] p-5 sm:p-6"
                  style={{ backgroundColor: "var(--burgundy)", color: "var(--ivory)" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] opacity-60">Partner dashboard</p>

                      <p className="mt-2 text-lg" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
                        What you're earning
                      </p>
                    </div>

                    <div className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: "rgba(251,246,236,0.12)" }}>
                      8 active
                    </div>
                  </div>

                  <div className="mt-7 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(251,246,236,0.08)" }}>
                      <p className="text-xs opacity-55">Earned this month</p>
                      <p className="mt-1 text-2xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
                        ₹9,000
                      </p>
                    </div>

                    <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(251,246,236,0.08)" }}>
                      <p className="text-xs opacity-55">On the way</p>
                      <p className="mt-1 text-2xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
                        3
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {[
                      { name: "Spice Villa", progress: "100%", status: "Live · Paid" },
                      { name: "Cafe Aroma", progress: "74%", status: "Almost there" },
                      { name: "Punjabi Tadka", progress: "42%", status: "In progress" },
                    ].map((restaurant) => (
                      <div key={restaurant.name} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(251,246,236,0.07)" }}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{restaurant.name}</p>

                            <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-white/80" style={{ width: restaurant.progress }} />
                            </div>
                          </div>

                          <span className="text-xs opacity-60">{restaurant.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="absolute -bottom-5 -left-2 hidden items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-xl sm:flex lg:-left-5"
                style={{ backgroundColor: "var(--ivory)", borderColor: "rgba(43,33,24,0.08)" }}
              >
                <Wallet className="h-4 w-4" style={{ color: "var(--burgundy)" }} />
                Track every referral and payout in one place
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          STRIP
      ========================================================= */}
      <section
        className="border-y"
        style={{ borderColor: "rgba(43,33,24,0.08)", backgroundColor: "rgba(255,255,255,0.25)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-5 text-center text-sm font-medium sm:px-6" style={{ color: "var(--ink)" }}>
          <span>You introduce</span>
          <ArrowRight className="h-4 w-4 opacity-30" />
          <span>Restaurant joins</span>
          <ArrowRight className="h-4 w-4 opacity-30" />
          <span style={{ color: "var(--burgundy)" }}>You get paid</span>
        </div>
      </section>

      {/* =========================================================
          EARNINGS
      ========================================================= */}
      <section id="earnings" style={{ backgroundColor: "var(--cream)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--burgundy)" }}>
                Your earning potential
              </p>

              <h2 className="mt-4 text-3xl tracking-[-0.04em] sm:text-4xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
                See what your network could be worth.
              </h2>

              <p className="mt-5 max-w-md text-sm leading-7 sm:text-base" style={{ color: "var(--muted)" }}>
                Drag the slider to estimate your earnings, based on the
                current ₹8,999 annual plan and your 10% partner commission.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {[1, 5, 10, 20].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setRestaurantCount(count)}
                    className="rounded-full border px-3.5 py-2 text-xs font-medium transition-all"
                    style={{
                      borderColor: restaurantCount === count ? "var(--burgundy)" : "rgba(43,33,24,0.12)",
                      backgroundColor: restaurantCount === count ? "var(--burgundy)" : "transparent",
                      color: restaurantCount === count ? "white" : "var(--ink)",
                    }}
                  >
                    {count} {count === 1 ? "restaurant" : "restaurants"}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-[2rem] border p-6 shadow-xl sm:p-8"
              style={{ borderColor: "rgba(43,33,24,0.08)", backgroundColor: "var(--card)" }}
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    Restaurants referred
                  </p>

                  <p className="mt-2 text-4xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
                    {restaurantCount}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    You'd earn
                  </p>

                  <p className="mt-1 text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)", color: "var(--burgundy)" }}>
                    ₹{estimatedEarnings.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={restaurantCount}
                  onChange={(e) => setRestaurantCount(Number(e.target.value))}
                  aria-label="Number of restaurants"
                  className="w-full accent-[#7A2333]"
                />

                <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                  <span>1 restaurant</span>
                  <span>50 restaurants</span>
                </div>
              </div>

              <div className="mt-8 grid gap-3 rounded-2xl p-4 sm:grid-cols-3" style={{ backgroundColor: "var(--ivory)" }}>
                <div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Annual plan
                  </p>
                  <p className="mt-1 text-sm font-semibold">₹{annualPlan.toLocaleString("en-IN")}</p>
                </div>

                <div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Your commission
                  </p>
                  <p className="mt-1 text-sm font-semibold">10%</p>
                </div>

                <div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Per restaurant
                  </p>
                  <p className="mt-1 text-sm font-semibold">₹{commissionPerRestaurant.toLocaleString("en-IN")}</p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5" style={{ color: "var(--muted)" }}>
                Example calculation only. Final commission eligibility, payout
                timing and applicable revenue categories are governed by the
                current Dinezy Partner terms.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          WHY PARTNER
      ========================================================= */}
      <section id="what-you-do" className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--burgundy)" }}>
              Why partner with Dinezy
            </p>

            <h2 className="mt-4 max-w-md text-3xl leading-tight tracking-[-0.04em] sm:text-4xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
              A simple way to earn from relationships you already have.
            </h2>

            <p className="mt-5 max-w-md text-sm leading-7 sm:text-base" style={{ color: "var(--muted)" }}>
              You don't need to be a professional salesperson or a tech
              expert. If restaurant owners trust you, that's the whole
              qualification.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {partnerBenefits.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border p-6 sm:p-7"
                  style={{ borderColor: "rgba(43,33,24,0.09)", backgroundColor: "rgba(255,255,255,0.35)" }}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "var(--rose)", color: "var(--burgundy)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-7 text-base font-semibold">{item.title}</h3>

                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          HOW IT WORKS
      ========================================================= */}
      <section id="how-it-works" style={{ backgroundColor: "var(--rose)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--burgundy)" }}>
              Three steps, start to finish
            </p>

            <h2 className="mt-4 text-3xl tracking-[-0.04em] sm:text-4xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
              You don't have to figure this out alone.
            </h2>
          </div>

          <div className="mt-12 grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="space-y-8">
              {howItWorks.map((step) => (
                <div key={step.number} className="flex gap-5">
                  <span
                    className="text-3xl leading-none"
                    style={{ fontFamily: "var(--font-fraunces, Georgia, serif)", color: "var(--burgundy)" }}
                  >
                    {step.number}
                  </span>

                  <div>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-6" style={{ color: "var(--muted)" }}>
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Setup preview card */}
            <div
              className="rounded-[2rem] border p-4 shadow-xl sm:p-5"
              style={{ borderColor: "rgba(43,33,24,0.08)", backgroundColor: "var(--card)" }}
            >
              <div className="rounded-[1.5rem] p-5 sm:p-6" style={{ backgroundColor: "var(--cream)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Guided setup
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">Cafe Aroma</h3>
                  </div>

                  <span
                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{ backgroundColor: "rgba(122,35,51,0.10)", color: "var(--burgundy)" }}
                  >
                    74% done
                  </span>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(43,33,24,0.08)" }}>
                  <div className="h-full rounded-full" style={{ width: "74%", backgroundColor: "var(--burgundy)" }} />
                </div>

                <div className="mt-6 space-y-3">
                  {[
                    { icon: Check, title: "Restaurant details", status: "Done", complete: true },
                    { icon: ImageIcon, title: "Logo & photos", status: "Done", complete: true },
                    { icon: Upload, title: "Menu", status: "Done", complete: true },
                    { icon: QrCode, title: "Tables & QR codes", status: "The dashboard guides this", complete: false },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 rounded-2xl border bg-white/55 p-3.5"
                        style={{ borderColor: "rgba(43,33,24,0.07)" }}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: item.complete ? "var(--rose)" : "rgba(43,33,24,0.05)",
                            color: item.complete ? "var(--burgundy)" : "var(--muted)",
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                            {item.status}
                          </p>
                        </div>

                        {item.complete && <Check className="h-4 w-4 shrink-0" style={{ color: "var(--burgundy)" }} />}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-5 text-xs leading-5" style={{ color: "var(--muted)" }}>
                  Most restaurants go live the same day you start.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          PARTNER TYPES
      ========================================================= */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--burgundy)" }}>
              Who this is for
            </p>

            <h2 className="mt-4 text-3xl tracking-[-0.04em] sm:text-4xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
              Built for people who already know restaurants.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6" style={{ color: "var(--muted)" }}>
            Your advantage isn't a fancy sales background. It's access, trust
            and the ability to get a restaurant owner started.
          </p>
        </div>

        <div className="mt-10 flex snap-x gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-4 md:overflow-visible">
          {partnerTypes.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="min-w-[285px] snap-start rounded-3xl border p-6 md:min-w-0"
                style={{ borderColor: "rgba(43,33,24,0.08)", backgroundColor: "rgba(255,255,255,0.32)" }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "var(--rose)", color: "var(--burgundy)" }}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mt-7 text-base font-semibold">{item.title}</h3>

                <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          WHAT RESTAURANTS GET
      ========================================================= */}
      <section style={{ backgroundColor: "var(--ink)", color: "var(--ivory)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                What you're helping them adopt
              </p>

              <h2
                className="mt-4 max-w-xl text-3xl leading-tight tracking-[-0.04em] sm:text-4xl"
                style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}
              >
                A better customer experience, without replacing their POS.
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                Dinezy gives restaurants a digital menu, waiter-call
                experience and customer loyalty tools that work alongside
                their existing billing or POS setup — an easy story to tell.
              </p>

              <Link
                href="/partner/signup"
                className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold"
                style={{ backgroundColor: "var(--ivory)", color: "var(--burgundy)" }}
              >
                Start partnering
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "QR Digital Menu", body: "Customers can browse the menu directly from their table." },
                { title: "Waiter Call", body: "Customers can request assistance without repeatedly trying to get a server's attention." },
                { title: "Loyalty", body: "Help restaurants bring customers back with loyalty and WhatsApp engagement." },
                { title: "Restaurant Dashboard", body: "A central place for the restaurant to manage its Dinezy experience." },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl p-6 ring-1 ring-white/10"
                  style={{ backgroundColor: "rgba(251,246,236,0.05)" }}
                >
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          FAQ
      ========================================================= */}
      <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-6 sm:py-28">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--burgundy)" }}>
            FAQ
          </p>

          <h2 className="mt-4 text-3xl tracking-[-0.04em] sm:text-4xl" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}>
            Questions, answered.
          </h2>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border bg-white/30">
          {faqs.map((faq, index) => {
            const open = openFaq === index;

            return (
              <div key={faq.q} className="border-b last:border-b-0" style={{ borderColor: "rgba(43,33,24,0.08)" }}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left sm:px-6"
                  onClick={() => setOpenFaq(open ? null : index)}
                  aria-expanded={open}
                >
                  <span className="text-sm font-semibold sm:text-base">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className="px-5 pb-6 sm:px-6">
                    <p className="max-w-2xl text-sm leading-6" style={{ color: "var(--muted)" }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          FINAL CTA
      ========================================================= */}
      <section style={{ backgroundColor: "var(--burgundy)", color: "var(--ivory)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Become a partner</p>

            <h2
              className="mt-4 text-4xl leading-[1.02] tracking-[-0.05em] sm:text-6xl"
              style={{ fontFamily: "var(--font-fraunces, Georgia, serif)" }}
            >
              Know restaurant owners?
              <br />
              Turn that into income.
            </h2>

            <p className="mt-6 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
              Introduce restaurants to Dinezy, help them go live, and earn 10%
              on every one that becomes a paying customer.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/partner/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold"
                style={{ backgroundColor: "var(--ivory)", color: "var(--burgundy)" }}
              >
                Become a Dinezy Partner
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/partner/login"
                className="inline-flex items-center justify-center rounded-full border px-7 py-3.5 text-sm font-semibold text-white"
                style={{ borderColor: "rgba(251,246,236,0.25)" }}
              >
                Partner sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          MOBILE STICKY CTA
      ========================================================= */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-[#FBF6EC]/95 p-3 backdrop-blur-xl md:hidden">
        <Link
          href="/partner/signup"
          className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white shadow-lg"
          style={{ backgroundColor: "var(--burgundy)" }}
        >
          Become a Dinezy Partner
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}