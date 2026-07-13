'use client'
// src/app/quiz/page.tsx
//
// Dinezy Foodie Quiz — mobile-first mini-game.
// White canvas so every answer stays fully readable, color used as accents:
// soft tinted answer cards with a bold stripe, saturated CTAs, dark ink text.
// Two-font system: Fredoka carries personality on headlines only, Plus Jakarta
// Sans handles everything you actually read (body, buttons, labels).
// Splash → Intro → Question x6 → Result (persona + cashback unlock) → Share
// (share now hands people a real image card — score, persona, a funny
// one-liner — not just a text link). Copy is English throughout; the only
// Hindi is a single punchy, shareable one-liner on the result/share card.
// The card + link travel together no matter which app the person shares into.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Fredoka, Plus_Jakarta_Sans } from 'next/font/google'

const display = Fredoka({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display' })
const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-body',
})

// ─── Quiz data ─────────────────────────────────────────────────────────────

type OptionLetter = 'A' | 'B' | 'C'
type Option = { letter: OptionLetter; emoji: string; text: string }
type Question = { key: string; emoji: string; prompt: string; options: Option[] }

const QUIZ_URL = 'https://dinezy.in/quiz'

// Each theme = a stripe/chip color + a soft tint background. Text stays dark
// ink on a light tint, so contrast holds no matter the accent.
const CARD_THEMES = [
  { stripe: '#FF6B35', tint: '#FFF1E8', chip: '#FFE1CC' }, // orange
  { stripe: '#FF3D7F', tint: '#FFEEF4', chip: '#FFD3E3' }, // pink
  { stripe: '#F2A900', tint: '#FFF8E1', chip: '#FFE9A8' }, // gold
]

const QUESTIONS: Question[] = [
  {
    key: 'q1',
    emoji: '🍟',
    prompt: 'Your friend says, "I\'m not hungry." What do you do?',
    options: [
      { letter: 'A', emoji: '🍟', text: 'Time to find new friend.' },
      { letter: 'B', emoji: '🍔', text: "Order extra fries because they'll definitely steal yours." },
      { letter: 'C', emoji: '🌮', text: 'Order two meals "just in case."' },
    ],
  },
  {
    key: 'q2',
    emoji: '🌙',
    prompt: "You open the fridge at 2 AM. What's your mission?",
    options: [
      { letter: 'A', emoji: '🥛', text: 'Drink water and go back to sleep.' },
      { letter: 'B', emoji: '🍕', text: 'Look for leftover pizza.' },
      { letter: 'C', emoji: '🍰', text: 'Eat anything that looks edible.' },
    ],
  },
  {
    key: 'q3',
    emoji: '📲',
    prompt: 'Which notification excites you the most?',
    options: [
      { letter: 'A', emoji: '📧', text: 'Salary credited.' },
      { letter: 'B', emoji: '📦', text: 'Your online order has arrived.' },
      { letter: 'C', emoji: '🍽️', text: '"Your food order is out for delivery."' },
    ],
  },
  {
    key: 'q4',
    emoji: '😨',
    prompt: "What's your biggest fear?",
    options: [
      { letter: 'A', emoji: '😨', text: 'Running out of money.' },
      { letter: 'B', emoji: '📶', text: 'No internet.' },
      { letter: 'C', emoji: '🍟', text: 'Someone says, "Let\'s split one plate."' },
    ],
  },
  {
    key: 'q5',
    emoji: '🔥',
    prompt: "If calories didn't exist, what would you do?",
    options: [
      { letter: 'A', emoji: '🥗', text: 'Eat healthy anyway.' },
      { letter: 'B', emoji: '🍕', text: 'Pizza for breakfast, burgers for lunch, desserts for dinner.' },
      { letter: 'C', emoji: '🍩', text: 'Open the fridge every 30 minutes for a snack.' },
    ],
  },
  {
    key: 'q6',
    emoji: '💸',
    prompt: 'Dinezy says: "We\'ll give you ₹50 cashback on top of the restaurant\'s offer." What\'s your reaction? 💸🍕',
    options: [
      { letter: 'A', emoji: '😎', text: 'Nice! Free money is free money.' },
      { letter: 'B', emoji: '🏃', text: "Where's the nearest Dinezy restaurant? I'm leaving now!" },
      { letter: 'C', emoji: '🤣', text: "Wait... you're telling me I get to eat AND save money? Is this a dream?" },
    ],
  },
]

