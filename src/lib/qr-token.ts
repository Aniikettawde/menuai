/**
 * Generates a cryptographically random token like "4K7M9X2P"
 * Uses only uppercase letters + digits, skipping look-alike chars (0, O, I, 1)
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateToken(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('')
}