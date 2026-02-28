/**
 * TONaRi Service Worker
 * PWAインストール要件を満たす最小限の実装。
 * オフライン対応は不要（AI APIとのリアルタイム通信が必須）。
 */

const CACHE_NAME = 'tonari-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // ネットワーク優先: オフラインキャッシュは行わない
  event.respondWith(fetch(event.request))
})
