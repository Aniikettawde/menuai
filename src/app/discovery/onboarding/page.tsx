'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  ArrowRight,
  ChefHat,
  BarChart3,
  BadgePercent,
  QrCode,
  Eye,
  Star,
} from 'lucide-react'
import { getDiscoveryBrowser } from '@/lib/discovery'

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const INPUT =
  'w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/15 transition font-[Inter,system-ui,sans-serif]'

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT}
        autoComplete={type === 'password' ? 'new-password' : undefined}
      />
      {hint && <p className="mt-1.5 text-[11px] text-zinc-600">{hint}</p>}
    </div>
  )
}

const PERKS = [
  { icon: <QrCode size={15} />, label: 'Digital QR menu', sub: 'Live on day one, no printing needed' },
  { icon: <BarChart3 size={15} />, label: 'Analytics dashboard', sub: 'Track views, clicks & reviews' },
  { icon: <BadgePercent size={15} />, label: 'Live offer posts', sub: 'Attract diners with real-time deals' },
  { icon: <Eye size={15} />, label: 'Discovery listing', sub: 'Appear in Pune diner searches' },
]

export default function DiscoveryOnboardingPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [area, setArea] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [tags, setTags] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) setSlug(slugify(restaurantName))
  }, [restaurantName, slug])

  useEffect(() => {
    async function checkExistingSession() {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setEmail(data.user.email ?? '')
        setStep(2)
      }
    }
    void checkExistingSession()
  }, [supabase])

  async function handleNext() {
    setError('')

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email, password })
      if (authError) throw authError
      if (!data.user) throw new Error('Could not create account. Try again.')
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateRestaurant() {
    setError('')

    if (!restaurantName.trim()) {
      setError('Restaurant name is required.')
      return
    }

    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error('Please sign in first.')

      const finalSlug = slugify(slug || restaurantName)
      if (!finalSlug) throw new Error('Could not generate a URL slug.')

      const { error: insertError } = await supabase.from('restaurants').insert({
        owner_id: user.id,
        name: restaurantName.trim(),
        slug: finalSlug,
        description: '',
        city: 'Pune',
        area: area.trim(),
        address: '',
        landmark: '',
        phone: ownerPhone.trim() || null,
        email: email.trim(),
        logo_url: null,
        cover_image_url: null,
        cuisine_tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        is_published: false,
        is_claimed: true,
      })

      if (insertError) throw insertError
      router.push('/discovery/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create restaurant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Inter', system-ui, sans-serif;
          background: #080808;
          color: #f2f2f2;
          -webkit-font-smoothing: antialiased;
          min-height: 100dvh;
        }

        @keyframes float-a {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 20px); }
        }

        @keyframes float-b {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-25px, -15px); }
        }

        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.7); opacity: 0; }
        }

        .onboard-grid {
          display: grid;
          gap: 1.5rem;
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
        }

        @media (min-width: 900px) {
          .onboard-grid {
            grid-template-columns: 1fr 400px !important;
            align-items: start !important;
          }
        }
      `}</style>

      <main
        style={{
          minHeight: '100dvh',
          background: '#080808',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background blobs */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div
            style={{
              position: 'absolute',
              top: '-8rem',
              left: '-8rem',
              width: '32rem',
              height: '32rem',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,122,0,0.13), transparent 70%)',
              filter: 'blur(60px)',
              animation: 'float-a 20s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-6rem',
              right: '-6rem',
              width: '24rem',
              height: '24rem',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245,158,11,0.09), transparent 70%)',
              filter: 'blur(60px)',
              animation: 'float-b 26s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)',
            }}
          />
        </div>

        {/* Nav */}
        <nav
          style={{
            position: 'relative',
            zIndex: 10,
            padding: '0 1.5rem',
            height: 58,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(8,8,8,0.85)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Link href="/discovery" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 19,
                fontWeight: 800,
                color: '#f2f2f2',
                letterSpacing: '-0.02em',
              }}
            >
              Dinezy
            </span>
            <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>Pune</span>
          </Link>
        </nav>

        {/* Body */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2.5rem 1.25rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 1100,
              display: 'grid',
              gap: '1.5rem',
              gridTemplateColumns: 'minmax(0,1fr)',
              alignItems: 'start',
            }}
            className="onboard-grid"
          >
            {/* Form card */}
            <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, overflow: 'hidden' }}>
              {/* Progress bar */}
              <div style={{ height: 3, background: 'rgba(255,255,255,0.05)' }}>
                <div
                  style={{
                    height: '100%',
                    width: step === 1 ? '50%' : '100%',
                    background: 'linear-gradient(90deg, #ff7a00, #f59e0b)',
                    borderRadius: 2,
                    transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              </div>

              <div style={{ padding: '2rem 1.75rem 2.25rem' }}>
                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.75rem' }}>
                  {[1, 2].map((s) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          background: step >= s ? '#ff7a00' : 'rgba(255,255,255,0.05)',
                          color: step >= s ? '#fff' : '#555',
                          border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.08)',
                          transition: 'all 0.3s',
                        }}
                      >
                        {step > s ? <CheckCircle2 size={13} /> : s}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: step >= s ? '#f2f2f2' : '#555' }}>
                        {s === 1 ? 'Account' : 'Restaurant'}
                      </span>
                      {s < 2 && <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />}
                    </div>
                  ))}
                </div>

                {/* Heading */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <h1
                    style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                      fontWeight: 900,
                      letterSpacing: '-0.025em',
                      color: '#f2f2f2',
                      lineHeight: 1.05,
                      marginBottom: 8,
                    }}
                  >
                    {step === 1 ? 'Create your free account' : 'Set up your restaurant'}
                  </h1>
                  <p style={{ fontSize: 13.5, color: '#888', lineHeight: 1.65 }}>
                    {step === 1
                      ? 'Get your restaurant on Dinezy Discovery — no credit card, no catch.'
                      : "A few details and your listing goes live on Pune's dining discovery."}
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div
                    style={{
                      marginBottom: '1.25rem',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid rgba(248,113,113,0.2)',
                      background: 'rgba(248,113,113,0.07)',
                      fontSize: 13,
                      color: '#fca5a5',
                    }}
                  >
                    {error}
                  </div>
                )}

                {step === 1 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Field label="Email address" value={email} onChange={setEmail} placeholder="you@restaurant.com" type="email" />
                    <Field
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Min. 6 characters"
                      type="password"
                      hint="You'll use this to log into your dashboard"
                    />
                    <button
                      onClick={() => void handleNext()}
                      disabled={loading}
                      style={{
                        marginTop: 4,
                        width: '100%',
                        padding: '14px',
                        borderRadius: 16,
                        background: loading ? 'rgba(255,122,0,0.5)' : '#ff7a00',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        border: 'none',
                        cursor: loading ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {loading ? 'Creating account…' : (
                        <>
                          Continue <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                    <p style={{ textAlign: 'center', fontSize: 12.5, color: '#555' }}>
                      Already listed?{' '}
                      <Link href="/discovery/login" style={{ color: '#ff9a40', fontWeight: 600, textDecoration: 'none' }}>
                        Log in
                      </Link>
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Field
                      label="Restaurant name"
                      value={restaurantName}
                      onChange={(v) => {
                        setRestaurantName(v)
                        setSlug(slugify(v))
                      }}
                      placeholder="e.g. Spice Garden"
                    />
                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                      <Field label="Area / Locality" value={area} onChange={setArea} placeholder="Baner, Kothrud…" />
                      <Field label="Phone" value={ownerPhone} onChange={setOwnerPhone} placeholder="+91 98765 43210" />
                    </div>
                    <Field
                      label="Cuisine types"
                      value={tags}
                      onChange={setTags}
                      placeholder="Indian, Chinese, Fast Food"
                      hint="Separate with commas — helps diners find you"
                    />
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: '#666',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          marginBottom: 6,
                        }}
                      >
                        Your page URL
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 16,
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.025)',
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            padding: '12px 14px',
                            fontSize: 12.5,
                            color: '#555',
                            background: 'rgba(255,255,255,0.02)',
                            borderRight: '1px solid rgba(255,255,255,0.06)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          dinezy.in/r/
                        </span>
                        <input
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          placeholder="your-restaurant"
                          style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            padding: '12px 14px',
                            fontSize: 13,
                            color: '#ff9a40',
                            fontFamily: 'inherit',
                            fontWeight: 500,
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button
                        onClick={() => setStep(1)}
                        style={{
                          padding: '13px 20px',
                          borderRadius: 14,
                          border: '1px solid rgba(255,255,255,0.09)',
                          background: 'transparent',
                          color: '#888',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          flexShrink: 0,
                        }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => void handleCreateRestaurant()}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '13px',
                          borderRadius: 14,
                          background: loading ? 'rgba(255,122,0,0.5)' : '#ff7a00',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 700,
                          border: 'none',
                          cursor: loading ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'all 0.2s',
                          fontFamily: 'inherit',
                        }}
                      >
                        {loading ? 'Creating listing…' : (
                          <>
                            <CheckCircle2 size={15} /> Create free listing
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Free badge */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(255,122,0,0.12), rgba(245,158,11,0.08))',
                  border: '1px solid rgba(255,122,0,0.2)',
                  borderRadius: 20,
                  padding: '1.25rem 1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,122,0,0.15)', display: 'grid', placeItems: 'center' }}>
                    <ChefHat size={17} color="#ff9a40" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f2f2f2' }}>Free listing, always</p>
                    <p style={{ fontSize: 11, color: '#888', marginTop: 1 }}>No credit card required</p>
                  </div>
                </div>
                <p style={{ fontSize: 12.5, color: '#777', lineHeight: 1.65 }}>
                  Your restaurant appears on Dinezy Discovery at no cost. Upgrade to unlock full analytics, unlimited offers, and priority placement.
                </p>
              </div>

              {/* Perks */}
              <div
                style={{
                  background: '#111',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 20,
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <p
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#555',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 2,
                  }}
                >
                  What you get
                </p>
                {PERKS.map((p) => (
                  <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: 'rgba(255,122,0,0.09)',
                        border: '1px solid rgba(255,122,0,0.16)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ff7a00',
                        flexShrink: 0,
                      }}
                    >
                      {p.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#e0e0e0' }}>{p.label}</p>
                      <p style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{p.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mock stat preview */}
              <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#f2f2f2' }}>Your dashboard preview</p>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#22c55e',
                      background: 'rgba(34,197,94,0.09)',
                      border: '1px solid rgba(34,197,94,0.18)',
                      borderRadius: 100,
                      padding: '3px 8px',
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: '#22c55e',
                        display: 'inline-block',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          inset: -3,
                          borderRadius: '50%',
                          border: '1.5px solid #22c55e',
                          animation: 'pulse-ring 2s ease-in-out infinite',
                        }}
                      />
                    </span>
                    Live
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Views', val: '1.2k', color: '#ff7a00' },
                    { label: 'Menu', val: '847', color: '#f59e0b' },
                    { label: 'Clicks', val: '214', color: '#22c55e' },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12,
                        padding: '10px 8px',
                        textAlign: 'center',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: '"Playfair Display", Georgia, serif',
                          fontSize: '1.3rem',
                          fontWeight: 800,
                          color: s.color,
                          lineHeight: 1,
                        }}
                      >
                        {s.val}
                      </p>
                      <p style={{ fontSize: 9.5, color: '#555', marginTop: 4, fontWeight: 500 }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255,122,0,0.06)',
                    border: '1px solid rgba(255,122,0,0.14)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontSize: 11.5,
                    color: '#999',
                  }}
                >
                  <Star size={11} color="#f59e0b" fill="#f59e0b" />
                  <span>4.7 avg · 23 reviews this month</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}