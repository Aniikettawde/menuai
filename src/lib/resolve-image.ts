// lib/resolve-image.ts

// Shared helper — converts a raw storage path or full URL
// into a Cloudflare-optimized image URL in production.

const MENU_ASSET_BUCKET = 'restaurant-assets'

export function resolveMenuImageUrl(raw: unknown, width = 400): string {
  if (typeof raw !== 'string') return ''

  const value = raw.trim()

  if (!value) return ''

  // Already a full URL, data URL, or blob URL.
  if (/^(https?:\/\/|data:|blob:)/i.test(value)) {
    return value
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')

  if (!supabaseUrl) return ''

  // Stored value is only the Supabase Storage path.
  // Example:
  // user-id/items/123-chicken.webp
  const storagePath = value.replace(/^\/+/, '')

  // Original image in Supabase Storage.
  const originalUrl =
    `${supabaseUrl}/storage/v1/object/public/${MENU_ASSET_BUCKET}/${storagePath}`

  // During local development, use the original Supabase image.
  // This avoids depending on Cloudflare's /cdn-cgi/image endpoint
  // when running `npm run dev`.
  if (process.env.NODE_ENV !== 'production') {
    return originalUrl
  }

  // Production:
  // Cloudflare performs the resize/quality/format optimization.
  //
  // Example result:
  // /cdn-cgi/image/width=400,quality=60,format=auto,fit=scale-down/https://xxx.supabase.co/...
  const options = [
    `width=${width}`,
    'quality=60',
    'format=auto',
    'fit=scale-down',
  ].join(',')

  return `/cdn-cgi/image/${options}/${originalUrl}`
}