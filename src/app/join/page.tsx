'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from 'react'
import { type ConfirmationResult } from 'firebase/auth'
import { sendOTP, verifyOTP, clearRecaptcha, prepareRecaptcha } from '@/lib/firebase'
import {
  Sparkles, Utensils, MapPin, Gift, Wallet, ChevronRight,
  Loader2, PartyPopper, Phone, Shield, ArrowRight, HelpCircle, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
// Note: 'hero' screen is gone on purpose. The person already clicked an ad to
// get here — the quiz itself is the landing page, so we open straight on q1.

type Screen = 'q1' | 'q2' | 'q3' | 'q4' | 'reveal' | 'phone' | 'otp' | 'name' | 'done'

interface Answers {
  freq: string | null
  frustration: string | null
  hypothetical: string | null
  redemption: string | null
}

const QUESTIONS: Record<'q1' | 'q2' | 'q3' | 'q4', { title: string; eyebrow?: string; options: string[] }> = {
  q1: {
    title: 'How often do you step out to eat?',
    options: ['Almost daily', 'A few times a week', 'A few times a month', 'Only on special days'],
  },
  q2: {
    title: "What's wrong with restaurant loyalty cards today?",
    options: ['Points expire before I use them', 'Too much hassle for too little', "I don't bother collecting", "They're not real money anyway"],
  },
  q3: {
    title: 'If your favourite restaurant quietly paid you back every time you visited — would you go more often?',
    options: ['Yes, definitely', 'Maybe, depends how much', 'Probably not, I go anyway'],
  },
  q4: {
    title: 'If you had reward points, what would you actually want them as?',
    eyebrow: 'Last one — this decides your reward format',
    options: ['Amazon Pay balance', 'Zomato / Swiggy credit', 'Straight discount on my bill', "Doesn't matter, just give me real value"],
  },
}

const QUIZ_ORDER: Screen[] = ['q1', 'q2', 'q3', 'q4']

// Matches the real in-app quest mechanics (QuestCard) so the preview here
// is not just reassuring copy — it's the exact same numbers they'll see
// in their account once Dinezy is live near them.
const POINTS_PER_VISIT = 50
const TARGET_VISITS = 3
const TARGET_POINTS = POINTS_PER_VISIT * TARGET_VISITS

// Rough monthly visit cadence per quiz answer, used only to personalise the
// reveal screen with real product mechanics — never shown as a claim about
// other users, just the person's own likely math.
const VISITS_PER_MONTH: Record<string, number> = {
  'Almost daily': 26,
  'A few times a week': 10,
  'A few times a month': 4,
  'Only on special days': 1,
}

function estimateMonthly(freq: string | null) {
  const visits = (freq && VISITS_PER_MONTH[freq]) ?? 4
  const points = visits * POINTS_PER_VISIT
  const cards = Math.max(1, Math.floor(visits / TARGET_VISITS))
  return { visits, points, cards }
}

// ─── Haptics ───────────────────────────────────────────────────────────────────

function haptic(pattern: number | number[] = 10) {
  if (typeof window === 'undefined') return
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // haptics are a nice-to-have, never let this break the flow
  }
}

// ─── Analytics beacon ──────────────────────────────────────────────────────────

function track(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/waitlist/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/waitlist/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
    }
  } catch {
    // tracking must never break the actual flow
  }
}

// ─── Reusable pressable primitives (scale + haptic on every tap) ─────────────

