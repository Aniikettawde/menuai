'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import { type ConfirmationResult } from 'firebase/auth'
import { sendOTP, verifyOTP, clearRecaptcha, prepareRecaptcha } from '@/lib/firebase'
import {
  Sparkles, Utensils, MapPin, Gift, ChevronRight,
  Loader2, Phone, Shield, ArrowRight, HelpCircle, X,
  Stamp, Check, Receipt,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'q1' | 'phone' | 'otp' | 'name' | 'done'

interface Answers {
  interested: string | null
}

const QUESTIONS: Record<'q1', { title: string; eyebrow?: string; options: string[] }> = {
  q1: {
    title: 'What is s more exciting to you?',
    options: [
      '💸 Cashback',
      '🎁 Gift Cards',
      "🍽 Restaurant Offers",
    ],
  },
}

const QUIZ_ORDER: Screen[] = ['q1']

const POINTS_PER_VISIT = 50
const TARGET_VISITS = 3
const TARGET_POINTS = POINTS_PER_VISIT * TARGET_VISITS

// ─── Theme tokens ─────────────────────────────────────────────────────────────
// A single source of truth so every child can reference var(--token)

const THEME_VARS = {
  '--ink': '#170F09',
  '--ink-2': '#241609',
  '--paper': '#FBEEDA',
  '--paper-2': '#F1DFB9',
  '--ink-text': '#2C1810',
  '--ink-text-soft': 'rgba(44,24,16,0.58)',
  '--saffron': '#E9A23D',
  '--saffron-deep': '#C97F22',
  '--chili': '#C1442E',
  '--chili-deep': '#98311F',
  '--cardamom': '#5B8C5A',
  '--font-display': "'Fraunces', Georgia, serif",
  '--font-ui': "'Manrope', system-ui, sans-serif",
} as React.CSSProperties

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

// ─── Ticket card — the page's signature surface ───────────────────────────────
// A warm paper coupon floating on the dark stage, with punched notches on the
// sides and a dashed tear-line under an optional stub header. Every screen's
// content lives inside one of these instead of a generic glass panel.

function TicketCard({
  children, stubLabel, stubValue, stubIcon,
}: {
  children: React.ReactNode
  stubLabel?: string
  stubValue?: string
  stubIcon?: React.ReactNode
}) {
  return (
    <div className="ticket-card">
      <span className="ticket-notch ticket-notch-left" />
      <span className="ticket-notch ticket-notch-right" />
      {stubLabel && (
        <>
          <div className="ticket-stub">
            <span className="ticket-stub-icon">{stubIcon}</span>
            <div>
              <p className="ticket-stub-label">{stubLabel}</p>
              <p className="ticket-stub-value">{stubValue}</p>
            </div>
          </div>
          <div className="ticket-tear" />
        </>
      )}
      <div className="ticket-body">{children}</div>
    </div>
  )
}

// ─── Top bar — wordmark + points chip + FAQ, replaces the old progress bar ───

function TopBar({ points, showPoints, onFaqOpen }: { points: number; showPoints: boolean; onFaqOpen: () => void }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <span className="wordmark">Dinezy</span>
        <div className="topbar-actions">
          {showPoints && (
            <span className={points > 0 ? 'points-chip points-bump' : 'points-chip'}>
              <Sparkles size={11} /> {points} pts
            </span>
          )}
          <button type="button" onClick={onFaqOpen} aria-label="Frequently asked questions" className="faq-mini-btn">
            <HelpCircle size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reusable pressable primitives ───────────────────────────────────────────

function PrimaryButton({
  onClick, disabled, loading, children,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
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
      className={`primary-btn ${pressed ? 'primary-btn-pressed' : ''} ${isDisabled ? 'primary-btn-disabled' : ''}`}
    >
      {children}
    </button>
  )
}

function OptionButton({ label, onSelect, selected }: { label: string; onSelect: () => void; selected: boolean }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={onSelect}
      className={`option-row ${pressed ? 'option-row-pressed' : ''} ${selected ? 'option-row-selected' : ''}`}
    >
      <span className={`option-bullet ${selected ? 'option-bullet-filled' : ''}`}>
        {selected && <Check size={12} color="#FBEEDA" strokeWidth={3} />}
      </span>
      <span className="option-label">{label}</span>
      <ChevronRight size={15} className="option-chevron" />
    </button>
  )
}

// ─── Single OTP input ─────────────────────────────────────────────────────────

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
      className="otp-input"
    />
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
    <div className="faq-list">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div key={item.q} className="faq-item">
            <button
              type="button"
              onClick={() => {
                const next = isOpen ? null : i
                setOpenIdx(next)
                haptic(8)
                if (next !== null) onOpen(item.q)
              }}
              className="faq-question"
            >
              <span>{item.q}</span>
              <ChevronRight size={15} className={`faq-chevron ${isOpen ? 'faq-chevron-open' : ''}`} />
            </button>
            {isOpen && <p className="faq-answer">{item.a}</p>}
          </div>
        )
      })}
    </div>
  )
}

