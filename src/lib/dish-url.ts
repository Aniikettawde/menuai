/**
 * Public, SEO-readable dish URLs.
 *
 * New canonical URL:
 *   /r/<restaurant>/menu/<dish-slug>
 *
 * We still accept the old UUID-suffixed URL shape so old links can be
 * redirected to the clean canonical URL by the dish page.
 */
export function slugifyDishName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'dish'
}

export function makeDishKey(
  name: string,
  _itemId?: string,
  persistedSlug?: string | null,
): string {
  const slug = persistedSlug?.trim() || slugifyDishName(name)
  return slug
}

export type ParsedDishKey = {
  slug: string
  itemId?: string
  legacy: boolean
}

export function parseDishKey(
  dishKey: string | undefined | null,
): ParsedDishKey | null {
  if (typeof dishKey !== 'string' || !dishKey.trim()) {
    return null
  }

  const decoded = decodeURIComponent(dishKey).trim().toLowerCase()
  if (!decoded) return null

  // Backwards compatibility for the previous public URL format:
  //   latte--uuid
  const marker = '--'
  const index = decoded.lastIndexOf(marker)

  if (index > 0 && index < decoded.length - marker.length) {
    const slug = decoded.slice(0, index)
    const itemId = decoded.slice(index + marker.length)

    if (
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)
    ) {
      return {
        slug,
        itemId,
        legacy: true,
      }
    }
  }

  // Canonical clean URL.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(decoded)) {
    return null
  }

  return {
    slug: decoded,
    legacy: false,
  }
}

export function buildDishPath(
  restaurantSlug: string,
  itemName: string,
  itemId?: string,
  persistedSlug?: string | null,
): string {
  const dishSlug = makeDishKey(itemName, itemId, persistedSlug)
  return `/r/${encodeURIComponent(restaurantSlug)}/menu/${encodeURIComponent(dishSlug)}`
}
