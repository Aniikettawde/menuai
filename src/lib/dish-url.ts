/**
 * Canonical, SEO-readable URLs for public restaurant dishes.
 *
 * Canonical shape:
 *   /r/<restaurant-slug>/menu/<dish-slug>
 *
 * Legacy shape still accepted:
 *   /r/<restaurant-slug>/menu/<dish-slug>--<uuid>
 *
 * The public route should redirect legacy/non-canonical variants to the
 * single canonical URL so Google has one URL to index per dish.
 */

const MAX_DISH_SLUG_LENGTH = 90

export function slugifyDishName(name: string): string {
  const value = String(name ?? '')

  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_DISH_SLUG_LENGTH)
      .replace(/-+$/g, '') || 'dish'
  )
}

export function normalizePersistedDishSlug(slug: string | null | undefined): string {
  const value = typeof slug === 'string' ? slug.trim() : ''
  return value ? slugifyDishName(value) : ''
}

export type DishSlugSource = {
  id: string
  name: string
  slug?: string | null
}

/**
 * Build the exact same fallback slug map used by the public dish page and the
 * sitemap. This prevents a URL from being emitted in the sitemap that the
 * page route cannot resolve.
 *
 * Persisted slugs win. If two persisted slugs collide, the later item gets a
 * deterministic generated suffix rather than producing duplicate canonical
 * URLs. A unique index on (restaurant_id, slug) is still recommended.
 */
export function buildDishSlugMap<T extends DishSlugSource>(items: T[]): Map<string, string> {
  const counts = new Map<string, number>()
  const used = new Set<string>()
  const result = new Map<string, string>()

  for (const item of items) {
    const base = slugifyDishName(item.name)
    const nextCount = (counts.get(base) ?? 0) + 1
    counts.set(base, nextCount)

    const persisted = normalizePersistedDishSlug(item.slug)
    let candidate = persisted || (nextCount === 1 ? base : `${base}-${nextCount}`)

    if (used.has(candidate)) {
      let suffix = Math.max(2, nextCount)
      candidate = `${base}-${suffix}`
      while (used.has(candidate)) {
        suffix += 1
        candidate = `${base}-${suffix}`
      }
    }

    used.add(candidate)
    result.set(item.id, candidate)
  }

  return result
}

export function makeDishKey(
  name: string,
  _itemId?: string,
  persistedSlug?: string | null,
): string {
  return normalizePersistedDishSlug(persistedSlug) || slugifyDishName(name)
}

export type ParsedDishKey = {
  slug: string
  itemId?: string
  legacy: boolean
}

export function parseDishKey(
  dishKey: string | undefined | null,
): ParsedDishKey | null {
  if (typeof dishKey !== 'string' || !dishKey.trim()) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(dishKey).trim().toLowerCase()
  } catch {
    return null
  }

  if (!decoded) return null

  // Backwards compatibility with the previous UUID-suffixed public URL.
  // Example: latte--3d3c4f3a-1af1-4c53-8a23-0f9a5f5b1d19
  const marker = '--'
  const markerIndex = decoded.lastIndexOf(marker)

  if (markerIndex > 0 && markerIndex < decoded.length - marker.length) {
    const slug = decoded.slice(0, markerIndex)
    const itemId = decoded.slice(markerIndex + marker.length)

    if (
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)
    ) {
      return { slug, itemId, legacy: true }
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(decoded)) return null

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
