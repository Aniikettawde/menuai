// public/sw.js

const CACHE_VERSION = 'v2'
const STATIC_CACHE = `menuai-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `menuai-dynamic-${CACHE_VERSION}`

const PRECACHE_URLS = ['/']

// ─────────────────────────────────────────────
// Install
// ─────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS)
    })
  )

  self.skipWaiting()
})

// ─────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(
            key =>
              key !== STATIC_CACHE &&
              key !== DYNAMIC_CACHE
          )
          .map(key => caches.delete(key))
      )
    )
  )

  self.clients.claim()
})

// ─────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)

  // Only GET requests.
  if (request.method !== 'GET') return

  // Only same-origin.
  if (url.origin !== self.location.origin) return

  // ───────────────────────────────────────────
  // NEVER intercept Next.js RSC / prefetch
  // ───────────────────────────────────────────

  const isRscRequest =
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1' ||
    request.headers.has('Next-Router-State-Tree') ||
    request.headers.get('Purpose') === 'prefetch' ||
    request.headers.get('purpose') === 'prefetch' ||
    url.searchParams.has('_rsc')

  if (isRscRequest) {
    return
  }

  // ───────────────────────────────────────────
  // Never cache protected application areas
  // ───────────────────────────────────────────

  if (
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/partner')
  ) {
    return
  }

  // ───────────────────────────────────────────
  // API routes
  // ───────────────────────────────────────────

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()

            void caches
              .open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, clone))
              .catch(() => {})
          }

          return response
        })
        .catch(() => {
          return caches.match(request)
        })
    )

    return
  }

  // ───────────────────────────────────────────
  // Public restaurant pages
  // ───────────────────────────────────────────

  if (url.pathname.startsWith('/r/')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(async cache => {
        const cached = await cache.match(request)

        const networkPromise = fetch(request)
          .then(response => {
            if (response.ok) {
              void cache.put(
                request,
                response.clone()
              )
            }

            return response
          })
          .catch(() => null)

        return cached || networkPromise
      })
    )

    return
  }

  // ───────────────────────────────────────────
  // Public/static pages
  // ───────────────────────────────────────────

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached
      }

      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone()

          void caches
            .open(STATIC_CACHE)
            .then(cache => cache.put(request, clone))
            .catch(() => {})
        }

        return response
      })
    })
  )
})

// ─────────────────────────────────────────────
// Push notifications
// ─────────────────────────────────────────────

self.addEventListener('push', event => {
  let data = {}

  try {
    data = event.data?.json() ?? {}
  } catch {
    data = {
      title: 'New waiter request',
      body: event.data?.text() ?? '',
    }
  }

  const title =
    data.title ?? '🔔 New Table Request'

  const options = {
    body:
      data.body ??
      'A table is calling for a waiter.',

    icon: '/icon-192.png',
    badge: '/icon-192.png',

    tag:
      data.tag ??
      'waiter-request',

    renotify: true,
    requireInteraction: true,

    vibrate: [200, 100, 200],

    data: {
      url:
        data.url ??
        '/dashboard/orders',

      tableNumber:
        data.tableNumber,

      requestId:
        data.requestId,
    },

    actions: [
      {
        action: 'open',
        title: '✅ View order',
      },
      {
        action: 'dismiss',
        title: '✖ Dismiss',
      },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  )
})

// ─────────────────────────────────────────────
// Notification click
// ─────────────────────────────────────────────

self.addEventListener(
  'notificationclick',
  event => {
    event.notification.close()

    if (event.action === 'dismiss') {
      return
    }

    const targetUrl =
      event.notification.data?.url ??
      '/dashboard/orders'

    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then(windowClients => {
          for (const client of windowClients) {
            if (
              client.url.includes('/dashboard') &&
              'focus' in client
            ) {
              client.focus()
              client.navigate(targetUrl)
              return
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(targetUrl)
          }

          return undefined
        })
    )
  }
)