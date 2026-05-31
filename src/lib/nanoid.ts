// lib/nanoid.ts — minimal ID generator (no extra dependency needed)
export function nanoid(size = 21): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, size)
  }
  return Math.random().toString(36).slice(2, size + 2)
}
