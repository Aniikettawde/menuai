import crypto from 'crypto'

export function generateOtp(length = 6): string {
  const min = 10 ** (length - 1)
  const max = 10 ** length - 1
  return Math.floor(min + Math.random() * (max - min + 1)).toString()
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

export function safeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)

  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}