function FAQDrawer({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (q: string) => void }) {
  if (!open) return null
  return (
    <div onClick={onClose} className="faq-overlay">
      <div onClick={(e) => e.stopPropagation()} className="faq-drawer">
        <div className="faq-drawer-handle" />
        <div className="faq-drawer-header">
          <p className="faq-drawer-title"><Receipt size={13} /> Frequently asked</p>
          <button type="button" onClick={onClose} aria-label="Close" className="faq-close-btn">
            <X size={13} />
          </button>
        </div>
        <FAQAccordion onOpen={onOpen} />
      </div>
    </div>
  )
}

// ─── Stamp badge — the finale's signature moment ─────────────────────────────

function StampSlot({ filled, label }: { filled: boolean; label: string }) {
  return (
    <div className={`stamp-slot ${filled ? 'stamp-slot-filled' : ''}`}>
      {filled ? <Stamp size={20} color="#FBEEDA" /> : <span className="stamp-slot-plus">+50</span>}
      <span className="stamp-slot-label">{label}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const [screen, setScreen] = useState<Screen>('q1')
  const [answers, setAnswers] = useState<Answers>({ interested: null })
  const [justSelected, setJustSelected] = useState<string | null>(null)
  const [quizPoints, setQuizPoints] = useState(0)
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
    setJustSelected(value)
    setQuizPoints((p) => p + 10)
    haptic(12)
    track({
      session_id: sessionIdRef.current,
      event_type: 'answer_select',
      question_key: key,
      answer: value,
    })
    setTimeout(() => setScreen(next), 260)
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

  return (
    <div className="page-stage" style={THEME_VARS}>
      <div id="recaptcha-container" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />

      {/* Rising steam — the only continuous motion, evokes a hot plate on a counter */}
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`steam steam-${i}`} />
      ))}

      <TopBar
        points={quizPoints}
        showPoints={QUIZ_ORDER.includes(screen)}
        onFaqOpen={() => setFaqOpen(true)}
      />

      <div className="page-content">
        <div key={screen} className="ticket-enter">

          {screen === 'q1' && (() => {
            const q = QUESTIONS.q1
            const key: keyof Answers = 'interested'
            const nextScreen: Screen = 'phone'
            return (
              <TicketCard
                stubLabel="TODAY'S OFFER"
                stubValue="₹50 FREE"
                stubIcon={<Gift size={15} color="var(--chili)" />}
              >
                <span className="eyebrow-tag">
                  <MapPin size={11} /> EARLY ACCESS · PUNE
                </span>
                <h2 className="ticket-title">{q.title}</h2>
                <p className="ticket-subtitle">
                  Join free today and get ₹50 instantly, Earn another ₹50 every restaurant visit.
                </p>
                <div className="option-list">
                  {q.options.map((opt, i) => (
                    <div key={opt} className="option-stagger" style={{ animationDelay: `${i * 70}ms` }}>
                      <OptionButton
                        label={opt}
                        selected={justSelected === opt}
                        onSelect={() => selectAnswer(key, opt, nextScreen)}
                      />
                    </div>
                  ))}
                </div>
                <div className="trust-strip">
                  <span><Shield size={11} /> Secure, spam-free</span>
                  <span><MapPin size={11} /> Live in Baner</span>
                </div>
              </TicketCard>
            )
          })()}

          {screen === 'phone' && (
            <TicketCard stubLabel="STEP" stubValue="CLAIM YOUR POINTS" stubIcon={<Phone size={15} color="var(--saffron-deep)" />}>
              <div className="icon-badge icon-badge-saffron"><Phone size={20} color="var(--saffron-deep)" /></div>
              <h2 className="ticket-title ticket-title-sm">Get 50 points now</h2>
              <p className="ticket-subtitle">
                Join Dinezy — enter your mobile, we&apos;ll text a one-time code, and 50 points (₹50 cashback) land right after.
              </p>

              <div className={`phone-field ${error ? 'phone-field-error' : ''}`}>
                <div className="phone-prefix">🇮🇳 +91</div>
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
                  className="phone-input"
                />
              </div>

              <p className="fine-print"><Shield size={12} /> Used only to verify your visits — never shared or sold.</p>

              {error && <p className="error-text">{error}</p>}

              <PrimaryButton onClick={handleSendOTP} disabled={phone.length < 10} loading={loading}>
                {loading ? (<><Loader2 size={16} className="spin" /> Sending…</>) : (<>Get 50 points & join Dinezy <ChevronRight size={16} /></>)}
              </PrimaryButton>
            </TicketCard>
          )}

          {screen === 'otp' && (
            <TicketCard stubLabel="STEP" stubValue="VERIFY YOUR NUMBER" stubIcon={<Shield size={15} color="var(--chili)" />}>
              <div className="icon-badge icon-badge-chili"><Shield size={20} color="var(--chili)" /></div>
              <h2 className="ticket-title ticket-title-sm">Verify OTP</h2>
              <p className="ticket-subtitle">
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
                  className="inline-link"
                >
                  Edit
                </button>
              </p>

              <SingleOTPInput value={otp} onChange={setOtp} disabled={loading} onSubmit={handleVerifyOTP} />

              {error && <p className="error-text error-text-center">{error}</p>}

              <div className="mt-24">
                <PrimaryButton onClick={handleVerifyOTP} disabled={otp.replace(/\D/g, '').length < 6} loading={loading}>
                  {loading ? (<><Loader2 size={16} className="spin" /> Verifying…</>) : 'Verify & claim points'}
                </PrimaryButton>
              </div>

              <div className="resend-row">
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : (
                  <button type="button" onClick={async () => { setOtp(''); await handleSendOTP() }} className="inline-link">
                    Resend OTP
                  </button>
                )}
              </div>
            </TicketCard>
          )}

          {screen === 'name' && (
            <TicketCard stubLabel="STEP" stubValue="ALMOST DONE" stubIcon={<Gift size={15} color="var(--cardamom)" />}>
              <div className="icon-badge icon-badge-cardamom" style={{ fontSize: 22 }}>🎉</div>
              <h2 className="ticket-title ticket-title-sm">What should we call you?</h2>
              <p className="ticket-subtitle">Optional — helps us personalise your rewards.</p>

              <input
                type="text"
                placeholder="Your first name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                className="name-input"
              />

              {error && <p className="error-text">{error}</p>}

              <PrimaryButton onClick={handleSaveName} loading={loading}>
                {loading ? (<><Loader2 size={16} className="spin" /> Setting up…</>) : (<><Gift size={16} /> Claim my rewards</>)}
              </PrimaryButton>
            </TicketCard>
          )}

          {screen === 'done' && (() => {
            const progressPct = Math.min((finalPoints / TARGET_POINTS) * 100, 100)
            return (
              <TicketCard stubLabel="RECEIPT" stubValue={`#${sessionIdRef.current.slice(0, 8).toUpperCase()}`} stubIcon={<Receipt size={15} color="var(--saffron-deep)" />}>
                <div className="done-header">
                  <h2 className="ticket-title ticket-title-sm">{name ? `Welcome, ${name}!` : "You're in!"}</h2>
                  <p className="ticket-subtitle" style={{ marginBottom: 0 }}>This is your Dinezy account — for real.</p>
                </div>

                {showAwardToast && (
                  <div className="award-toast">
                    <div className="award-toast-icon"><Gift size={15} color="var(--chili)" /></div>
                    <div>
                      <p className="award-toast-title">Signup bonus credited — +{finalPoints} points</p>
                      <p className="award-toast-sub">Already in your balance below.</p>
                    </div>
                  </div>
                )}

                <div className="points-panel">
                  <p className="points-panel-label">Reward Points</p>
                  <p className="points-panel-value">{displayedPoints.toLocaleString('en-IN')}</p>

                  <div className="stamp-row">
                    {Array.from({ length: TARGET_VISITS }).map((_, i) => (
                      <StampSlot key={i} filled={i === 0} label={i === 0 ? 'Signup' : `Visit ${i + 1}`} />
                    ))}
                  </div>

                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="progress-caption">
                    {finalPoints}/{TARGET_POINTS} points · 0/{TARGET_VISITS} visits
                  </p>
                </div>

                <div className="steps-panel">
                  <p className="steps-panel-title">How to grow this</p>
                  {[
                    'Walk into any Dinezy restaurant in Baner',
                    'After your meal, ask your waiter to verify your visit PIN',
                    `+${POINTS_PER_VISIT} points land instantly — redeem at ${TARGET_POINTS} for Amazon Pay, Zomato or Swiggy`,
                  ].map((step, i) => (
                    <div key={step} className="step-row">
                      <span className="step-number">{i + 1}</span>
                      <p className="step-text">{step}</p>
                    </div>
                  ))}
                </div>

                <a href="https://dinezy.in" className="explore-btn">
                  Explore Dinezy <ArrowRight size={15} />
                </a>

                <p className="faq-inline-title"><Receipt size={12} /> Frequently asked</p>
                <FAQAccordion onOpen={handleFaqOpen} />
              </TicketCard>
            )
          })()}

        </div>
      </div>

      {screen !== 'done' && (
        <button type="button" onClick={() => { setFaqOpen(true); haptic(10) }} aria-label="Frequently asked questions" className="faq-float-btn">
          <HelpCircle size={19} />
        </button>
      )}

      <FAQDrawer open={faqOpen} onClose={() => setFaqOpen(false)} onOpen={handleFaqOpen} />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap');

        .page-stage {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% -10%, rgba(233,162,61,0.14) 0%, transparent 55%),
            linear-gradient(180deg, var(--ink) 0%, var(--ink-2) 100%);
          font-family: var(--font-ui);
        }

        /* ── Steam ── */
        .steam {
          position: absolute;
          bottom: -40px;
          width: 90px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(251,238,218,0.10) 0%, transparent 70%);
          filter: blur(6px);
          animation: rise 11s ease-in infinite;
          pointer-events: none;
        }
        .steam-0 { left: 8%;  animation-delay: 0s;   }
        .steam-1 { left: 32%; animation-delay: 3.2s; width: 70px; }
        .steam-2 { left: 62%; animation-delay: 6.1s; }
        .steam-3 { left: 84%; animation-delay: 1.6s; width: 60px; }
        @keyframes rise {
          0%   { transform: translateY(0) scale(0.9);   opacity: 0; }
          15%  { opacity: 0.9; }
          100% { transform: translateY(-620px) scale(1.3); opacity: 0; }
        }

        /* ── Top bar ── */
        .topbar {
          position: sticky; top: 0; z-index: 20;
          background: rgba(23,15,9,0.86);
          backdrop-filter: blur(10px);
          padding: 14px 20px;
          border-bottom: 1px solid rgba(233,162,61,0.14);
        }
        .topbar-inner {
          max-width: 480px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
        }
        .wordmark {
          font-family: var(--font-display);
          font-weight: 600; font-size: 18px; letter-spacing: 0.01em;
          color: var(--paper);
        }
        .topbar-actions { display: flex; align-items: center; gap: 8px; }
        .points-chip {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; color: var(--ink);
          background: var(--saffron); border-radius: 999px; padding: 4px 10px;
        }
        .points-bump { animation: bumpKf 0.48s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes bumpKf { 0% { transform: scale(1); } 40% { transform: scale(1.16); } 100% { transform: scale(1); } }
        .faq-mini-btn {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          background: rgba(251,238,218,0.08); border: 1px solid rgba(251,238,218,0.18);
          color: var(--paper); display: flex; align-items: center; justify-content: center;
          cursor: pointer; padding: 0;
        }

        /* ── Page content ── */
        .page-content {
          position: relative; max-width: 480px; margin: 0 auto;
          padding: 28px 20px 56px; min-height: calc(100vh - 60px);
          display: flex; flex-direction: column; justify-content: center;
        }

        /* ── Ticket card ── */
        .ticket-card {
          position: relative;
          background: linear-gradient(180deg, var(--paper) 0%, #F6E4C6 100%);
          border-radius: 20px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.45), 0 2px 0 rgba(0,0,0,0.06) inset;
        }
        .ticket-notch {
          position: absolute; top: 78px; width: 22px; height: 22px; border-radius: 50%;
          background: var(--ink); z-index: 2;
        }
        .ticket-notch-left { left: -11px; }
        .ticket-notch-right { right: -11px; }
        .ticket-stub {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 22px 14px;
        }
        .ticket-stub-icon {
          flex-shrink: 0; width: 30px; height: 30px; border-radius: 10px;
          background: rgba(44,24,16,0.06);
          display: flex; align-items: center; justify-content: center;
        }
        .ticket-stub-label {
          margin: 0; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          color: var(--ink-text-soft); text-transform: uppercase;
        }
        .ticket-stub-value {
          margin: 2px 0 0; font-size: 13px; font-weight: 700; color: var(--chili-deep);
          font-family: var(--font-display);
        }
        .ticket-tear {
          border-top: 2px dashed rgba(44,24,16,0.18);
          margin: 0 22px;
        }
        .ticket-body { padding: 22px; }

        /* ── Ticket entrance ── */
        .ticket-enter { animation: ticketIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes ticketIn {
          from { opacity: 0; transform: translateY(28px) rotate(-1.2deg) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }

        /* ── Typography ── */
        .eyebrow-tag {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--chili); color: var(--paper);
          border-radius: 999px; padding: 5px 12px; font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.05em; margin-bottom: 16px; transform: rotate(-2deg);
        }
        .ticket-title {
          margin: 0 0 12px; font-family: var(--font-display); font-weight: 600;
          font-size: 24px; line-height: 1.32; color: var(--ink-text);
        }
        .ticket-title-sm { font-size: 21px; }
        .ticket-subtitle {
          margin: 0 0 22px; font-size: 13.5px; line-height: 1.55; color: var(--ink-text-soft);
        }

        /* ── Options (receipt line-items) ── */
        .option-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 18px; }
        .option-stagger { animation: optionIn 0.34s ease both; }
        @keyframes optionIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .option-row {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 15px 6px; background: none; border: none; border-bottom: 1px dashed rgba(44,24,16,0.14);
          cursor: pointer; text-align: left; transition: background 0.15s ease, transform 0.12s ease;
        }
        .option-row:last-child { border-bottom: none; }
        .option-row-pressed { transform: scale(0.98); background: rgba(193,68,46,0.06); }
        .option-row-selected { background: rgba(193,68,46,0.1); }
        .option-bullet {
          flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
          border: 1.5px solid rgba(44,24,16,0.25);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .option-bullet-filled {
          background: var(--chili); border-color: var(--chili); transform: scale(1.1);
        }
        .option-label { flex: 1; font-size: 14.5px; font-weight: 600; color: var(--ink-text); }
        .option-chevron { color: rgba(44,24,16,0.3); flex-shrink: 0; }
        .trust-strip {
          display: flex; gap: 16px; padding-top: 4px;
        }
        .trust-strip span {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; color: var(--ink-text-soft);
        }

        /* ── Icon badges ── */
        .icon-badge {
          width: 48px; height: 48px; border-radius: 14px; margin-bottom: 16px;
          display: flex; align-items: center; justify-content: center;
        }
        .icon-badge-saffron { background: rgba(233,162,61,0.18); }
        .icon-badge-chili { background: rgba(193,68,46,0.14); }
        .icon-badge-cardamom { background: rgba(91,140,90,0.16); }

        /* ── Phone field ── */
        .phone-field {
          display: flex; align-items: center; background: var(--paper-2);
          border: 1.5px solid rgba(44,24,16,0.14); border-radius: 14px; overflow: hidden;
          margin-bottom: 12px; transition: border-color 0.15s ease;
        }
        .phone-field-error { border-color: var(--chili); margin-bottom: 8px; }
        .phone-prefix {
          padding: 0 14px; font-size: 14px; font-weight: 700; color: var(--ink-text-soft);
          border-right: 1px solid rgba(44,24,16,0.1); height: 52px;
          display: flex; align-items: center; flex-shrink: 0;
        }
        .phone-input {
          flex: 1; height: 52px; background: transparent; border: none; outline: none;
          font-size: 16px; font-weight: 600; letter-spacing: 0.04em; color: var(--ink-text);
          font-family: var(--font-ui); padding: 0 16px;
        }
        .phone-input::placeholder { color: rgba(44,24,16,0.3); }
        .fine-print {
          margin: 0 0 20px; display: flex; align-items: center; gap: 6px;
          font-size: 11.5px; color: var(--ink-text-soft);
        }

        /* ── Name input ── */
        .name-input {
          width: 100%; height: 52px; background: var(--paper-2);
          border: 1.5px solid rgba(44,24,16,0.14); border-radius: 14px; outline: none;
          font-size: 15px; color: var(--ink-text); font-family: var(--font-ui); padding: 0 16px;
          box-sizing: border-box; margin-bottom: 20px;
        }
        .name-input::placeholder { color: rgba(44,24,16,0.3); }

        /* ── OTP input ── */
        .otp-input {
          width: 100%; height: 60px; text-align: center; font-size: 26px; font-weight: 700;
          letter-spacing: 0.5em; text-indent: 0.5em; font-family: var(--font-ui);
          background: var(--paper-2); border: 1.5px solid rgba(44,24,16,0.14);
          border-radius: 16px; color: var(--ink-text); outline: none;
          box-sizing: border-box;
        }
        .otp-input:focus { border-color: var(--chili); }

        .error-text { margin: -4px 0 16px; font-size: 12px; color: var(--chili-deep); font-weight: 600; }
        .error-text-center { text-align: center; margin-top: 12px; margin-bottom: 0; }
        .inline-link { margin-left: 8px; background: none; border: none; color: var(--chili-deep); cursor: pointer; font-size: 12px; font-weight: 700; }
        .resend-row { margin-top: 16px; text-align: center; font-size: 12px; color: var(--ink-text-soft); }
        .mt-24 { margin-top: 24px; }

        /* ── Primary button ── */
        .primary-btn {
          width: 100%; height: 54px; background: linear-gradient(135deg, var(--saffron) 0%, var(--saffron-deep) 100%);
          border: none; border-radius: 14px; color: var(--ink);
          font-size: 15.5px; font-weight: 700; font-family: var(--font-ui);
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: transform 0.12s ease, background 0.2s ease;
        }
        .primary-btn-pressed { transform: scale(0.97); }
        .primary-btn-disabled { background: rgba(233,162,61,0.25); color: rgba(23,15,9,0.35); cursor: not-allowed; }

        /* ── Done screen ── */
        .done-header { text-align: center; margin-bottom: 18px; }
        .award-toast {
          display: flex; align-items: center; gap: 10px;
          background: rgba(193,68,46,0.08); border: 1px solid rgba(193,68,46,0.25);
          border-radius: 14px; padding: 12px 14px; margin-bottom: 14px;
          animation: toastIn 0.4s cubic-bezier(0.34,1.12,0.64,1) both;
        }
        @keyframes toastIn {
          0%   { transform: translateY(-16px) scale(0.92); opacity: 0; }
          60%  { transform: translateY(2px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .award-toast-icon {
          width: 32px; height: 32px; flex-shrink: 0; border-radius: 10px;
          background: rgba(193,68,46,0.16); display: flex; align-items: center; justify-content: center;
        }
        .award-toast-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--ink-text); }
        .award-toast-sub { margin: 2px 0 0; font-size: 11px; color: var(--ink-text-soft); }

        .points-panel {
          background: var(--paper-2); border: 1px solid rgba(44,24,16,0.1);
          border-radius: 18px; padding: 20px; margin-bottom: 14px;
        }
        .points-panel-label {
          margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.12em; color: var(--ink-text-soft);
        }
        .points-panel-value {
          margin: 4px 0 16px; font-size: 38px; font-weight: 700; color: var(--ink-text);
          font-family: var(--font-display); letter-spacing: -0.01em; line-height: 1;
        }

        .stamp-row { display: flex; gap: 10px; margin-bottom: 16px; }
        .stamp-slot {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 12px 6px; border-radius: 12px; border: 1.5px dashed rgba(44,24,16,0.2);
        }
        .stamp-slot-filled {
          border-style: solid; border-color: var(--chili); background: rgba(193,68,46,0.06);
          transform: rotate(-4deg);
          animation: stampIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.4s both;
        }
        .stamp-slot-filled svg { background: var(--chili); border-radius: 50%; padding: 6px; }
        @keyframes stampIn {
          0%   { transform: rotate(-4deg) scale(1.8); opacity: 0; }
          60%  { transform: rotate(-4deg) scale(0.94); opacity: 1; }
          100% { transform: rotate(-4deg) scale(1); opacity: 1; }
        }
        .stamp-slot-plus { font-size: 11px; font-weight: 700; color: rgba(44,24,16,0.32); }
        .stamp-slot-label { font-size: 9.5px; font-weight: 600; color: var(--ink-text-soft); text-transform: uppercase; letter-spacing: 0.04em; }

        .progress-track { height: 6px; background: rgba(44,24,16,0.1); border-radius: 999px; overflow: hidden; margin-bottom: 6px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--saffron), var(--chili)); border-radius: 999px; transition: width 0.8s ease; }
        .progress-caption { margin: 0; font-size: 11px; color: var(--ink-text-soft); }

        .steps-panel { background: rgba(44,24,16,0.04); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px; }
        .steps-panel-title { margin: 0 0 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-text-soft); }
        .step-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
        .step-row:last-child { margin-bottom: 0; }
        .step-number {
          flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; margin-top: 1px;
          background: var(--saffron); color: var(--ink); font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .step-text { margin: 0; font-size: 12.5px; color: var(--ink-text-soft); line-height: 1.5; }

        .explore-btn {
          width: 100%; height: 52px; box-sizing: border-box;
          background: linear-gradient(135deg, var(--saffron), var(--saffron-deep));
          border-radius: 14px; color: var(--ink); font-size: 15px; font-weight: 700;
          font-family: var(--font-ui); text-decoration: none;
          display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 28px;
        }
        .faq-inline-title {
          margin: 0 0 14px; display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-text-soft);
        }

        /* ── FAQ ── */
        .faq-list { display: flex; flex-direction: column; gap: 8px; }
        .faq-item { background: rgba(44,24,16,0.03); border: 1px solid rgba(44,24,16,0.08); border-radius: 14px; overflow: hidden; }
        .faq-question {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 14px 16px; background: none; border: none; cursor: pointer; text-align: left;
          font-size: 13.5px; font-weight: 600; color: var(--ink-text); font-family: var(--font-ui);
        }
        .faq-chevron { color: rgba(44,24,16,0.3); flex-shrink: 0; transition: transform 0.2s; }
        .faq-chevron-open { transform: rotate(90deg); }
        .faq-answer { margin: 0; padding: 0 16px 16px; font-size: 12.5px; color: var(--ink-text-soft); line-height: 1.6; }

        .faq-overlay {
          position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end;
          background: rgba(0,0,0,0.6); animation: fadeIn 0.2s ease both;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .faq-drawer {
          width: 100%; max-width: 480px; margin: 0 auto; max-height: 78vh; overflow-y: auto;
          background: var(--paper); border-radius: 22px 22px 0 0; padding: 14px 20px 32px;
          animation: drawerUp 0.32s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes drawerUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .faq-drawer-handle { width: 36px; height: 4px; border-radius: 999px; background: rgba(44,24,16,0.2); margin: 0 auto 16px; }
        .faq-drawer-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .faq-drawer-title {
          margin: 0; display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-text-soft);
        }
        .faq-close-btn {
          width: 26px; height: 26px; border-radius: 50%; background: rgba(44,24,16,0.06);
          border: 1px solid rgba(44,24,16,0.12); color: var(--ink-text-soft);
          display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;
        }

        .faq-float-btn {
          position: fixed; bottom: 20px; right: 20px; z-index: 40;
          width: 48px; height: 48px; border-radius: 50%;
          background: var(--paper); border: 2px dashed var(--chili);
          color: var(--chili-deep); display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(0,0,0,0.4); cursor: pointer;
        }

        /* ── Misc ── */
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        @media (prefers-reduced-motion: reduce) {
          .ticket-enter, .option-stagger, .points-bump, .award-toast,
          .stamp-slot-filled, .steam, .spin {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}