function PrimaryButton({
  onClick, disabled, loading, children, style,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const [pressed, setPressed] = useState(false)
  const isDisabled = Boolean(disabled || loading)
  return (
    <button
      type="button"
      disabled={isDisabled}
      onPointerDown={() => !isDisabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={() => { if (!isDisabled) { haptic(15); onClick() } }}
      style={{
        width: '100%', height: 54,
        background: isDisabled ? 'rgba(232,197,71,0.15)' : 'linear-gradient(135deg, #E8C547 0%, #d4a93c 100%)',
        border: 'none', borderRadius: 14,
        color: isDisabled ? 'rgba(232,197,71,0.4)' : '#111',
        fontSize: 15.5, fontWeight: 700, fontFamily: 'var(--font-body)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        touchAction: 'manipulation',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.12s ease, background 0.2s ease',
        ...style,
      } as React.CSSProperties}
    >
      {children}
    </button>
  )
}

function OptionButton({ label, onSelect }: { label: string; onSelect: () => void }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={onSelect}
      style={{
        width: '100%', textAlign: 'left', padding: '16px 18px',
        background: pressed ? 'rgba(232,197,71,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${pressed ? 'rgba(232,197,71,0.35)' : 'rgba(255,255,255,0.09)'}`,
        borderRadius: 14, color: '#FAFAF7', fontSize: 14.5, fontWeight: 500,
        fontFamily: 'var(--font-body)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'all 0.15s ease', touchAction: 'manipulation',
      } as React.CSSProperties}
    >
      {label} <ChevronRight size={15} color="rgba(250,250,247,0.3)" />
    </button>
  )
}

// ─── Single OTP input (matches OTPLoginModal) ─────────────────────────────────

function SingleOTPInput({
  value, onChange, disabled, onSubmit,
}: { value: string; onChange: (v: string) => void; disabled: boolean; onSubmit: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="• • • • • •"
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, '').slice(0, 6)
        onChange(next)
        if (next.length === 6) haptic([10, 30, 10])
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' && value.length === 6) onSubmit() }}
      onFocus={(e) => e.target.select()}
      style={{
        width: '100%', height: 60, textAlign: 'center', fontSize: 26, fontWeight: 700,
        letterSpacing: '0.5em', textIndent: '0.5em', fontFamily: 'var(--font-body)',
        background: value ? 'rgba(232,197,71,0.08)' : 'rgba(255,255,255,0.05)',
        border: `1.5px solid ${value ? 'rgba(232,197,71,0.4)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 16, color: '#FAFAF7', outline: 'none', transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1, WebkitAppearance: 'none', touchAction: 'manipulation', boxSizing: 'border-box',
      } as React.CSSProperties}
    />
  )
}

// ─── Progress / points ticker + trust strip (the page's signature element) ───

function ProgressBar({ screen, quizPoints, pointsBump, onFaqOpen }: {
  screen: Screen; quizPoints: number; pointsBump: boolean; onFaqOpen: () => void
}) {
  const idx = QUIZ_ORDER.indexOf(screen)
  if (idx === -1) return null
  const pct = ((idx + 1) / QUIZ_ORDER.length) * 100
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(14,14,14,0.92)', backdropFilter: 'blur(10px)', padding: '14px 20px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, maxWidth: 480, margin: '0 auto 8px' }}>
        <span style={{ fontSize: 11, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
          Question {idx + 1} of {QUIZ_ORDER.length}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={pointsBump ? 'points-bump' : ''}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
              color: '#E8C547', fontFamily: 'var(--font-body)',
              background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.2)',
              borderRadius: 999, padding: '3px 10px', transition: 'all 0.3s',
            }}
          >
            <Sparkles size={11} /> {quizPoints} pts
          </span>
          <button
            type="button"
            onClick={onFaqOpen}
            aria-label="Frequently asked questions"
            style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(250,250,247,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
          >
            <HelpCircle size={13} />
          </button>
        </div>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', maxWidth: 480, margin: '0 auto' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, #E8C547, #FF5C35)',
          borderRadius: 999, transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

// ─── Reward + trust banner (shown on every quiz screen) ───────────────────────

function RewardBanner() {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(232,197,71,0.08)', border: '1px solid rgba(232,197,71,0.2)',
        borderRadius: 14, padding: '11px 14px', marginBottom: 10,
      }}>
        <div style={{
          flexShrink: 0, width: 30, height: 30, borderRadius: 10,
          background: 'rgba(232,197,71,0.14)', border: '1px solid rgba(232,197,71,0.24)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Gift size={14} color="#E8C547" />
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(250,250,247,0.75)', fontFamily: 'var(--font-body)', lineHeight: 1.4 }}>
          <span style={{ color: '#E8C547', fontWeight: 700 }}>3 verified visits</span> = a real Amazon Pay, Zomato or Swiggy gift card.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 14, paddingLeft: 2 }}>
        {[
          { icon: <Shield size={11} />, label: 'Secure, spam-free' },
          { icon: <MapPin size={11} />, label: 'Live in Baner' },
        ].map((t) => (
          <span key={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
            {t.icon} {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'What exactly is Dinezy?',
    a: 'A QR digital menu and rewards platform for independent restaurants. Scan the code at your table, order or browse the menu, and earn points every time your visit is verified — no app download needed.',
  },
  {
    q: 'Is it free to join?',
    a: "Yes. There's no fee, no subscription, and no card required — just your mobile number to keep your points safe.",
  },
  {
    q: 'How do I actually earn points?',
    a: 'You get 50 points the moment you sign up. After that, every time you finish a meal, show your waiter the PIN in your account — that verifies the visit and adds 50 more points.',
  },
  {
    q: 'What can I redeem points for?',
    a: 'Once you cross 150 points (3 verified visits), redeem for an Amazon Pay, Zomato or Swiggy gift card. No hidden catches or expiry games.',
  },
  {
    q: 'Which restaurants can I use this at?',
    a: 'Dinezy is currently live with select restaurants in Baner, Pune, with more added regularly as we expand.',
  },
  {
    q: 'Will I get spammed?',
    a: 'No. Your number is only used to verify OTPs and send updates about your points and rewards — never shared or sold.',
  },
]

function FAQAccordion({ onOpen }: { onOpen: (question: string) => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div key={item.q} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => {
                const next = isOpen ? null : i
                setOpenIdx(next)
                haptic(8)
                if (next !== null) onOpen(item.q)
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>
                {item.q}
              </span>
              <ChevronRight
                size={15}
                color="rgba(250,250,247,0.35)"
                style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
              />
            </button>
            {isOpen && (
              <p style={{
                margin: 0, padding: '0 16px 16px', fontSize: 12.5, color: 'rgba(250,250,247,0.5)',
                fontFamily: 'var(--font-body)', lineHeight: 1.6,
              }}>
                {item.a}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// FAQ is reachable from every screen via a floating "?" button + bottom
// sheet, instead of being buried at the end of a page nobody scrolls back to.
function FAQDrawer({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (q: string) => void }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '78vh', overflowY: 'auto',
          background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none',
          borderRadius: '22px 22px 0 0', padding: '14px 20px 32px',
          animation: 'drawerUp 0.32s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)',
          }}>
            Frequently asked
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(250,250,247,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
        <FAQAccordion onOpen={onOpen} />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const [screen, setScreen] = useState<Screen>('q1')
  const [answers, setAnswers] = useState<Answers>({ freq: null, frustration: null, hypothetical: null, redemption: null })
  const [quizPoints, setQuizPoints] = useState(0)
  const [pointsBump, setPointsBump] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [finalPoints, setFinalPoints] = useState(0)
  const [displayedPoints, setDisplayedPoints] = useState(0)
  const [showAwardToast, setShowAwardToast] = useState(false)
  const [adSource, setAdSource] = useState<Record<string, string>>({})

  const confirmRef = useRef<ConfirmationResult | null>(null)
  const sessionRef = useRef<{ uid: string; phone: string; customerId: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sessionIdRef = useRef<string>(crypto.randomUUID())

  // Track every screen the user reaches — this is what gives you the funnel/drop-off
  useEffect(() => {
    track({
      session_id: sessionIdRef.current,
      customer_id: sessionRef.current?.customerId ?? null,
      event_type: 'screen_view',
      screen,
      ad_source: adSource,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  // Capture ad attribution once on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tracked: Record<string, string> = {}
    ;['utm_source', 'utm_medium', 'utm_campaign', 'fbclid'].forEach((k) => {
      const v = params.get(k)
      if (v) tracked[k] = v
    })
    setAdSource(tracked)
    void prepareRecaptcha('recaptcha-container')
    return () => clearRecaptcha('recaptcha-container')
  }, [])

  useEffect(() => {
    if (error) setLoading(false)
  }, [error])

  // Animate the points counting up from 0 to the real awarded total, and
  // show a toast — same visual language as the in-app QuestCard, so this
  // reads as "your real account" rather than a marketing promise.
  useEffect(() => {
    if (screen !== 'done' || finalPoints === 0) return
    setDisplayedPoints(0)
    setShowAwardToast(false)
    haptic([10, 40, 10])
    const toastTimer = window.setTimeout(() => setShowAwardToast(true), 350)
    const start = performance.now()
    const duration = 900
    let raf: number
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayedPoints(Math.round(eased * finalPoints))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { window.clearTimeout(toastTimer); cancelAnimationFrame(raf) }
  }, [screen, finalPoints])

  const startResendTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setResendTimer(30)
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, [])

  const selectAnswer = (key: keyof Answers, value: string, next: Screen) => {
    setAnswers((a) => ({ ...a, [key]: value }))
    setQuizPoints((p) => p + 10)
    setPointsBump(true)
    haptic(12)
    window.setTimeout(() => setPointsBump(false), 480)
    track({
      session_id: sessionIdRef.current,
      event_type: 'answer_select',
      question_key: key,
      answer: value,
    })
    setTimeout(() => setScreen(next), 220)
  }

  const handleSendOTP = useCallback(async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      haptic([20, 20, 20])
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await sendOTP(cleaned, 'recaptcha-container')
      confirmRef.current = result
      setScreen('otp')
      startResendTimer()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send OTP. Try again.')
      haptic([20, 20, 20])
    } finally {
      setLoading(false)
    }
  }, [phone, startResendTimer])

  const handleVerifyOTP = useCallback(async () => {
    const code = otp.replace(/\D/g, '')
    if (code.length < 6) {
      setError('Enter the 6-digit OTP')
      return
    }
    if (!confirmRef.current) {
      setError('Session expired. Resend OTP.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { uid, phone: fbPhone } = await verifyOTP(confirmRef.current, code)
      const finalPhone = fbPhone ?? `+91${phone}`

      // Upsert the customer profile (same endpoint the in-app login uses)
      const custRes = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebase_uid: uid, phone: finalPhone, display_name: null }),
      })
      const custData = await custRes.json()
      if (!custRes.ok) throw new Error(custData.error)

      sessionRef.current = { uid, phone: finalPhone, customerId: custData.customer.id }

      if (custData.customer.display_name) {
        await finishJoin(custData.customer.id)
      } else {
        setScreen('name')
      }
    } catch {
      setError('Incorrect OTP. Please try again.')
      setOtp('')
      haptic([20, 20, 20])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, phone])

  const finishJoin = useCallback(async (customerId: string) => {
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          phone: sessionRef.current?.phone,
          survey_answers: answers,
          ad_source: adSource,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFinalPoints(data.total_points ?? 50)
      setScreen('done')
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong saving your signup')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, adSource])

  const handleSaveName = useCallback(async () => {
    const session = sessionRef.current
    if (!session) {
      setError('Session expired. Please verify OTP again.')
      setScreen('phone')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: session.uid,
          phone: session.phone,
          display_name: name.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await finishJoin(data.customer.id)
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [name, finishJoin])

  const handleFaqOpen = useCallback((question: string) => {
    track({ session_id: sessionIdRef.current, event_type: 'faq_open', faq_question: question })
  }, [])

  // ─── UI ───────────────────────────────────────────────────────────────────

  const est = estimateMonthly(answers.freq)

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0E', position: 'relative', overflow: 'hidden' }}>
      <div id="recaptcha-container" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />

      {/* Ambient glow — the only place we let motion run continuously */}
      <div className="ambient-glow-top" style={{
        position: 'absolute', top: -120, left: '50%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(232,197,71,0.14) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className="ambient-glow-bottom" style={{
        position: 'absolute', bottom: -160, right: -80,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,92,53,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <ProgressBar screen={screen} quizPoints={quizPoints} pointsBump={pointsBump} onFaqOpen={() => setFaqOpen(true)} />

      <div style={{
        position: 'relative', maxWidth: 480, margin: '0 auto',
        padding: '24px 24px 48px',
        minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>

        {QUIZ_ORDER.includes(screen) && <RewardBanner />}

        <div key={screen} className="screen-transition">

          {(['q1', 'q2', 'q3', 'q4'] as const).includes(screen as any) && (() => {
            const q = QUESTIONS[screen as 'q1' | 'q2' | 'q3' | 'q4']
            const key = (
              screen === 'q1' ? 'freq' : screen === 'q2' ? 'frustration' : screen === 'q3' ? 'hypothetical' : 'redemption'
            ) as keyof Answers
            const nextScreen: Screen = (
              screen === 'q1' ? 'q2' : screen === 'q2' ? 'q3' : screen === 'q3' ? 'q4' : 'reveal'
            )
            return (
              <div>
                {/* First-question-only intro — this replaces the old hero screen.
                    No separate CTA: the first tap on an option below *is* the CTA. */}
                {screen === 'q1' && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
                      background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.22)',
                      borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 700,
                      color: '#E8C547', fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
                    }}>
                      <MapPin size={12} /> EARLY ACCESS · BANER, PUNE
                    </div>
                    <p style={{ margin: 0, fontSize: 15, color: 'rgba(250,250,247,0.55)', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
                      What if eating out <span style={{ color: '#E8C547', fontWeight: 700 }}>paid you back?</span> Answer 4 quick questions and see your number.
                    </p>
                  </div>
                )}
                {q.eyebrow && (
                  <p style={{ margin: '0 0 6px', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,92,53,0.85)', fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}>
                    {q.eyebrow}
                  </p>
                )}
                <h2 style={{
                  margin: '0 0 24px', fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 600,
                  color: '#FAFAF7', lineHeight: 1.35,
                }}>
                  {q.title}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map((opt, i) => (
                    <div key={opt} className="option-stagger" style={{ animationDelay: `${i * 60}ms` }}>
                      <OptionButton label={opt} onSelect={() => selectAnswer(key, opt, nextScreen)} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {screen === 'reveal' && (
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 16, marginBottom: 16,
                background: 'rgba(232,197,71,0.12)', border: '1px solid rgba(232,197,71,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PartyPopper size={20} color="#E8C547" />
              </div>
              <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: '#FAFAF7' }}>
                Good news — this already exists.
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(250,250,247,0.5)', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
                Dinezy turns your regular visits into real, redeemable rewards. Here&apos;s exactly how it works:
              </p>

              {/* Personalised curiosity hook — built from their own Q1 answer and the
                  real quest math (50 pts/visit, 150 pts = 1 card), not a marketing number. */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(232,197,71,0.14), rgba(255,92,53,0.08))',
                border: '1px solid rgba(232,197,71,0.28)', borderRadius: 18, padding: '16px 18px', marginBottom: 20,
              }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(250,250,247,0.45)', fontFamily: 'var(--font-body)' }}>
                  Based on how you eat out
                </p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#FAFAF7', lineHeight: 1.45, fontFamily: 'var(--font-body)' }}>
                  That's about <span style={{ color: '#E8C547' }}>{est.points} points a month</span> — roughly{' '}
                  <span style={{ color: '#E8C547' }}>{est.cards} gift card{est.cards > 1 ? 's' : ''}</span>, just for eating where you already eat.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {[
                  { icon: <Gift size={16} color="#E8C547" />, title: '50 points just for joining', desc: 'Credited the moment you verify your number.' },
                  { icon: <Utensils size={16} color="#FF5C35" />, title: '50 points per verified visit', desc: 'Show your PIN to the waiter after your meal — 3 visits = 150 points.' },
                  { icon: <Wallet size={16} color="#E8C547" />, title: 'Redeem for real money', desc: 'Amazon Pay, Zomato or Swiggy gift cards. No catch, no expiry games.' },
                ].map((item) => (
                  <div key={item.title} style={{
                    display: 'flex', gap: 12, padding: '14px 16px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
                  }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>{item.title}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(250,250,247,0.45)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <PrimaryButton onClick={() => setScreen('phone')}>
                Claim my 50 points <ArrowRight size={16} />
              </PrimaryButton>
            </div>
          )}

          {screen === 'phone' && (
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 16, marginBottom: 16,
                background: 'rgba(232,197,71,0.12)', border: '1px solid rgba(232,197,71,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Phone size={20} color="#E8C547" />
              </div>
              <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#FAFAF7' }}>
                Enter your mobile
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(250,250,247,0.45)', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
                We&apos;ll text a one-time code — your 50 points land right after.
              </p>

              <div style={{
                display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 14, overflow: 'hidden', marginBottom: error ? 8 : 12,
              }}>
                <div style={{
                  padding: '0 14px', fontSize: 14, fontWeight: 600, color: 'rgba(250,250,247,0.4)',
                  borderRight: '1px solid rgba(255,255,255,0.08)', height: 52, display: 'flex', alignItems: 'center', flexShrink: 0,
                }}>
                  🇮🇳 +91
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                  autoFocus
                  style={{
                    flex: 1, height: 52, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 16, fontWeight: 500, letterSpacing: '0.04em', color: '#FAFAF7',
                    fontFamily: 'var(--font-body)', padding: '0 16px', touchAction: 'manipulation',
                  } as React.CSSProperties}
                />
              </div>

              <p style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
                <Shield size={12} /> Used only to verify your visits — never shared or sold.
              </p>

              {error && <p style={{ margin: '-8px 0 16px', fontSize: 12, color: '#f87171', fontFamily: 'var(--font-body)' }}>{error}</p>}

              <PrimaryButton onClick={handleSendOTP} disabled={phone.length < 10} loading={loading}>
                {loading ? (<><Loader2 size={16} className="spin" /> Sending…</>) : (<>Get OTP <ChevronRight size={16} /></>)}
              </PrimaryButton>
            </div>
          )}

          {screen === 'otp' && (
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 16, marginBottom: 16,
                background: 'rgba(255,92,53,0.1)', border: '1px solid rgba(255,92,53,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Shield size={20} color="#FF5C35" />
              </div>
              <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#FAFAF7' }}>
                Verify OTP
              </h2>
              <p style={{ margin: '0 0 28px', fontSize: 13, color: 'rgba(250,250,247,0.45)', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
                Sent to +91 {phone.replace(/(\d{5})(\d{5})/, '$1 $2')}
                <button
                  type="button"
                  onClick={() => {
                    clearRecaptcha('recaptcha-container')
                    void prepareRecaptcha('recaptcha-container')
                    setScreen('phone')
                    setOtp('')
                    setError('')
                  }}
                  style={{ marginLeft: 8, background: 'none', border: 'none', color: '#E8C547', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                >
                  Edit
                </button>
              </p>

              <SingleOTPInput value={otp} onChange={setOtp} disabled={loading} onSubmit={handleVerifyOTP} />

              {error && <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 12, color: '#f87171', fontFamily: 'var(--font-body)' }}>{error}</p>}

              <div style={{ marginTop: 24 }}>
                <PrimaryButton onClick={handleVerifyOTP} disabled={otp.replace(/\D/g, '').length < 6} loading={loading}>
                  {loading ? (<><Loader2 size={16} className="spin" /> Verifying…</>) : 'Verify & claim points'}
                </PrimaryButton>
              </div>

              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)' }}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : (
                  <button
                    type="button"
                    onClick={async () => { setOtp(''); await handleSendOTP() }}
                    style={{ background: 'none', border: 'none', color: '#E8C547', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {screen === 'name' && (
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 16, marginBottom: 16, fontSize: 22,
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                🎉
              </div>
              <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#FAFAF7' }}>
                What should we call you?
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(250,250,247,0.45)', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
                Optional — helps us personalise your rewards.
              </p>

              <input
                type="text"
                placeholder="Your first name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                style={{
                  width: '100%', height: 52, background: 'rgba(255,255,255,0.05)',
                  border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 14, outline: 'none',
                  fontSize: 15, color: '#FAFAF7', fontFamily: 'var(--font-body)', padding: '0 16px',
                  boxSizing: 'border-box', marginBottom: 20, touchAction: 'manipulation',
                } as React.CSSProperties}
              />

              {error && <p style={{ margin: '0 0 16px', fontSize: 12, color: '#f87171', fontFamily: 'var(--font-body)' }}>{error}</p>}

              <PrimaryButton onClick={handleSaveName} loading={loading}>
                {loading ? (<><Loader2 size={16} className="spin" /> Setting up…</>) : (<><Gift size={16} /> Claim my rewards</>)}
              </PrimaryButton>
            </div>
          )}

          {screen === 'done' && (() => {
            const progressPct = Math.min((finalPoints / TARGET_POINTS) * 100, 100)
            return (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🎊</div>
                  <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#FAFAF7' }}>
                    {name ? `Welcome, ${name}!` : "You're in!"}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(250,250,247,0.45)', fontFamily: 'var(--font-body)' }}>
                    This is your Dinezy account — for real.
                  </p>
                </div>

                {/* Award toast — identical animation language to the in-app QuestCard */}
                {showAwardToast && (
                  <div
                    className="award-toast"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'linear-gradient(135deg, rgba(232,197,71,0.16) 0%, rgba(255,92,53,0.1) 100%)',
                      border: '1px solid rgba(232,197,71,0.3)', borderRadius: 14, padding: '12px 14px', marginBottom: 12,
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, flexShrink: 0, borderRadius: 10,
                      background: 'rgba(232,197,71,0.18)', border: '1px solid rgba(232,197,71,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Gift size={15} color="#E8C547" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>
                        Signup bonus credited — +{finalPoints} points
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(250,250,247,0.45)', fontFamily: 'var(--font-body)' }}>
                        Already in your balance below.
                      </p>
                    </div>
                  </div>
                )}

                {/* Points header — same card as the real account drawer */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(232,197,71,0.08) 0%, rgba(255,92,53,0.05) 100%)',
                  border: '1px solid rgba(232,197,71,0.18)', borderRadius: 20, padding: '20px 20px 18px', marginBottom: 12,
                }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
                    Reward Points
                  </p>
                  <p style={{ margin: '4px 0 14px', fontSize: 36, fontWeight: 700, color: '#FAFAF7', fontFamily: 'var(--font-body)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {displayedPoints.toLocaleString('en-IN')}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Utensils size={13} color="#E8C547" />
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#FAFAF7', fontFamily: 'var(--font-body)' }}>
                      Quest: First Feast — {TARGET_VISITS} verified visits
                    </p>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{
                      height: '100%', width: `${progressPct}%`,
                      background: 'linear-gradient(90deg, #E8C547, #FF5C35)', borderRadius: 999, transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
                    {finalPoints}/{TARGET_POINTS} points · 0/{TARGET_VISITS} visits
                  </p>
                </div>

                {/* What happens next — a real sequence, so numbering earns its place */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '14px 16px', marginBottom: 20,
                }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(250,250,247,0.4)', fontFamily: 'var(--font-body)' }}>
                    How to grow this
                  </p>
                  {[
                    'Walk into any Dinezy restaurant in Baner',
                    'After your meal, ask your waiter to verify your visit PIN',
                    `+${POINTS_PER_VISIT} points land instantly — redeem at ${TARGET_POINTS} for Amazon Pay, Zomato or Swiggy`,
                  ].map((step, i) => (
                    <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 2 ? 8 : 0 }}>
                      <span style={{
                        flexShrink: 0, width: 18, height: 18, borderRadius: '50%', marginTop: 1,
                        background: 'rgba(232,197,71,0.14)', border: '1px solid rgba(232,197,71,0.28)',
                        color: '#E8C547', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-body)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {i + 1}
                      </span>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(250,250,247,0.55)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                        {step}
                      </p>
                    </div>
                  ))}
                </div>

                <a
                  href="https://dinezy.in"
                  style={{
                    width: '100%', height: 52, boxSizing: 'border-box',
                    background: 'linear-gradient(135deg, #E8C547 0%, #d4a93c 100%)', borderRadius: 14,
                    color: '#111', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-body)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32,
                  }}
                >
                  Explore Dinezy <ArrowRight size={15} />
                </a>

                {/* Full FAQ, visible inline now that there's room to breathe */}
                <p style={{
                  margin: '0 0 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'rgba(250,250,247,0.35)', fontFamily: 'var(--font-body)',
                }}>
                  Frequently asked
                </p>
                <FAQAccordion onOpen={handleFaqOpen} />
              </div>
            )
          })()}

        </div>
      </div>

      {/* Floating FAQ affordance — visible on every screen except the final one,
          where the full list is already inline. */}
      {screen !== 'done' && (
        <button
          type="button"
          onClick={() => { setFaqOpen(true); haptic(10) }}
          aria-label="Frequently asked questions"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 40,
            width: 46, height: 46, borderRadius: '50%',
            background: 'rgba(232,197,71,0.14)', border: '1px solid rgba(232,197,71,0.32)',
            color: '#E8C547', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)', cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}
        >
          <HelpCircle size={19} />
        </button>
      )}

      <FAQDrawer open={faqOpen} onClose={() => setFaqOpen(false)} onOpen={handleFaqOpen} />

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @keyframes drawerUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @keyframes screenIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .screen-transition { animation: screenIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) both; }

        @keyframes optionIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .option-stagger { animation: optionIn 0.32s ease both; }

        @keyframes pointsBumpKf {
          0% { transform: scale(1); }
          40% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        .points-bump { animation: pointsBumpKf 0.48s cubic-bezier(0.34,1.56,0.64,1); }

        @keyframes toastIn {
          0%   { transform: translateY(-16px) scale(0.92); opacity: 0; }
          60%  { transform: translateY(2px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes toastPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,197,71,0.35); }
          50%      { box-shadow: 0 0 0 8px rgba(232,197,71,0); }
        }
        .award-toast { animation: toastIn 0.4s cubic-bezier(0.34,1.12,0.64,1) both, toastPulse 1.6s ease-out 0.4s; }

        @keyframes breatheTop {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.75; }
          50%      { transform: translateX(-50%) scale(1.06); opacity: 1; }
        }
        .ambient-glow-top { animation: breatheTop 7s ease-in-out infinite; }
        @keyframes breatheBottom {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%      { transform: scale(1.08); opacity: 0.95; }
        }
        .ambient-glow-bottom { animation: breatheBottom 9s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .screen-transition, .option-stagger, .points-bump, .award-toast,
          .ambient-glow-top, .ambient-glow-bottom, .spin {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}