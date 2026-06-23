import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const auth: Auth = getAuth(app)

let recaptchaVerifier: RecaptchaVerifier | null = null
let recaptchaRenderPromise: Promise<number> | null = null

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (phone.startsWith('+')) {
    return phone
  }

  if (digits.length === 10) {
    return `+91${digits}`
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`
  }

  return `+91${digits}`
}

export async function prepareRecaptcha(containerId: string): Promise<RecaptchaVerifier> {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA can only run in the browser')
  }

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    })
    recaptchaRenderPromise = recaptchaVerifier.render()
  }

  if (recaptchaRenderPromise) {
    await recaptchaRenderPromise
  }

  return recaptchaVerifier
}

export function clearRecaptcha(containerId: string): void {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear()
    } catch {
      // ignore
    }
  }

  recaptchaVerifier = null
  recaptchaRenderPromise = null

  if (typeof window !== 'undefined') {
    const el = document.getElementById(containerId)
    if (el) el.innerHTML = ''
  }
}

export async function sendOTP(
  phone: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const verifier = await prepareRecaptcha(containerId)
  const normalised = normalisePhone(phone)

  try {
    return await signInWithPhoneNumber(auth, normalised, verifier)
  } catch (err) {
    clearRecaptcha(containerId)
    throw err
  }
}

export async function verifyOTP(
  confirmation: ConfirmationResult,
  code: string,
): Promise<{ uid: string; phone: string | null }> {
  const result = await confirmation.confirm(code)
  return {
    uid: result.user.uid,
    phone: result.user.phoneNumber,
  }
}