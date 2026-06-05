// lib/resolve-image.ts
// Shared helper — converts a raw storage path or full URL into a public Supabase URL

const MENU_ASSET_BUCKET = 'restaurant-assets'

export function resolveMenuImageUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const value = raw.trim()
  if (!value) return ''
  // Already a full URL
  if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!supabaseUrl) return ''

  return `${supabaseUrl}/storage/v1/object/public/${MENU_ASSET_BUCKET}/${value.replace(/^\/+/, '')}`
}