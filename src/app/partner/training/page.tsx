
'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  GraduationCap,
  Lightbulb,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Wallet,
} from 'lucide-react'

const BRAND = {
  ivory: '#FBF6EC',
  cream: '#F5EBDD',
  white: '#FFFFFF',
  ink: '#2B2118',
  muted: '#756A60',
  line: '#E7DDC9',
  burgundy: '#7A2333',
  gold: '#C98A3E',
  green: '#2F7A5C',
}

type Section = {
  title: string
  body?: string
  bullets?: string[]
  script?: string
  note?: string
}

type Module = {
  id: string
  number: string
  icon: React.ReactNode
  title: string
  description: string
  time: string
  sections: Section[]
}

const modules: Module[] = [
  {
    id: 'target',
    number: '01',
    icon: <Target size={17} />,
    title: 'Which restaurants should I target?',
    description:
      'Start with restaurants where Dinezy is most likely to make a real difference.',
    time: '3 min',
    sections: [
      {
        title: 'Target these first',
        bullets: [
          'Fine-dining restaurants',
          'Bars and pubs',
          'Restaurants with 30+ seats',
          'Busy dine-in restaurants',
          'Restaurants with multiple table sections',
          'Restaurants that care about presentation',
        ],
      },
      {
        title: 'Look for a problem',
        bullets: [
          'Printed menus that need frequent updates',
          'An outdated or inconvenient digital menu',
          'QR codes that redirect customers through unnecessary steps',
          'Customers asking staff basic menu questions',
          'Frequent changes to prices or menu items',
        ],
      },
      {
        title: 'Easy rule',
        body:
          'Prioritize restaurants where there is both a visible menu problem and enough table traffic for Dinezy to matter.',
        note:
          'Fine dining + bar/pub + 30+ seats = excellent target.',
      },
    ],
  },
  {
    id: 'approach',
    number: '02',
    icon: <MessageCircle size={17} />,
    title: 'How do I approach a restaurant?',
    description:
      'Your first job is to start a conversation, not immediately close the deal.',
    time: '3 min',
    sections: [
      {
        title: 'Opening script',
        script:
          '“Hi, I work with Dinezy. I noticed your restaurant and wanted to show you a simpler way for customers to access your menu. Can I take 60 seconds to show you?”',
      },
      {
        title: 'Question-first opening',
        script:
          '“Hi, do you currently use a digital menu for your tables?”',
      },
      {
        title: 'Remember',
        bullets: [
          'Be friendly and brief',
          'Try to speak to the owner or manager',
          'Do not start with pricing',
          'Do not list every feature',
          'Ask questions and listen',
        ],
      },
    ],
  },
  {
    id: 'discovery',
    number: '03',
    icon: <Search size={17} />,
    title: 'Find the problem',
    description:
      'Use questions to understand how the restaurant currently handles menus.',
    time: '3 min',
    sections: [
      {
        title: 'Ask these questions',
        bullets: [
          '“Do you currently use a digital menu?”',
          '“What happens after customers scan your QR?”',
          '“How do you update prices or menu items?”',
          '“Do you have to reprint menus when something changes?”',
          '“Do customers ever ask staff basic menu questions?”',
        ],
      },
      {
        title: 'If they already have a QR',
        script:
          '“That’s great. What happens after the customer scans it?”',
        note:
          'Never attack their current solution. Understand it first.',
      },
      {
        title: 'If the QR opens WhatsApp',
        script:
          '“Got it. So the customer scans and then has to go through WhatsApp before seeing the menu?”',
      },
    ],
  },
  {
    id: 'pitch',
    number: '04',
    icon: <Sparkles size={17} />,
    title: 'How to pitch Dinezy',
    description:
      'Explain the outcome instead of dumping features.',
    time: '3 min',
    sections: [
      {
        title: 'Core pitch',
        script:
          '“Dinezy gives your customers the menu directly after scanning. No unnecessary redirects. The menu looks professional, and you can update items and prices without reprinting the menu.”',
      },
      {
        title: 'Customer experience pitch',
        script:
          '“The biggest difference is the experience. Customers scan, the menu opens, and they can start browsing immediately.”',
      },
      {
        title: 'Then show the product',
        bullets: [
          'Scan the QR',
          'Open the menu',
          'Show the design',
          'Show the customer journey',
          'Show how the restaurant can update its menu',
        ],
      },
    ],
  },
  {
    id: 'objections',
    number: '05',
    icon: <ShieldCheck size={17} />,
    title: 'How to handle objections',
    description:
      'Stay calm. Acknowledge the objection, ask a question, then move forward.',
    time: '5 min',
    sections: [
      {
        title: '“We already have a QR menu.”',
        script:
          '“Absolutely. What happens after customers scan it? Let me understand your current flow and show you how Dinezy compares.”',
      },
      {
        title: '“We already use WhatsApp.”',
        script:
          '“That makes sense. With Dinezy, the customer gets the menu directly instead of taking another step before seeing it. Let me show you.”',
      },
      {
        title: '“We don’t need it.”',
        script:
          '“Understood. How do you currently update your menu when prices or items change?”',
      },
      {
        title: '“It’s too expensive.”',
        script:
          '“I understand. Let me first show you exactly what the customer gets and how your team uses it. Then you can decide whether it makes sense.”',
      },
      {
        title: '“We’ll think about it.”',
        script:
          '“Of course. What would you like to think about — the price, the setup, or whether your customers would use it?”',
      },
    ],
  },
  {
    id: 'close',
    number: '06',
    icon: <Check size={17} />,
    title: 'How to close',
    description:
      'Once the restaurant understands the value, ask for the next step.',
    time: '3 min',
    sections: [
      {
        title: 'Look for buying signals',
        bullets: [
          '“How much does it cost?”',
          '“How long does setup take?”',
          '“Can we update it ourselves?”',
          '“Can this work on all our tables?”',
          '“Can you show me the menu?”',
        ],
      },
      {
        title: 'Confirmation close',
        script:
          '“So the main thing you liked is that customers can access the menu directly and you can update it without reprinting. Correct?”',
      },
      {
        title: 'Direct close',
        script:
          '“Great. Let’s get your Dinezy account started now. It’ll only take a few minutes.”',
      },
      {
        title: 'Hesitation close',
        script:
          '“What would need to be true for you to feel comfortable starting?”',
      },
    ],
  },
  {
    id: 'add',
    number: '07',
    icon: <Plus size={17} />,
    title: 'How to add a restaurant',
    description:
      'Follow this exact process after the restaurant says yes.',
    time: '5 min',
    sections: [
      {
        title: 'Step 1 — Click Add Restaurant',
        body:
          'Start from the Partner Dashboard and click Add Restaurant.',
        bullets: [
          'Open your partner dashboard',
          'Click Add Restaurant',
          'The restaurant signup flow opens',
          'Make sure the restaurant signs up through your referral link',
        ],
      },
      {
        title: 'Step 2 — Open the restaurant',
        body:
          'After signup, open the restaurant workspace from your partner dashboard.',
        bullets: [
          'Click the restaurant',
          'Open its dashboard',
          'Confirm the basic restaurant information',
        ],
      },
      {
        title: 'Step 3 — Fill restaurant details',
        bullets: [
          'Restaurant name',
          'Address',
          'Contact information',
          'Cuisine and restaurant information',
          'Any remaining setup information',
        ],
      },
      {
        title: 'Step 4 — Build the menu',
        bullets: [
          'Open Menu',
          'Import the restaurant menu using AI',
          'Review imported categories and items',
          'Check every price',
          'Correct item names and descriptions',
          'Confirm the menu with the restaurant',
        ],
        note:
          'AI makes the process faster, but always review the imported menu before publishing.',
      },
      {
        title: 'Step 5 — Automatch images',
        bullets: [
          'Run Automatch Image',
          'Review the suggested images',
          'Replace incorrect images',
          'Make sure the image matches the actual dish',
        ],
      },
      {
        title: 'Step 6 — Create the QR',
        bullets: [
          'Open the QR section',
          'Customize the QR to match the restaurant',
          'Select the number of tables',
          'Generate the QR codes',
          'Download the QR package',
        ],
      },
      {
        title: 'Step 7 — Get QR codes onto tables',
        script:
          '“The QR codes are ready. Please get them printed and place one clearly on every table so customers can scan and open your Dinezy menu.”',
        note:
          'Your job is not finished when the QR is downloaded. Make sure the restaurant prints and places the QR codes on the tables.',
      },
    ],
  },
  {
    id: 'followup',
    number: '08',
    icon: <Clock3 size={17} />,
    title: 'Follow up and convert',
    description:
      'The signup is not the finish line. Help the restaurant reach the yearly plan.',
    time: '4 min',
    sections: [
      {
        title: 'After setup',
        bullets: [
          'Confirm the menu is live',
          'Confirm QR codes are printed',
          'Make sure one QR is placed on every table',
          'Ask the restaurant to test the QR',
          'Check the customer experience yourself',
        ],
      },
      {
        title: 'During trial',
        script:
          '“How has Dinezy been working for your customers so far? Is there anything you want us to fix before you continue on the yearly plan?”',
      },
      {
        title: 'Ask for yearly conversion',
        script:
          '“You’ve had a chance to use Dinezy now. Would you like to continue with the yearly plan?”',
      },
      {
        title: 'Commission flow',
        body:
          'When the restaurant successfully pays for the yearly plan, the commission enters the payout flow.',
        note:
          'Partner journey: restaurant pays yearly → 7-day payout window → commission available.',
      },
    ],
  },
]

