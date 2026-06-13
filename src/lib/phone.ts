export function normalizePhoneToWhatsapp(phone: string): string {
  const cleaned = phone.trim().replace(/\s+/g, '')

  if (!cleaned) {
    throw new Error('Phone number is required')
  }

  // Accept +91XXXXXXXXXX or 91XXXXXXXXXX or local 10-digit Indian numbers
  if (cleaned.startsWith('+')) {
    return `whatsapp:${cleaned}`
  }

  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `whatsapp:+${cleaned}`
  }

  if (/^\d{10}$/.test(cleaned)) {
    return `whatsapp:+91${cleaned}`
  }

  throw new Error('Enter a valid phone number in international format')
}