// public/sw.js
// Service Worker — caches static assets and API responses for offline use
const CACHE_VERSION = 'v1'
const STATIC_CACHE = `menuai-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `menuai-dynamic-${CACHE_VERSION}`
// Assets to precache on install
const PRECACHE_URLS = [
  '/',
]
// ── Install: precache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})
// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})
// ── Fetch: cache-first for static, network-first for API ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET') return
  if (!url.origin.includes(self.location.origin)) return
  // API routes: network-first, fallback to cached
  if (url.pathname.startsWith('/api/')) {
    // Analytics: fire and forget, don't cache
    if (url.pathname.startsWith('/api/analytics')) return
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }
  // Restaurant pages: stale-while-revalidate
  if (url.pathname.startsWith('/r/')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(async cache => {
        const cached = await cache.match(event.request)
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone())
          return response
        })
        return cached || fetchPromise
      })
    )
    return
  }
  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})

// ── Push: show notification when server sends a push ──
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'New waiter request', body: event.data?.text() ?? '' }
  }

  const title = data.title ?? '🔔 New Table Request'
  const options = {
    body: data.body ?? 'A table is calling for a waiter.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag ?? 'waiter-request',   // replaces previous notification with same tag
    renotify: true,                       // vibrate/sound even if same tag
    requireInteraction: true,             // stays until dismissed (desktop)
    vibrate: [200, 100, 200],
    data: {
      url: data.url ?? '/dashboard/orders',
      tableNumber: data.tableNumber,
      requestId: data.requestId,
    },
    actions: [
      { action: 'open',    title: '✅ View order' },
      { action: 'dismiss', title: '✖ Dismiss' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click: focus existing tab or open new one ──
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url ?? '/dashboard/orders'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            client.focus()
            client.navigate(targetUrl)
            return
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl)
      })
  )
})