'use client'

import Link from 'next/link'
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Loader2,
  Mail,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react'
import {
  signInWithWhatsAppToken,
  clearRecaptcha,
  prepareRecaptcha,
} from '@/lib/firebase'

type Step =
  | 'details'
  | 'whatsapp'
  | 'email'
  | 'success'

type FieldName =
  | 'fullName'
  | 'city'
  | 'whatsapp'
  | 'email'
  | 'password'
  | 'confirmPassword'

type FieldErrors = Partial<
  Record<FieldName, string>
>

function normalizeIndianPhone(
  phone: string,
) {
  const digits = phone.replace(
    /\D/g,
    '',
  )

  if (digits.length === 10) {
    return `+91${digits}`
  }

  if (
    digits.length === 12 &&
    digits.startsWith('91')
  ) {
    return `+${digits}`
  }

  return `+91${digits}`
}

function formatPhone(phone: string) {
  const digits = phone
    .replace(/\D/g, '')
    .slice(-10)

  return digits.length === 10
    ? `${digits.slice(0, 5)} ${digits.slice(5)}`
    : phone
}

export default function PartnerSignupPage() {
  const [step, setStep] =
    useState<Step>('details')

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [fieldErrors, setFieldErrors] =
    useState<FieldErrors>({})

  const [fullName, setFullName] =
    useState('')

  const [city, setCity] =
    useState('')

  const [whatsapp, setWhatsapp] =
    useState('')

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('')

  const [whatsappOtp, setWhatsappOtp] =
    useState('')

  const [emailOtp, setEmailOtp] =
    useState('')

  const [
    resendSeconds,
    setResendSeconds,
  ] = useState(0)

  const [
    phoneVerificationId,
    setPhoneVerificationId,
  ] = useState('')

  const [
    emailVerificationId,
    setEmailVerificationId,
  ] = useState('')

  const [
    createdPartnerId,
    setCreatedPartnerId,
  ] = useState('')

  const [signupCreated, setSignupCreated] =
    useState(false)

  const timerRef =
    useState<
      ReturnType<typeof setInterval> | null
    >(null)[0]

  const [timerHandle, setTimerHandle] =
    useState<ReturnType<
      typeof setInterval
    > | null>(null)

  const progress = useMemo(() => {
    switch (step) {
      case 'details':
        return 25
      case 'whatsapp':
        return 50
      case 'email':
        return 75
      case 'success':
        return 100
    }
  }, [step])

  useEffect(() => {
    void prepareRecaptcha(
      'partner-recaptcha-container',
    ).catch(() => undefined)

    return () => {
      if (timerHandle) {
        clearInterval(timerHandle)
      }

      clearRecaptcha(
        'partner-recaptcha-container',
      )
    }
  }, [timerHandle])

  function startTimer(
    seconds = 30,
  ) {
    if (timerHandle) {
      clearInterval(timerHandle)
    }

    setResendSeconds(seconds)

    const handle =
      setInterval(() => {
        setResendSeconds(
          (value) => {
            if (value <= 1) {
              clearInterval(handle)
              return 0
            }

            return value - 1
          },
        )
      }, 1000)

    setTimerHandle(handle)
  }

  function validateDetails() {
    const errors: FieldErrors = {}

    if (
      fullName.trim().length < 2
    ) {
      errors.fullName =
        'Enter your full name'
    }

    if (city.trim().length < 2) {
      errors.city =
        'Enter your city'
    }

    if (
      whatsapp.replace(
        /\D/g,
        '',
      ).length !== 10
    ) {
      errors.whatsapp =
        'Enter a valid 10-digit WhatsApp number'
    }

    if (
      !/^\S+@\S+\.\S+$/.test(
        email.trim(),
      )
    ) {
      errors.email =
        'Enter a valid email address'
    }

    if (password.length < 8) {
      errors.password =
        'Use at least 8 characters'
    }

    if (
      confirmPassword !== password
    ) {
      errors.confirmPassword =
        'Passwords do not match'
    }

    setFieldErrors(errors)

    return (
      Object.keys(errors)
        .length === 0
    )
  }

  async function sendWhatsappCode() {
    if (!validateDetails()) {
      return
    }

    setError('')
    setLoading(true)

    try {
      const cleaned =
        whatsapp.replace(
          /\D/g,
          '',
        )

      const response =
        await fetch(
          '/api/auth/whatsapp-otp/send',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              phone: cleaned,
              purpose:
                'partner_signup',
            }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to send WhatsApp code',
        )
      }

      setStep('whatsapp')
      startTimer()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send WhatsApp code',
      )
    } finally {
      setLoading(false)
    }
  }

  async function verifyWhatsappCode() {
    const code =
      whatsappOtp
        .replace(/\D/g, '')
        .slice(0, 6)

    if (code.length !== 6) {
      setError(
        'Enter the 6-digit WhatsApp OTP',
      )
      return
    }

    setError('')
    setLoading(true)

    try {
      const response =
        await fetch(
          '/api/auth/whatsapp-otp/verify',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              phone:
                whatsapp.replace(
                  /\D/g,
                  '',
                ),
              code,
              purpose:
                'partner_signup',
            }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Incorrect OTP',
        )
      }

      if (!data.verificationId) {
        throw new Error(
          'WhatsApp verification completed, but verification could not be recorded.',
        )
      }

      await signInWithWhatsAppToken(
        data.customToken,
      )

      setPhoneVerificationId(
        data.verificationId,
      )

      setStep('email')

      await sendEmailCode()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Incorrect OTP. Please try again.',
      )

      setWhatsappOtp('')
    } finally {
      setLoading(false)
    }
  }

  async function sendEmailCode() {
    setError('')

    const response =
      await fetch(
        '/api/auth/partner/email/send',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            email:
              email
                .trim()
                .toLowerCase(),
            fullName:
              fullName.trim(),
          }),
        },
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ||
          'Unable to send email verification code',
      )
    }

    setEmailVerificationId(
      data.verificationId,
    )

    startTimer()
  }

  async function verifyEmailCode() {
    const code =
      emailOtp
        .replace(/\D/g, '')
        .slice(0, 6)

    if (code.length !== 6) {
      setError(
        'Enter the 6-digit email OTP',
      )
      return
    }

    if (!emailVerificationId) {
      setError(
        'Your email verification session has expired. Please request a new code.',
      )
      return
    }

    setError('')
    setLoading(true)

    try {
      const response =
        await fetch(
          '/api/auth/partner/email/verify',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              verificationId:
                emailVerificationId,
              code,
            }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Incorrect email code',
        )
      }

      await createPartner(
        data.verificationId,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Incorrect email code',
      )

      setEmailOtp('')
    } finally {
      setLoading(false)
    }
  }

  async function createPartner(
    verifiedEmailId: string,
  ) {
    const response =
      await fetch(
        '/api/auth/partner/register',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            fullName:
              fullName.trim(),

            city:
              city.trim(),

            whatsapp:
              normalizeIndianPhone(
                whatsapp,
              ),

            email:
              email
                .trim()
                .toLowerCase(),

            password,
            confirmPassword,

            phoneVerificationId,
            emailVerificationId:
              verifiedEmailId,
          }),
        },
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ||
          'Unable to create partner account',
      )
    }

    setCreatedPartnerId(
      data.partner?.id ||
        data.partnerId ||
        '',
    )

    setSignupCreated(true)
    setStep('success')
  }

  async function submitDetails(
    event: FormEvent,
  ) {
    event.preventDefault()
    await sendWhatsappCode()
  }

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-[#2B2118]">
      <div
        id="partner-recaptcha-container"
        className="pointer-events-none absolute opacity-0"
      />

      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[0.85fr_1.15fr]">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden bg-[#7A2333] p-10 text-[#FBF6EC] lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link
              href="/"
              className="text-2xl"
              style={{
                fontFamily:
                  'var(--font-fraunces, Georgia, serif)',
              }}
            >
              Dinezy
            </Link>

            <div className="mt-24 max-w-md">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                Partner program
              </p>

              <h1
                className="mt-4 text-5xl leading-[1.02] tracking-[-0.045em]"
                style={{
                  fontFamily:
                    'var(--font-fraunces, Georgia, serif)',
                }}
              >
                Find restaurants.
                <br />
                Set them up.
                <br />
                Get paid.
              </h1>

              <p className="mt-6 text-base leading-7 text-white/70">
                Become a Dinezy sales and
                onboarding partner. Build
                restaurant relationships,
                handle setup and earn on
                successful customers.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-white/70">
            {[
              'Find restaurants in your network',
              'Handle the setup from one workspace',
              'Track restaurants and commission',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C98A3E]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <section className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-14">
          <div className="w-full max-w-xl">
            <div className="flex items-center justify-between">
              <Link
                href="/partner"
                className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-black"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>

              <span className="text-xs text-black/40">
                Step{' '}
                {step === 'details'
                  ? 1
                  : step === 'whatsapp'
                    ? 2
                    : step === 'email'
                      ? 3
                      : 4}{' '}
                of 4
              </span>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-[#7A2333] transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            {/* DETAILS */}
            {step === 'details' && (
              <form
                onSubmit={submitDetails}
                className="mt-10"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A2333]">
                  Become a partner
                </p>

                <h2
                  className="mt-3 text-3xl tracking-[-0.04em] sm:text-4xl"
                  style={{
                    fontFamily:
                      'var(--font-fraunces, Georgia, serif)',
                  }}
                >
                  Create your partner account.
                </h2>

                <p className="mt-3 text-sm leading-6 text-black/55">
                  We'll verify your WhatsApp
                  number and email before
                  creating your account.
                </p>

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    value={fullName}
                    onChange={
                      setFullName
                    }
                    placeholder="Your full name"
                    error={
                      fieldErrors.fullName
                    }
                  />

                  <Field
                    label="City"
                    value={city}
                    onChange={setCity}
                    placeholder="Mumbai"
                    error={
                      fieldErrors.city
                    }
                  />
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field
                    label="WhatsApp number"
                    value={whatsapp}
                    onChange={(value) =>
                      setWhatsapp(
                        value
                          .replace(
                            /\D/g,
                            '',
                          )
                          .slice(
                            0,
                            10,
                          ),
                      )
                    }
                    placeholder="98765 43210"
                    type="tel"
                    prefix="+91"
                    error={
                      fieldErrors.whatsapp
                    }
                  />

                  <Field
                    label="Email address"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    type="email"
                    error={
                      fieldErrors.email
                    }
                  />
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Password"
                    value={password}
                    onChange={
                      setPassword
                    }
                    placeholder="At least 8 characters"
                    type="password"
                    error={
                      fieldErrors.password
                    }
                  />

                  <Field
                    label="Confirm password"
                    value={
                      confirmPassword
                    }
                    onChange={
                      setConfirmPassword
                    }
                    placeholder="Re-enter password"
                    type="password"
                    error={
                      fieldErrors.confirmPassword
                    }
                  />
                </div>

                {error && (
                  <ErrorText>
                    {error}
                  </ErrorText>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#7A2333] text-sm font-semibold text-white transition hover:bg-[#651d2b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending verification…
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="mt-5 text-center text-xs text-black/45">
                  Already have a partner
                  account?{' '}
                  <Link
                    href="/partner/login"
                    className="font-semibold text-[#7A2333]"
                  >
                    Sign in
                  </Link>
                </p>
              </form>
            )}

            {/* WHATSAPP */}
            {step === 'whatsapp' && (
              <VerificationStep
                icon={
                  <MessageCircle className="h-5 w-5" />
                }
                eyebrow="WhatsApp verification"
                title="Verify your WhatsApp number."
                description={
                  <>
                    We sent a 6-digit
                    code to{' '}
                    <strong>
                      +91{' '}
                      {formatPhone(
                        whatsapp,
                      )}
                    </strong>
                    .
                  </>
                }
                value={whatsappOtp}
                onChange={
                  setWhatsappOtp
                }
                onSubmit={() =>
                  void verifyWhatsappCode()
                }
                onResend={() =>
                  void sendWhatsappCode()
                }
                resendSeconds={
                  resendSeconds
                }
                loading={loading}
                error={error}
                back={() => {
                  setStep(
                    'details',
                  )
                  setError('')
                  setWhatsappOtp(
                    '',
                  )
                }}
              />
            )}

            {/* EMAIL */}
            {step === 'email' && (
              <VerificationStep
                icon={
                  <Mail className="h-5 w-5" />
                }
                eyebrow="Email verification"
                title="Verify your email."
                description={
                  <>
                    We sent a 6-digit
                    code to{' '}
                    <strong>
                      {email}
                    </strong>
                    .
                  </>
                }
                value={emailOtp}
                onChange={setEmailOtp}
                onSubmit={() =>
                  void verifyEmailCode()
                }
                onResend={() =>
                  void sendEmailCode()
                }
                resendSeconds={
                  resendSeconds
                }
                loading={loading}
                error={error}
                back={() => {
                  setStep(
                    'whatsapp',
                  )
                  setError('')
                  setEmailOtp('')
                }}
                fallback={
                  <span className="text-xs text-black/40">
                    Check spam or
                    promotions if you
                    don't see it.
                  </span>
                }
              />
            )}

            {/* SUCCESS */}
            {step === 'success' && (
              <div className="mt-20 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F1E4E6] text-[#7A2333]">
                  <ShieldCheck className="h-8 w-8" />
                </div>

                <h2
                  className="mt-6 text-4xl tracking-[-0.04em]"
                  style={{
                    fontFamily:
                      'var(--font-fraunces, Georgia, serif)',
                  }}
                >
                  Welcome to Dinezy.
                </h2>

                <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-black/55">
                  Your partner account
                  is ready. Start
                  onboarding your first
                  restaurant from your
                  partner dashboard.
                </p>

                <Link
                  href="/partner/dashboard"
                  className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#7A2333] px-6 text-sm font-semibold text-white"
                >
                  Go to partner
                  dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {signupCreated &&
                  createdPartnerId && (
                    <p className="mt-4 text-[11px] text-black/30">
                      Partner ID:{' '}
                      {
                        createdPartnerId
                      }
                    </p>
                  )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  prefix,
  error,
}: {
  label: string
  value: string
  onChange: (
    value: string,
  ) => void
  placeholder: string
  type?: string
  prefix?: string
  error?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/65">
        {label}
      </span>

      <div
        className={`mt-2 flex overflow-hidden rounded-2xl border bg-white/55 transition ${
          error
            ? 'border-red-300'
            : 'border-black/10 focus-within:border-[#7A2333]'
        }`}
      >
        {prefix && (
          <span className="flex items-center border-r border-black/10 px-4 text-sm font-medium text-black/45">
            {prefix}
          </span>
        )}

        <input
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value,
            )
          }
          placeholder={
            placeholder
          }
          type={type}
          autoComplete={
            type === 'password'
              ? 'new-password'
              : type === 'email'
                ? 'email'
                : 'off'
          }
          className="h-13 min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-black/25"
        />
      </div>

      {error && (
        <span className="mt-1.5 block text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  )
}

function VerificationStep({
  icon,
  eyebrow,
  title,
  description,
  value,
  onChange,
  onSubmit,
  onResend,
  resendSeconds,
  loading,
  error,
  fallback,
  back,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  description: React.ReactNode
  value: string
  onChange: (
    value: string,
  ) => void
  onSubmit: () => void
  onResend: () => void
  resendSeconds: number
  loading: boolean
  error: string
  fallback?: React.ReactNode
  back: () => void
}) {
  return (
    <div className="mt-16">
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/40 hover:text-black"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1E4E6] text-[#7A2333]">
        {icon}
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#7A2333]">
        {eyebrow}
      </p>

      <h2
        className="mt-3 text-3xl tracking-[-0.04em] sm:text-4xl"
        style={{
          fontFamily:
            'var(--font-fraunces, Georgia, serif)',
        }}
      >
        {title}
      </h2>

      <p className="mt-3 text-sm leading-6 text-black/55">
        {description}
      </p>

      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
              .replace(
                /\D/g,
                '',
              )
              .slice(
                0,
                6,
              ),
          )
        }
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            value.length === 6
          ) {
            onSubmit()
          }
        }}
        placeholder="• • • • • •"
        className="mt-8 h-16 w-full rounded-2xl border border-black/10 bg-white text-center text-2xl font-bold tracking-[0.42em] outline-none focus:border-[#7A2333]"
      />

      {error && (
        <ErrorText>
          {error}
        </ErrorText>
      )}

      <button
        type="button"
        disabled={
          loading ||
          value.length !== 6
        }
        onClick={onSubmit}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#7A2333] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            Verify & continue
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="mt-5 text-center text-xs text-black/40">
        {resendSeconds > 0 ? (
          `Resend in ${resendSeconds}s`
        ) : (
          <button
            type="button"
            onClick={onResend}
            className="font-semibold text-[#7A2333]"
          >
            Resend code
          </button>
        )}
      </div>

      {fallback && (
        <div className="mt-4 text-center">
          {fallback}
        </div>
      )}
    </div>
  )
}

function ErrorText({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
      {children}
    </p>
  )
}