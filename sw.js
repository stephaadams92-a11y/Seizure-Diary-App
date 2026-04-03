// Seizure Diary App — Service Worker
const CACHE_NAME = 'seizure-diary-v2'; // Incremented version
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(ASSETS).catch(err => console.warn('[SW] Pre-cache warning:', err))
        )
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => {
                console.log('[SW] Deleting old cache:', k);
                return caches.delete(k);
            })
        )).then(() => clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

// Push notifications (optional)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FIRE_REMINDER') {
        event.waitUntil(
            self.registration.showNotification(event.data.title, {
                body: event.data.body,
                icon: 'https://cdn-icons-png.flaticon.com/512/3004/3004458.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/3004/3004458.png',
                vibrate: [200, 100, 200],
                tag: event.data.tag || 'seizure-diary-alert',
                requireInteraction: false
            })
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});