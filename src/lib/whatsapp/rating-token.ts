import crypto from 'crypto'

// Set this in your env — reuse a dedicated secret, don't reuse Supabase/Firebase keys.
const SECRET = process.env.RATING_TOKEN_SECRET!

export interface RatingTokenPayload {
  restaurantId: string
  orderId?: string | null
  orderCode?: string | null
  tableNumber?: number | null
  customerPhone?: string | null // E.164, e.g. 9198xxxxxxx — used for dedupe
  exp: number // unix seconds
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlDecode(input: string) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64').toString('utf8')
}

/** Creates a compact, URL-safe signed token: base64url(payload).base64url(hmac) */
export function signRatingToken(payload: Omit<RatingTokenPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 3) {
  const full: RatingTokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const json = JSON.stringify(full)
  const sig = crypto.createHmac('sha256', SECRET).update(json).digest()
  return `${base64url(json)}.${base64url(sig)}`
}

/** Verifies + decodes a token. Returns null if invalid, tampered, or expired. */
export function verifyRatingToken(token: string): RatingTokenPayload | null {
  try {
    const [payloadPart, sigPart] = token.split('.')
    if (!payloadPart || !sigPart) return null

    const json = base64urlDecode(payloadPart)
    const expectedSig = base64url(crypto.createHmac('sha256', SECRET).update(json).digest())

    // constant-time compare
    const a = Buffer.from(sigPart)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    const payload = JSON.parse(json) as RatingTokenPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}