export default function PartnerTrainingPage() {
  const [open, setOpen] =
    useState<string>('target')

  const [copied, setCopied] =
    useState(false)

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(
        text,
      )

      setCopied(true)

      window.setTimeout(
        () => setCopied(false),
        1200,
      )
    } catch {
      // Ignore clipboard errors.
    }
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          BRAND.ivory,
        color: BRAND.ink,
      }}
    >
      <header
        className="sticky top-0 z-30 border-b bg-[#FBF6EC]/95 backdrop-blur-xl"
        style={{
          borderColor:
            BRAND.line,
        }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link
            href="/partner/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background:
                BRAND.cream,
            }}
          >
            <ArrowLeft
              size={16}
            />
          </Link>

          <div>
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.15em]"
              style={{
                color:
                  BRAND.burgundy,
              }}
            >
              Dinezy Partner
            </p>

            <p className="text-sm font-semibold">
              Sales playbook
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 pb-12">
        {/* HERO */}
        <section
          className="rounded-[1.5rem] p-5 text-white"
          style={{
            background:
              BRAND.burgundy,
          }}
        >
          <div className="flex items-center gap-2 text-white/55">
            <GraduationCap
              size={17}
            />

            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">
              Partner training
            </span>
          </div>

          <h1
            className="mt-3 text-2xl leading-tight"
            style={{
              fontFamily:
                'var(--font-fraunces, Georgia, serif)',
            }}
          >
            Know who to target.
            Know what to say.
            Know how to close.
          </h1>

          <p className="mt-2 text-xs leading-5 text-white/60">
            Use this before you visit a restaurant,
            during the conversation and after they
            sign up.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <div className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-semibold">
              8 modules
            </div>

            <div className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-semibold">
              ~27 min
            </div>
          </div>
        </section>

        {/* SALES FLOW */}
        <section className="mt-4">
          <div
            className="rounded-[1.5rem] border bg-white p-4"
            style={{
              borderColor:
                BRAND.line,
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.15em]"
              style={{
                color:
                  BRAND.burgundy,
              }}
            >
              Your sales journey
            </p>

            <div className="mt-4 flex items-center overflow-x-auto pb-1">
              {[
                [
                  <Target size={14} />,
                  'Target',
                ],
                [
                  <MessageCircle size={14} />,
                  'Talk',
                ],
                [
                  <Sparkles size={14} />,
                  'Demo',
                ],
                [
                  <Check size={14} />,
                  'Close',
                ],
                [
                  <Store size={14} />,
                  'Setup',
                ],
                [
                  <Wallet size={14} />,
                  'Earn',
                ],
              ].map(
                ([icon, title], index) => (
                  <div
                    key={String(title)}
                    className="flex shrink-0 items-center"
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          background:
                            `${BRAND.burgundy}10`,
                          color:
                            BRAND.burgundy,
                        }}
                      >
                        {icon}
                      </div>

                      <span className="mt-1 text-[8px] font-semibold">
                        {String(title)}
                      </span>
                    </div>

                    {index < 5 && (
                      <ArrowRight
                        size={12}
                        className="mx-2"
                        style={{
                          color:
                            BRAND.muted,
                        }}
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        {/* MODULES */}
        <section className="mt-4 space-y-2">
          {modules.map(
            (module) => {
              const isOpen =
                open === module.id

              return (
                <div
                  key={module.id}
                  className="overflow-hidden rounded-[1.25rem] border bg-white"
                  style={{
                    borderColor:
                      BRAND.line,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpen(
                        isOpen
                          ? ''
                          : module.id,
                      )
                    }
                    className="flex w-full items-center gap-3 px-4 py-4 text-left"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background:
                          isOpen
                            ? `${BRAND.burgundy}10`
                            : BRAND.cream,
                        color:
                          BRAND.burgundy,
                      }}
                    >
                      {module.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-semibold text-black/35">
                          {module.number}
                        </span>

                        <p className="text-xs font-semibold sm:text-sm">
                          {
                            module.title
                          }
                        </p>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <Clock3
                          size={10}
                          style={{
                            color:
                              BRAND.muted,
                          }}
                        />

                        <span
                          className="text-[9px]"
                          style={{
                            color:
                              BRAND.muted,
                          }}
                        >
                          {
                            module.time
                          }
                        </span>
                      </div>
                    </div>

                    <ChevronDown
                      size={16}
                      className={`shrink-0 transition-transform ${
                        isOpen
                          ? 'rotate-180'
                          : ''
                      }`}
                      style={{
                        color:
                          BRAND.muted,
                      }}
                    />
                  </button>

                  {isOpen && (
                    <div
                      className="border-t px-4 pb-5 pt-4"
                      style={{
                        borderColor:
                          BRAND.line,
                        background:
                          '#FFFCF7',
                      }}
                    >
                      <p
                        className="text-xs leading-5"
                        style={{
                          color:
                            BRAND.muted,
                        }}
                      >
                        {
                          module.description
                        }
                      </p>

                      <div className="mt-4 space-y-3">
                        {module.sections.map(
                          (
                            section,
                            sectionIndex,
                          ) => (
                            <div
                              key={`${module.id}-${sectionIndex}`}
                              className="rounded-xl border bg-white p-4"
                              style={{
                                borderColor:
                                  BRAND.line,
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    background:
                                      BRAND.burgundy,
                                  }}
                                />

                                <p className="text-xs font-semibold">
                                  {
                                    section.title
                                  }
                                </p>
                              </div>

                              {section.body && (
                                <p
                                  className="mt-2 text-[11px] leading-5"
                                  style={{
                                    color:
                                      BRAND.muted,
                                  }}
                                >
                                  {
                                    section.body
                                  }
                                </p>
                              )}

                              {section.bullets && (
                                <div className="mt-3 space-y-2">
                                  {section.bullets.map(
                                    (
                                      bullet,
                                    ) => (
                                      <div
                                        key={
                                          bullet
                                        }
                                        className="flex items-start gap-2"
                                      >
                                        <Check
                                          size={
                                            13
                                          }
                                          className="mt-0.5 shrink-0"
                                          style={{
                                            color:
                                              BRAND.green,
                                          }}
                                        />

                                        <span
                                          className="text-[11px] leading-5"
                                          style={{
                                            color:
                                              BRAND.muted,
                                          }}
                                        >
                                          {
                                            bullet
                                          }
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}

                              {section.script && (
                                <div
                                  className="mt-3 rounded-xl p-3.5"
                                  style={{
                                    background:
                                      `${BRAND.burgundy}07`,
                                    border:
                                      `1px solid ${BRAND.burgundy}18`,
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p
                                      className="text-[9px] font-semibold uppercase tracking-[0.13em]"
                                      style={{
                                        color:
                                          BRAND.burgundy,
                                      }}
                                    >
                                      Say this
                                    </p>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void copyText(
                                          section.script ||
                                            '',
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold"
                                      style={{
                                        background:
                                          BRAND.cream,
                                        color:
                                          BRAND.burgundy,
                                      }}
                                    >
                                      <Copy
                                        size={
                                          11
                                        }
                                      />
                                      {copied
                                        ? 'Copied'
                                        : 'Copy'}
                                    </button>
                                  </div>

                                  <p className="mt-2 text-xs leading-5">
                                    “
                                    {
                                      section.script
                                    }
                                    ”
                                  </p>
                                </div>
                              )}

                              {section.note && (
                                <div
                                  className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5"
                                  style={{
                                    background:
                                      BRAND.cream,
                                  }}
                                >
                                  <Lightbulb
                                    size={
                                      13
                                    }
                                    className="mt-0.5 shrink-0"
                                    style={{
                                      color:
                                        BRAND.gold,
                                    }}
                                  />

                                  <p
                                    className="text-[10px] leading-4"
                                    style={{
                                      color:
                                        BRAND.muted,
                                    }}
                                  >
                                    {
                                      section.note
                                    }
                                  </p>
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            },
          )}
        </section>

        {/* GOLDEN RULE */}
        <section className="mt-5">
          <div
            className="rounded-[1.5rem] p-5"
            style={{
              background:
                BRAND.cream,
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.15em]"
              style={{
                color:
                  BRAND.burgundy,
              }}
            >
              Remember this
            </p>

            <h2
              className="mt-2 text-lg"
              style={{
                fontFamily:
                  'var(--font-fraunces, Georgia, serif)',
              }}
            >
              Listen → Find the pain →
              Show Dinezy → Close.
            </h2>

            <p
              className="mt-2 text-[11px] leading-5"
              style={{
                color:
                  BRAND.muted,
              }}
            >
              You do not need to talk more.
              You need to ask better questions.
            </p>
          </div>
        </section>

        {/* DASHBOARD CTA */}
        <Link
          href="/partner/dashboard"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-semibold text-white"
          style={{
            background:
              BRAND.burgundy,
          }}
        >
          Back to partner dashboard
          <ArrowRight
            size={14}
          />
        </Link>
      </div>
    </main>
  )
}
