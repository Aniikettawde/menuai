'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface FormState {
  name: string
  brand: string
  email: string
  phone: string
  city: string
}

const FIELDS: { key: keyof FormState; label: string; placeholder: string; type: string }[] = [
  { key: 'name', label: 'Your name', placeholder: 'Raj Sharma', type: 'text' },
  { key: 'brand', label: 'Restaurant name', placeholder: 'Spice Garden', type: 'text' },
  { key: 'email', label: 'Email address', placeholder: 'raj@spicegarden.in', type: 'email' },
  { key: 'phone', label: 'Phone number', placeholder: '+91 98765 43210', type: 'tel' },
  { key: 'city', label: 'City', placeholder: 'Pune', type: 'text' },
]

export function BookDemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<FormState>({ name: '', brand: '', email: '', phone: '', city: '' })
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function validate() {
    const e: Partial<FormState> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.brand.trim()) e.brand = 'Required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email needed'
    if (!/^\+?[\d\s-]{10,}$/.test(form.phone)) e.phone = 'Valid phone needed'
    if (!form.city.trim()) e.city = 'Required'
    return e
  }

  async function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/book-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Something went wrong.')
      setSubmitted(true)
    } catch {
      setErrors({ email: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSubmitted(false)
    setForm({ name: '', brand: '', email: '', phone: '', city: '' })
    setErrors({})
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-t-2xl bg-white p-7 shadow-elegant-lg sm:rounded-2xl"
          >
            {!submitted ? (
              <>
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h2
                      id="demo-modal-title"
                      className="font-display text-[22px] font-semibold tracking-tight text-ink"
                    >
                      Book your demo
                    </h2>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      We&apos;ll set up your menu live, while you watch.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    aria-label="Close"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-canvas hover:text-ink"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3.5">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <label
                        htmlFor={f.key}
                        className="mb-1.5 block text-[12px] font-medium text-ink-soft"
                      >
                        {f.label}
                      </label>
                      <input
                        id={f.key}
                        type={f.type}
                        placeholder={f.placeholder}
                        value={form[f.key]}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, [f.key]: e.target.value }))
                          setErrors((p) => ({ ...p, [f.key]: undefined }))
                        }}
                        className={`w-full rounded-xl border px-4 py-3 text-[14px] text-ink outline-none transition focus:border-accent ${
                          errors[f.key] ? 'border-red-400' : 'border-line'
                        }`}
                      />
                      {errors[f.key] && (
                        <p className="mt-1 text-[12px] text-red-500">{errors[f.key]}</p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="mt-6 w-full cursor-pointer rounded-xl bg-accent py-4 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-70"
                >
                  {loading ? 'Sending…' : 'Book my demo →'}
                </button>
                <p className="mt-3 text-center text-[12px] text-ink-faint">
                  We respond within 2 hours during business hours
                </p>
              </>
            ) : (
              <div className="py-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 font-display text-xl font-semibold text-accent">
                  ✓
                </div>
                <h2 className="font-display text-[20px] font-semibold text-ink">Demo booked!</h2>
                <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-ink-soft">
                  We&apos;ll reach out to{' '}
                  <span className="font-medium text-accent">{form.email}</span> within 2 hours to
                  schedule your live walkthrough.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-6 cursor-pointer rounded-xl bg-ink px-6 py-3 text-[14px] font-semibold text-white"
                >
                  Back to Dinezy
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