const POINTS: Record<OptionLetter, number> = { A: 1, B: 2, C: 3 }
const MAX_SCORE = QUESTIONS.length * 3 // 18
const REACTIONS = ['😂', '🤣', '🔥', '🍕']

type Persona = {
  emoji: string
  title: string
  min: number
  max: number
  accent: string
  accentSoft: string
  chip: string
  traits: string[]
  // A single punchy, shareable Hindi one-liner for the result/share card.
  // This is the only Hindi text in the whole experience — everything else
  // is in English.
  line: string
}

const PERSONAS: Persona[] = [
  {
    emoji: '🥗',
    title: 'The Disciplined Eater',
    min: 6,
    max: 9,
    accent: '#1FAF63',
    accentSoft: '#158048',
    chip: '#E3F7EC',
    traits: [
      'Checks the banking app before the food app.',
      'Drinks water at 2 AM. Actual discipline.',
      'Splits the bill AND the fries.',
      'Salary notifications excite you more than delivery ones.',
    ],
    line: 'Willpower 100%, bas fries ke saamne thoda kam ho jaata hai.',
  },
  {
    emoji: '🍕',
    title: 'The Casual Foodie',
    min: 10,
    max: 14,
    accent: '#E8890C',
    accentSoft: '#B5680A',
    chip: '#FFF1DA',
    traits: [
      'Will fight (a little) over the last fry.',
      'Order notifications genuinely make your day.',
      'You have some self-control... some.',
      'Calories become negotiable on weekends.',
    ],
    line: 'Aadhi diet, aadha chaos, poori bhookh.',
  },
  {
    emoji: '🤠',
    title: 'The Certified Foodie',
    min: 15,
    max: 18,
    accent: '#6D28D9',
    accentSoft: '#4C1D95',
    chip: '#EEE6FC',
    traits: [
      'Checks the food app before bed.',
      "Fries are never really 'for sharing'.",
      "Weekends don't have calorie counts.",
      'Cashback excites you more than payday.',
    ],
    line: 'Menu nahi dekhta, menu tujhe dekhta hai.',
  },
]

function getPersona(score: number): Persona {
  return PERSONAS.find((p) => score >= p.min && score <= p.max) ?? PERSONAS[1]
}

// ─── Tracking ──────────────────────────────────────────────────────────────

function track(payload: Record<string, unknown>) {
  try {
    fetch('/api/quiz/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // never let tracking break the quiz
  }
}

// ─── Canvas helpers (share-card generation) ────────────────────────────────

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

const EMOJI_FONT_STACK = `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`

// ─── Confetti — only on the result reveal ─────────────────────────────────

function Confetti() {
  const pieces = useMemo(() => {
    const emojis = ['🍕', '🍟', '🍔', '🌮', '🌶️', '🎉', '✨', '🏆']
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 2 + Math.random() * 1.2,
      rotate: Math.random() * 360,
      size: 14 + Math.random() * 14,
    }))
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-[-40px]"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // @ts-expect-error custom property for keyframe
            '--rot': `${p.rotate}deg`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}

// ─── Floating tap-reactions ─────────────────────────────────────────────────

function ReactionBurst({ burstId }: { burstId: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        id: i,
        emoji: REACTIONS[(burstId + i) % REACTIONS.length],
        offsetX: (i - 1.5) * 22,
      })),
    [burstId],
  )
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {pieces.map((p) => (
        <span key={p.id} className="react-pop absolute text-2xl" style={{ ['--tx' as string]: `${p.offsetX}px` }}>
          {p.emoji}
        </span>
      ))}
    </div>
  )
}

// ─── Sticky progress header (question screens) ─────────────────────────────

function ProgressHeader({ index, total }: { index: number; total: number }) {
  const pct = ((index + 1) / total) * 100
  return (
    <div className="progress-header sticky top-0 z-30 -mx-5 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#1F1410]/55">
          <span aria-hidden>🍽️</span> Dinezy
        </span>
        <span className="rounded-full bg-[#1F1410]/6 px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#1F1410]/60">
          {index + 1} / {total}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1F1410]/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF3D7F] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Circular score ring ─────────────────────────────────────────────────

function ScoreRing({ score, max, accent }: { score: number; max: number; accent: string }) {
  const r = 46
  const c = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, score / max))
  return (
    <svg viewBox="0 0 108 108" className="h-28 w-28 -rotate-90">
      <circle cx="54" cy="54" r={r} fill="none" stroke="#1F1410" strokeOpacity="0.08" strokeWidth="10" />
      <circle
        cx="54"
        cy="54"
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.34,1.2,.64,1)' }}
      />
    </svg>
  )
}

