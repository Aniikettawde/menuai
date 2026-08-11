import crypto from 'crypto'

/** Verifies Meta WhatsApp Cloud API X-Hub-Signature-256 for a raw POST body. */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false

  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const received = signatureHeader.slice('sha256='.length)

  if (expected.length !== received.length) return false

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'))
  } catch {
    return false
  }
}
