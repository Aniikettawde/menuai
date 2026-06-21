import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Singleton — avoid duplicate app init in hot-reload / Strict Mode
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth: Auth = getAuth(app)

// ─── reCAPTCHA ────────────────────────────────────────────────────────────────

let recaptchaVerifier: RecaptchaVerifier | null = null

export function getRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear() } catch {}
    recaptchaVerifier = null
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
  return recaptchaVerifier
}

export async function sendOTP(
  phone: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const verifier = getRecaptchaVerifier(containerId)
  // Normalise: ensure +91 prefix for Indian numbers
  const normalised =
    phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`
  return signInWithPhoneNumber(auth, normalised, verifier)
}

export async function verifyOTP(
  confirmation: ConfirmationResult,
  code: string,
): Promise<{ uid: string; phone: string | null }> {
  const result = await confirmation.confirm(code)
  return {
    uid:   result.user.uid,
    phone: result.user.phoneNumber,
  }
}