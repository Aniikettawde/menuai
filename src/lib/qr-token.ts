import { randomBytes } from 'crypto'



/**
 * Cryptographically secure token for the physical QR sticker.
 * 256 bits of entropy, base64url (~43 chars). Not brute-forceable,
 * not typeable-by-accident like the old 8-char RKDGV9WD scheme.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}