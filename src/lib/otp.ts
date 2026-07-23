// src/lib/otp.ts
import crypto from 'crypto'

// Add OTP_HASH_SECRET to your .env — any long random string, e.g.:
//   openssl rand -hex 32
const OTP_SECRET = process.env.OTP_HASH_SECRET

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

export function hashOtp(phone: string, code: string): string {
  if (!OTP_SECRET) {
    throw new Error('OTP_HASH_SECRET env var is not set')
  }
  return crypto.createHmac('sha256', OTP_SECRET).update(`${phone}:${code}`).digest('hex')
}

/**
 * Normalises any Indian phone input (10-digit, or with +91/91 prefix) to a
 * plain "91XXXXXXXXXX" digits-only string — used as the canonical key for
 * otp_codes.phone and as the WhatsApp "to" field.
 */
export function normalisePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits
}