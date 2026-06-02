// lib/cache.ts
// IndexedDB-based offline cache using the 'idb' library
// Stores: menu data, chat history, pending analytics events
import { openDB, IDBPDatabase } from 'idb'
import type { MenuPageData, AnalyticsEvent } from '@/types'

const DB_NAME = 'menuai-cache'
const DB_VERSION = 1

// Store names
const STORES = {
  MENU: 'menu',                 // restaurant menu data
  ANALYTICS_QUEUE: 'analytics_queue',  // events to flush when online
}

let db: IDBPDatabase | null = null

async function getDB() {
  if (db) return db
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Menu store: key = restaurant slug
      if (!database.objectStoreNames.contains(STORES.MENU)) {
        const menuStore = database.createObjectStore(STORES.MENU, { keyPath: 'slug' })
        menuStore.createIndex('expires_at', 'expires_at')
      }
      // Analytics queue: auto-increment key
      if (!database.objectStoreNames.contains(STORES.ANALYTICS_QUEUE)) {
        database.createObjectStore(STORES.ANALYTICS_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        })
      }
    },
  })
  return db
}

// ── Menu Cache ──────────────────────────────────────────────

const MENU_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function getCachedMenu(slug: string): Promise<MenuPageData | null> {
  try {
    const database = await getDB()
    const cached = await database.get(STORES.MENU, slug)
    if (!cached) return null
    // Check TTL
    if (Date.now() > cached.expires_at) {
      await database.delete(STORES.MENU, slug)
      return null
    }
    return cached.data as MenuPageData
  } catch {
    return null
  }
}

export async function setCachedMenu(slug: string, data: MenuPageData): Promise<void> {
  try {
    const database = await getDB()
    await database.put(STORES.MENU, {
      slug,
      data,
      expires_at: Date.now() + MENU_TTL_MS,
      cached_at: Date.now(),
    })
  } catch {
    // Cache write failure is non-fatal
  }
}

// ── Analytics Queue (offline buffering) ─────────────────────

export async function queueAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const database = await getDB()
    await database.add(STORES.ANALYTICS_QUEUE, event)
  } catch {
    // Non-fatal
  }
}

export async function flushAnalyticsQueue(): Promise<AnalyticsEvent[]> {
  try {
    const database = await getDB()
    const events = await database.getAll(STORES.ANALYTICS_QUEUE)
    if (events.length > 0) {
      // Clear the queue
      const tx = database.transaction(STORES.ANALYTICS_QUEUE, 'readwrite')
      await tx.store.clear()
      await tx.done
    }
    return events
  } catch {
    return []
  }
}
