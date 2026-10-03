import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createFirebaseCustomToken } from '@/lib/firebase-admin'

export const WHATSAPP_AUTH_TTL_SECONDS = 5 * 60

export function createWhatsAppAuthToken(): string {
  return randomBytes(18).toString('base64url')
}

export function hashWhatsAppAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeWhatsAppId(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCustomerPhoneFromWhatsAppId(waId: string): string {
  return `+${normalizeWhatsAppId(waId)}`
}

export function buildWhatsAppOfferUrl(args: {
  businessNumber: string
  restaurantName: string
  token: string
}): string {
  const businessNumber = normalizeWhatsAppId(args.businessNumber)
  if (!businessNumber) {
    throw new Error('WHATSAPP_BUSINESS_NUMBER is not configured')
  }

  const message = [
    'Hi Dinezy 👋',
    '',
    `Show me the offers at ${args.restaurantName}.`,
    '',
    `DZYREF:${args.token}`,
  ].join('\n')

  return `https://wa.me/${businessNumber}?text=${encodeURIComponent(message)}`
}

export async function getFirebaseUidForWhatsApp(waId: string): Promise<{
  uid: string
  phone: string
  customerId: string | null
}> {
  const cleanedWaId = normalizeWhatsAppId(waId)
  if (!cleanedWaId) {
    throw new Error('Invalid WhatsApp ID')
  }

  const phone = formatCustomerPhoneFromWhatsAppId(cleanedWaId)

  // IMPORTANT: preserve the existing Firebase identity when a customer
  // originally signed up through SMS/WhatsApp OTP. This is what keeps repeat
  // customers tied to the same Dinezy customer row.
  const { data: existingCustomer, error } = await supabaseAdmin
    .from('customers')
    .select('id, firebase_uid, phone')
    .eq('phone', phone)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[whatsapp-auth] customer lookup failed', error)
    throw new Error('Could not resolve customer identity')
  }

  return {
    uid: existingCustomer?.firebase_uid || `whatsapp:${cleanedWaId}`,
    phone,
    customerId: existingCustomer?.id ?? null,
  }
}

export async function mintFirebaseTokenForWhatsApp(waId: string): Promise<{
  customToken: string
  uid: string
  phone: string
  customerId: string | null
}> {
  const identity = await getFirebaseUidForWhatsApp(waId)
  const customToken = await createFirebaseCustomToken(identity.uid)

  return {
    customToken,
    uid: identity.uid,
    phone: identity.phone,
    customerId: identity.customerId,
  }
}
