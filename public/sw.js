// Service Worker for Web Push notifications

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'TONaRi', body: event.data.text() }
  }

  const { title, body, url } = data
  const options = {
    body: body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title || 'TONaRi', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        return self.clients.openWindow(targetUrl)
      })
  )
})
