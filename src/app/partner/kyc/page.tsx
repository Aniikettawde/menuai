// src/app/partner/kyc/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import CameraCapture from '@/components/CameraCapture'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

export default function PartnerKycPage() {
  const router = useRouter()
  const supabase = getSupabaseDashboardBrowser()

  const [aadhaarFrontBlob, setAadhaarFrontBlob] = useState<Blob | null>(null)
  const [aadhaarBackBlob, setAadhaarBackBlob] = useState<Blob | null>(null)
  const [panBlob, setPanBlob] = useState<Blob | null>(null)
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const allCaptured = Boolean(
    aadhaarFrontBlob && aadhaarBackBlob && panBlob && selfieBlob,
  )

  async function handleSubmit() {
    if (!allCaptured) {
      setError('Please capture all four: Aadhaar (front & back), PAN, and a live selfie.')
      return
    }
    if (!confirmed) {
      setError('Please confirm your name matches your Aadhaar before submitting.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const formData = new FormData()
      formData.append('aadhaar_front', aadhaarFrontBlob!, 'aadhaar_front.jpg')
      formData.append('aadhaar_back', aadhaarBackBlob!, 'aadhaar_back.jpg')
      formData.append('pan', panBlob!, 'pan.jpg')
      formData.append('selfie', selfieBlob!, 'selfie.jpg')

      const res = await fetch('/api/partner/kyc/submit', {
        method: 'POST',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
        body: formData,
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error ?? 'Could not submit KYC. Please try again.')
      }

      router.push('/partner/dashboard?kyc=submitted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => router.push('/partner/dashboard')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={15} /> Back to dashboard
        </button>

        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
          <ShieldCheck size={22} />
        </div>

        <h1 className="text-2xl font-bold">Complete your KYC</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          To activate your partner account and receive commission payouts, verify your
          identity by capturing live photos of your Aadhaar (front and back), PAN, and a
          selfie below — no gallery uploads, photos must be taken live.
        </p>

        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300">
          <strong>Important:</strong> The name on your Dinezy Partner account must exactly
          match the name printed on your Aadhaar card, or your KYC will be rejected.
        </div>

        <div className="mt-6 space-y-4">
          <CameraCapture
            label="Aadhaar card — front"
            hint="Hold the front side flat and ensure your photo, name and number are clearly visible."
            facingMode="environment"
            captured={Boolean(aadhaarFrontBlob)}
            onCapture={setAadhaarFrontBlob}
            onRetake={() => setAadhaarFrontBlob(null)}
          />

          <CameraCapture
            label="Aadhaar card — back"
            hint="Flip it over and capture the back side with your address clearly visible."
            facingMode="environment"
            captured={Boolean(aadhaarBackBlob)}
            onCapture={setAadhaarBackBlob}
            onRetake={() => setAadhaarBackBlob(null)}
          />

          <CameraCapture
            label="PAN card"
            hint="Hold your PAN flat and ensure the name and number are clearly visible."
            facingMode="environment"
            captured={Boolean(panBlob)}
            onCapture={setPanBlob}
            onRetake={() => setPanBlob(null)}
          />

          <CameraCapture
            label="Live selfie"
            hint="Face the camera directly in good lighting."
            facingMode="user"
            captured={Boolean(selfieBlob)}
            onCapture={setSelfieBlob}
            onRetake={() => setSelfieBlob(null)}
          />
        </div>

        <label className="mt-6 flex items-start gap-2.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-orange-500"
          />
          I confirm the name on my Dinezy Partner account matches my Aadhaar card exactly.
        </label>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !allCaptured || !confirmed}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          Submit for verification
        </button>
      </div>
    </main>
  )
}