// ═══════════════════════════════════════════════════════════════════
//  SEIZURRE — Service Worker
//  © 2026 Stephanie Adams. Personal use only.
// ═══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'seizurre-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-512.png'
];

// Install: pre-cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS).catch(err => console.warn('[SW] Pre-cache warning:', err))
    )
  );
  // Don't skip waiting here — let the app show update banner instead
});

// Activate: delete old caches, take control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => clients.claim())
  );
});

// Fetch: cache-first for assets, network-first for navigate
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations (so updates propagate)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);
    })
  );
});

// Messages from app
self.addEventListener('message', event => {
  if (!event.data) return;

  // App tells SW to activate immediately after update
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Fire a manual notification (legacy use)
  if (event.data.type === 'FIRE_REMINDER') {
    event.waitUntil(
      self.registration.showNotification(event.data.title || 'Seizurre', {
        body:            event.data.body || '',
        icon:            '/icon-512.png',
        badge:           '/icon-512.png',
        vibrate:         [200, 100, 200],
        tag:             event.data.tag || 'seizurre-alert',
        requireInteraction: false
      })
    );
  }

  // Schedule weekly backup reminder (7 days from now)
  if (event.data.type === 'SCHEDULE_BACKUP_REMINDER') {
    // We can't do setTimeout in SW reliably, so we fire once immediately
    // and rely on the app-side nag for weekly checks.
    event.waitUntil(
      self.registration.showNotification('Seizurre — Backup Reminder', {
        body:    'Time to export a backup of your diary! Open the app and tap Export.',
        icon:    '/icon-512.png',
        badge:   '/icon-512.png',
        vibrate: [200, 100, 200],
        tag:     'seizurre-backup',
        requireInteraction: true
      })
    );
  }
});

// Notification click: focus or open app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