// ─── Screens ────────────────────────────────────────────────────────────────

type Screen = 'splash' | 'intro' | 'question' | 'result' | 'share'

export default function QuizPage() {
  const sessionId = useRef<string>('')
  if (!sessionId.current) {
    sessionId.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }

  const [screen, setScreen] = useState<Screen>('splash')
  const [qIndex, setQIndex] = useState(0)
  const [answerLetters, setAnswerLetters] = useState<OptionLetter[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [pickedLetter, setPickedLetter] = useState<OptionLetter | null>(null)
  const [burstId, setBurstId] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [shared, setShared] = useState(false)
  const [displayScore, setDisplayScore] = useState(0)

  // Share-card generation state
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [cardBlob, setCardBlob] = useState<Blob | null>(null)
  const [cardLoading, setCardLoading] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const score = useMemo(() => answerLetters.reduce((s, l) => s + POINTS[l], 0), [answerLetters])
  const persona = useMemo(() => getPersona(score), [score])
  const funnyLine = persona.line

  useEffect(() => {
    if (screen !== 'splash') return
    const t = setTimeout(() => setScreen('intro'), 1100)
    return () => clearTimeout(t)
  }, [screen])

  useEffect(() => {
    if (screen !== 'result') return
    setDisplayScore(0)
    const target = score
    const start = Date.now()
    const duration = 700
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / duration)
      setDisplayScore(Math.round(target * progress))
      if (progress >= 1) clearInterval(timer)
    }, 45)
    setShowConfetti(true)
    const confettiTimer = setTimeout(() => setShowConfetti(false), 3200)
    return () => {
      clearInterval(timer)
      clearTimeout(confettiTimer)
    }
  }, [screen, score])

  const startQuiz = useCallback(() => {
    track({ session_id: sessionId.current, event_type: 'start' })
    setScreen('question')
  }, [])

  const selectOption = useCallback(
    (opt: Option) => {
      if (advancing) return
      setAdvancing(true)
      setPickedLetter(opt.letter)
      setBurstId(Date.now())

      const q = QUESTIONS[qIndex]
      track({ session_id: sessionId.current, event_type: 'answer_select', question_key: q.key, answer: opt.letter })

      setAnswerLetters((prev) => [...prev, opt.letter])

      setTimeout(() => {
        if (qIndex + 1 < QUESTIONS.length) {
          setQIndex((i) => i + 1)
          setAdvancing(false)
          setPickedLetter(null)
          setBurstId(null)
        } else {
          const finalLetters = [...answerLetters, opt.letter]
          const finalScore = finalLetters.reduce((s, l) => s + POINTS[l], 0)
          const finalPersona = getPersona(finalScore)
          track({
            session_id: sessionId.current,
            event_type: 'completed',
            total_score: finalScore,
            tier: finalPersona.title,
          })
          setScreen('result')
        }
      }, 550)
    },
    [advancing, qIndex, answerLetters],
  )

  const restart = useCallback(() => {
    track({ session_id: sessionId.current, event_type: 'restart' })
    setScreen('intro')
    setQIndex(0)
    setAnswerLetters([])
    setPickedLetter(null)
    setShared(false)
    setShareNote(null)
  }, [])

  // Result → Share directly. The cashback reward is revealed inline on the
  // result screen instead of its own screen, so this is now a single tap.
  const goToShare = useCallback(() => {
    track({ session_id: sessionId.current, event_type: 'cashback_unlock', tier: persona.title })
    setScreen('share')
  }, [persona.title])

  // ── Build the share-card image (canvas → PNG blob) ──
  // A proper "story card": brand badge, ringed persona avatar, a real score
  // bar, a quote block (the one Hindi line), a perforated cashback coupon,
  // and a floating link pill — so the quiz URL is baked into the image
  // itself and travels with it no matter what app it lands in.
  const generateShareCard = useCallback(async (): Promise<Blob | null> => {
    if (typeof document === 'undefined') return null
    const W = 1080
    const H = 1350
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    try {
      if (document.fonts && 'ready' in document.fonts) await document.fonts.ready
    } catch {
      // continue with fallback fonts if font loading can't be awaited
    }

    const displayFont = display.style.fontFamily
    const bodyFont = body.style.fontFamily

    // ── Background: diagonal persona gradient ──
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, persona.accent)
    grad.addColorStop(1, persona.accentSoft)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Soft glow blobs for depth
    ctx.save()
    ctx.globalAlpha = 0.1
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(W - 40, 70, 190, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(30, H - 40, 220, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Subtle scattered food-emoji texture behind the card
    ctx.save()
    ctx.globalAlpha = 0.12
    ctx.textAlign = 'center'
    ctx.font = `42px ${EMOJI_FONT_STACK}`
    const bgEmojis = ['🍕', '🍔', '🍟', '🌮', '🍩', '🥤']
    for (let i = 0; i < 24; i++) {
      const col = i % 6
      const row = Math.floor(i / 6)
      const x = col * (W / 6) + W / 12
      const y = row * (H / 4) + H / 8
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate((((i * 41) % 46) - 23) * (Math.PI / 180))
      ctx.fillText(bgEmojis[i % bgEmojis.length], 0, 0)
      ctx.restore()
    }
    ctx.restore()

    ctx.textAlign = 'center'

    // ── Brand badge, floating above the card ──
    const badgeW = 360
    const badgeH = 78
    const badgeX = W / 2 - badgeW / 2
    const badgeY = 66
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.18)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2)
    ctx.fill()
    ctx.restore()
    ctx.font = `38px ${EMOJI_FONT_STACK}`
    ctx.fillText('🍽️', badgeX + 54, badgeY + badgeH / 2 + 13)
    ctx.textAlign = 'left'
    ctx.fillStyle = persona.accent
    ctx.font = `800 27px ${bodyFont}`
    ctx.fillText('DINEZY', badgeX + 96, badgeY + 34)
    ctx.fillStyle = 'rgba(31,20,16,0.5)'
    ctx.font = `700 18px ${bodyFont}`
    ctx.fillText('F O O D I E   Q U I Z', badgeX + 96, badgeY + 58)
    ctx.textAlign = 'center'

    // ── Main white panel ──
    const panelX = 64
    const panelY = 190
    const panelW = W - panelX * 2
    const panelH = 950
    const panelBottom = panelY + panelH
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 56
    ctx.shadowOffsetY = 26
    ctx.fillStyle = '#FFFFFF'
    roundRectPath(ctx, panelX, panelY, panelW, panelH, 56)
    ctx.fill()
    ctx.restore()

    // Persona avatar: ringed circle sitting on the panel
    const avatarY = panelY + 150
    const avatarR = 112
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.18)'
    ctx.shadowBlur = 28
    ctx.shadowOffsetY = 14
    ctx.fillStyle = persona.chip
    ctx.beginPath()
    ctx.arc(W / 2, avatarY, avatarR, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.lineWidth = 9
    ctx.strokeStyle = persona.accent
    ctx.beginPath()
    ctx.arc(W / 2, avatarY, avatarR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.font = `128px ${EMOJI_FONT_STACK}`
    ctx.fillText(persona.emoji, W / 2, avatarY + 46)

    // Small sparkle accents flanking the avatar
    ctx.font = `44px ${EMOJI_FONT_STACK}`
    ctx.fillText('✨', W / 2 - avatarR - 46, avatarY - avatarR + 30)
    ctx.fillText('✨', W / 2 + avatarR + 46, avatarY + avatarR - 20)

    // Persona title
    ctx.fillStyle = persona.accent
    ctx.font = `700 58px ${displayFont}`
    let y = avatarY + avatarR + 82
    ctx.fillText(persona.title, W / 2, y)

    // Score label + big number
    y += 56
    ctx.fillStyle = 'rgba(31,20,16,0.4)'
    ctx.font = `800 22px ${bodyFont}`
    ctx.fillText('F O O D I E   S C O R E', W / 2, y)

    y += 56
    ctx.fillStyle = '#1F1410'
    ctx.font = `800 52px ${bodyFont}`
    ctx.fillText(`${score} / ${MAX_SCORE}`, W / 2, y)

    // Score progress bar
    y += 30
    const barW = 520
    const barX = W / 2 - barW / 2
    const barH = 16
    ctx.fillStyle = 'rgba(31,20,16,0.08)'
    roundRectPath(ctx, barX, y, barW, barH, barH / 2)
    ctx.fill()
    const fillW = Math.max(barH, (barW * score) / MAX_SCORE)
    ctx.fillStyle = persona.accent
    roundRectPath(ctx, barX, y, fillW, barH, barH / 2)
    ctx.fill()

    // Divider with a small dot
    y += 62
    ctx.strokeStyle = 'rgba(31,20,16,0.12)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(panelX + 90, y)
    ctx.lineTo(W / 2 - 14, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(W / 2 + 14, y)
    ctx.lineTo(panelX + panelW - 90, y)
    ctx.stroke()
    ctx.fillStyle = persona.accent
    ctx.beginPath()
    ctx.arc(W / 2, y, 6, 0, Math.PI * 2)
    ctx.fill()

    // The one Hindi line, styled like a quote
    y += 60
    ctx.fillStyle = persona.chip
    ctx.font = `800 64px ${bodyFont}`
    ctx.fillText('\u201C', W / 2, y)

    y += 40
    ctx.fillStyle = 'rgba(31,20,16,0.8)'
    ctx.font = `italic 600 40px ${bodyFont}`
    const wrapped = wrapCanvasText(ctx, funnyLine, panelW - 160)
    for (const l of wrapped) {
      ctx.fillText(l, W / 2, y)
      y += 52
    }

    // Perforated cashback coupon, pinned near the bottom of the panel
    const couponH = 128
    const couponY = panelBottom - couponH - 56
    const couponX = panelX + 56
    const couponW = panelW - 112
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.12)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 8
    ctx.fillStyle = persona.chip
    roundRectPath(ctx, couponX, couponY, couponW, couponH, 24)
    ctx.fill()
    ctx.restore()
    // ticket notches
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(couponX, couponY + couponH / 2, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(couponX + couponW, couponY + couponH / 2, 22, 0, Math.PI * 2)
    ctx.fill()
    // dashed center divider
    ctx.save()
    ctx.strokeStyle = 'rgba(31,20,16,0.18)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(couponX + 150, couponY + 20)
    ctx.lineTo(couponX + 150, couponY + couponH - 20)
    ctx.stroke()
    ctx.restore()
    // gift icon
    ctx.textAlign = 'center'
    ctx.font = `56px ${EMOJI_FONT_STACK}`
    ctx.fillText('🎁', couponX + 85, couponY + couponH / 2 + 20)
    // coupon text
    ctx.textAlign = 'left'
    ctx.fillStyle = persona.accent
    ctx.font = `800 36px ${bodyFont}`
    ctx.fillText('₹50 cashback unlocked', couponX + 180, couponY + 58)
    ctx.fillStyle = 'rgba(31,20,16,0.55)'
    ctx.font = `700 26px ${bodyFont}`
    ctx.fillText('Use it at any Dinezy restaurant', couponX + 180, couponY + 96)
    ctx.textAlign = 'center'

    // ── Floating link pill straddling the panel's bottom edge ──
    const pillW = 640
    const pillH = 96
    const pillX = W / 2 - pillW / 2
    const pillY = panelBottom - pillH / 2
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 12
    ctx.fillStyle = persona.accent
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `800 34px ${bodyFont}, ${EMOJI_FONT_STACK}`
    ctx.fillText(`🔗  dinezy.in/quiz`, W / 2, pillY + pillH / 2 + 13)

    // Footer line below everything
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `700 30px ${bodyFont}`
    ctx.fillText('Get your result — play the quiz 👇', W / 2, H - 56)

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.95))
  }, [persona, score, funnyLine])

  // Generate the card once we land on the share screen
  useEffect(() => {
    if (screen !== 'share') return
    let cancelled = false
    setCardLoading(true)
    generateShareCard().then((blob) => {
      if (cancelled) return
      setCardLoading(false)
      if (!blob) return
      const url = URL.createObjectURL(blob)
      setCardBlob(blob)
      setCardUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    })
    return () => {
      cancelled = true
    }
  }, [screen, generateShareCard])

  // Release the object URL when the component unmounts
  useEffect(() => {
    return () => {
      if (cardUrl) URL.revokeObjectURL(cardUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shareCaption = `I just found out I'm a "${persona.title}" ${persona.emoji} on the Dinezy Foodie Quiz — "${funnyLine}" Try it yourself 👉 ${QUIZ_URL}`
  const challengeCaption = `Bet you can't beat my Dinezy Foodie score 😏 ${shareCaption}`

  const downloadCard = useCallback(() => {
    if (!cardUrl) return
    const a = document.createElement('a')
    a.href = cardUrl
    a.download = 'dinezy-foodie-result.png'
    a.click()
  }, [cardUrl])

  const copyLink = useCallback(async () => {
    track({ session_id: sessionId.current, event_type: 'share_click', action: 'copy_link', tier: persona.title })
    try {
      await navigator.clipboard.writeText(shareCaption)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2200)
    } catch {
      setShareNote("Couldn't copy the link — here it is: " + QUIZ_URL)
    }
  }, [persona.title, shareCaption])

  // The card image always carries the URL baked into its footer pill, so
  // even apps that strip share "text" (e.g. some Story sheets) still show
  // the link. We additionally pass the caption as text wherever the target
  // supports it, and fall back to a copyable link if native share is absent.
  const shareCardImage = useCallback(
    async (message: string, action: string) => {
      track({ session_id: sessionId.current, event_type: 'share_click', action, tier: persona.title })
      if (!cardBlob) return

      const file = new File([cardBlob], 'dinezy-foodie-result.png', { type: 'image/png' })

      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        const nav = navigator as Navigator & {
          canShare?: (data: unknown) => boolean
          share: (data: unknown) => Promise<void>
        }
        if (!nav.canShare || nav.canShare({ files: [file] })) {
          try {
            await nav.share({ files: [file], title: 'Dinezy Foodie Quiz', text: message })
            setShared(true)
            setShareNote(null)
            return
          } catch {
            // user cancelled the native sheet — fall through to the fallback below
            return
          }
        }
      }

      // Fallback for browsers that can't share image files directly:
      // save the card locally and open a text-based share (with the link) as backup.
      downloadCard()
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
      setShared(true)
      setShareNote('Card image saved — attach it in the chat that just opened.')
    },
    [cardBlob, persona.title, downloadCard],
  )

  return (
    <div className={`quiz-app ${display.variable} ${body.variable} ${body.className}`}>
      <div className="quiz-frame">
        {showConfetti && <Confetti />}

        {screen !== 'splash' && screen !== 'question' && (
          <div className="absolute left-5 top-[calc(env(safe-area-inset-top)+16px)] z-30 flex items-center gap-1.5 text-[13px] font-bold text-[#1F1410]/45">
            <span aria-hidden>🍽️</span> Dinezy
          </div>
        )}

        {/* ── SPLASH ── */}
        {screen === 'splash' && (
          <div className="splash-screen flex min-h-[100dvh] flex-col items-center justify-center bg-[#FF6B35]">
            <div className="logo-pop text-6xl">🍽️</div>
            <p className="font-display mt-3 text-3xl font-bold tracking-tight text-white">Dinezy</p>
          </div>
        )}

        {/* ── INTRO ── */}
        {screen === 'intro' && (
          <div className="fade-up flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="float-emoji-row mb-2 flex gap-3 text-5xl">
              <span className="float-a" aria-hidden>🍔</span>
              <span className="float-b" aria-hidden>🍕</span>
              <span className="float-c" aria-hidden>🍟</span>
            </div>
            <h1 className="font-display text-[2.15rem] font-bold leading-[1.12] text-[#1F1410]">
              Your Food Personality
              <br />
              <span className="text-[#FF3D7F]">In 20 Seconds</span>
            </h1>
            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-[#1F1410]/65">
              6 funny questions. Zero overthinking.
              <br />
              Maximum judgement 😂
            </p>

            <button
              onClick={startQuiz}
              className="btn-bounce mt-8 w-full max-w-[280px] rounded-2xl bg-[#FF3D7F] py-4 text-[17px] font-bold text-white shadow-[0_6px_0_0_#c21358] transition active:translate-y-1 active:shadow-[0_2px_0_0_#c21358]"
            >
              Start the Quiz →
            </button>
            <p className="mt-4 text-[12px] font-bold tracking-wide text-[#1F1410]/40">
              20 seconds · No signup · Free
            </p>
          </div>
        )}

        {/* ── QUESTION ── */}
        {screen === 'question' && (
          <div className="flex min-h-[100dvh] flex-col gap-6 px-5 pb-8">
            <ProgressHeader index={qIndex} total={QUESTIONS.length} />

            <div className="flex flex-1 flex-col justify-center gap-6">
              <div key={qIndex} className="slide-in flex flex-col items-center text-center">
                <p className="q-emoji text-6xl" aria-hidden>
                  {QUESTIONS[qIndex].emoji}
                </p>
                <h2 className="font-display mt-4 text-[26px] font-semibold leading-tight text-[#1F1410]">
                  {QUESTIONS[qIndex].prompt}
                </h2>
              </div>

              <div className="space-y-3">
                {QUESTIONS[qIndex].options.map((opt, i) => {
                  const theme = CARD_THEMES[i]
                  const isPicked = pickedLetter === opt.letter
                  return (
                    <div key={opt.letter} className="relative">
                      <button
                        onClick={() => selectOption(opt)}
                        disabled={advancing}
                        className={`answer-card flex w-full items-center gap-3 rounded-2xl border-l-[6px] py-4 pl-4 pr-4 text-left shadow-sm transition disabled:opacity-70 ${
                          isPicked ? 'answer-picked' : ''
                        }`}
                        style={{ backgroundColor: theme.tint, borderColor: theme.stripe }}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                          style={{ backgroundColor: theme.chip }}
                          aria-hidden
                        >
                          {opt.emoji}
                        </span>
                        <span className="text-[15px] font-semibold leading-snug text-[#1F1410]">{opt.text}</span>
                      </button>
                      {isPicked && burstId !== null && <ReactionBurst burstId={burstId} />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULT (persona reveal + cashback unlock, one screen) ── */}
        {screen === 'result' && (
          <div className="fade-up flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10 text-center">
            <p className="reveal-1 text-[13px] font-bold uppercase tracking-[0.2em] text-[#1F1410]/45">
              Your result is in
            </p>

            <div className="reveal-2 relative mt-4 flex h-28 w-28 items-center justify-center">
              <ScoreRing score={displayScore} max={MAX_SCORE} accent={persona.accent} />
              <span className="absolute text-5xl" aria-hidden>
                {persona.emoji}
              </span>
            </div>

            <h1 className="font-display reveal-3 mt-4 text-[26px] font-bold leading-tight" style={{ color: persona.accent }}>
              {persona.title}
            </h1>
            <p className="reveal-3 mt-1 text-[13px] font-bold tabular-nums text-[#1F1410]/45">
              Foodie Score {displayScore} / {MAX_SCORE}
            </p>

            <div className="reveal-4 mt-5 w-full space-y-2 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#1F1410]/45">Here&apos;s what we know...</p>
              {persona.traits.map((trait, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-[#F7F5F2] px-3.5 py-3">
                  <span className="mt-0.5 text-[15px] font-bold" style={{ color: persona.accent }} aria-hidden>
                    ✓
                  </span>
                  <span className="text-[14px] font-semibold leading-snug text-[#1F1410]">{trait}</span>
                </div>
              ))}
            </div>

            <div
              className="reveal-4 mt-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
              style={{ backgroundColor: persona.chip }}
            >
              <span className="text-2xl" aria-hidden>🎁</span>
              <div>
                <p className="text-[14px] font-extrabold" style={{ color: persona.accent }}>
                  ₹50 cashback unlocked
                </p>
                <p className="text-[12px] font-semibold text-[#1F1410]/55">Use it at any Dinezy restaurant</p>
              </div>
            </div>

            <button
              onClick={goToShare}
              className="btn-bounce mt-6 w-full max-w-[280px] rounded-2xl bg-[#FF3D7F] py-4 text-[16px] font-bold text-white shadow-[0_6px_0_0_#c21358] transition active:translate-y-1 active:shadow-[0_2px_0_0_#c21358]"
            >
              Share My Result 🎉
            </button>
          </div>
        )}

        {/* ── SHARE (real image card, not just a link) ── */}
        {screen === 'share' && (
          <div className="fade-up flex min-h-[100dvh] flex-col items-center justify-center px-6 py-9 text-center">
            <h1 className="font-display text-[22px] font-bold text-[#1F1410]">Your card is ready 🤣</h1>
            <p className="mt-1.5 text-[14px] font-semibold text-[#1F1410]/55">Someone&apos;s gotta see this.</p>

            {/* Card preview */}
            <div
              className="card-preview mt-5 w-full max-w-[280px] overflow-hidden rounded-[28px] shadow-[0_16px_40px_-12px_rgba(31,20,16,0.35)]"
              style={{ aspectRatio: '1080 / 1350', backgroundColor: persona.accent }}
            >
              {cardLoading || !cardUrl ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/80">
                  <span className="card-spinner h-8 w-8 rounded-full border-[3px] border-white/40 border-t-white" />
                  <span className="text-[12px] font-bold">Building your card...</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cardUrl} alt={`${persona.title} — Dinezy Foodie Quiz result card`} className="h-full w-full object-cover" />
              )}
            </div>

            <div className="mt-6 w-full max-w-[300px] space-y-3">
              <button
                onClick={() => shareCardImage(shareCaption, 'native_share')}
                disabled={!cardBlob}
                className="btn-bounce w-full rounded-2xl bg-[#1FAF63] py-4 text-[15px] font-bold text-white shadow-[0_5px_0_0_#158048] transition active:translate-y-1 active:shadow-[0_1px_0_0_#158048] disabled:opacity-60"
              >
                {shared ? 'Shared ✓ — send to another friend' : 'Share Card'}
              </button>

              <button
                onClick={() => shareCardImage(challengeCaption, 'challenge_friends')}
                disabled={!cardBlob}
                className="btn-bounce w-full rounded-2xl bg-[#FF3D7F] py-4 text-[15px] font-bold text-white shadow-[0_5px_0_0_#c21358] transition active:translate-y-1 active:shadow-[0_1px_0_0_#c21358] disabled:opacity-60"
              >
                Challenge a Friend
              </button>

              <div className="flex gap-2">
                <button
                  onClick={downloadCard}
                  disabled={!cardUrl}
                  className="btn-bounce flex-1 rounded-2xl border-2 border-[#1F1410]/10 bg-white py-3.5 text-[14px] font-bold text-[#1F1410] transition active:scale-[0.98] disabled:opacity-60"
                >
                  Save Image
                </button>
                <button
                  onClick={copyLink}
                  className="btn-bounce flex-1 rounded-2xl border-2 border-[#1F1410]/10 bg-white py-3.5 text-[14px] font-bold text-[#1F1410] transition active:scale-[0.98]"
                >
                  {linkCopied ? 'Copied ✓' : '🔗 Copy Link'}
                </button>
              </div>

              {shareNote && (
                <p className="rounded-xl bg-[#F7F5F2] px-3 py-2 text-[12px] font-semibold text-[#1F1410]/60">
                  {shareNote}
                </p>
              )}

              <button
                onClick={restart}
                className="w-full py-1 text-[12px] font-semibold text-[#1F1410]/40 underline underline-offset-4"
              >
                Retake the Quiz
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .quiz-app {
          min-height: 100dvh;
          display: flex;
          justify-content: center;
          background: #FFFFFF;
        }
        .font-display {
          font-family: var(--font-display), ${display.style.fontFamily}, sans-serif;
        }
        .quiz-frame {
          position: relative;
          width: 100%;
          max-width: 430px;
          min-height: 100dvh;
          overflow-y: auto;
          overflow-x: hidden;
          background: #FFFFFF;
        }
        .progress-header {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        button {
          font-family: inherit;
        }
        button:focus-visible,
        a:focus-visible {
          outline: 2px solid #FF3D7F;
          outline-offset: 2px;
        }

        @keyframes logoPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .logo-pop { animation: logoPop 0.6s cubic-bezier(.34,1.56,.64,1); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.4s ease-out; }

        @keyframes floatBob {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-10px) rotate(4deg); }
        }
        .float-a { animation: floatBob 2.6s ease-in-out infinite; }
        .float-b { animation: floatBob 2.6s ease-in-out infinite 0.3s; }
        .float-c { animation: floatBob 2.6s ease-in-out infinite 0.6s; }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .slide-in { animation: slideIn 0.35s ease-out; }

        @keyframes qEmojiPop {
          0% { transform: scale(0.6) rotate(-10deg); }
          60% { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .q-emoji { animation: qEmojiPop 0.4s cubic-bezier(.34,1.56,.64,1); }

        .answer-card:active { transform: scale(0.97); }
        .answer-picked { animation: answerBounce 0.4s ease; }
        @keyframes answerBounce {
          0% { transform: scale(1); }
          40% { transform: scale(0.95); }
          70% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }

        @keyframes reactPop {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          25% { opacity: 1; transform: translate(var(--tx), -18px) scale(1.2); }
          100% { transform: translate(var(--tx), -52px) scale(0.9); opacity: 0; }
        }
        .react-pop { animation: reactPop 0.6s ease-out forwards; }

        .btn-bounce:active { transform: translateY(2px) scale(0.98); }

        .reveal-1 { animation: fadeUp 0.4s ease-out 0s both; }
        .reveal-2 { animation: fadeUp 0.4s ease-out 0.15s both; }
        .reveal-3 { animation: fadeUp 0.4s ease-out 0.3s both; }
        .reveal-4 { animation: fadeUp 0.4s ease-out 0.45s both; }

        .card-preview { animation: fadeUp 0.45s ease-out 0.1s both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .card-spinner { animation: spin 0.8s linear infinite; }

        @keyframes confettiFall {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(var(--rot)); opacity: 0.9; }
        }
        .confetti-piece {
          animation-name: confettiFall;
          animation-timing-function: ease-in;
          animation-fill-mode: forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .logo-pop, .fade-up, .float-a, .float-b, .float-c,
          .slide-in, .q-emoji, .answer-picked, .react-pop, .reveal-1, .reveal-2,
          .reveal-3, .reveal-4, .confetti-piece, .card-preview, .card-spinner {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}