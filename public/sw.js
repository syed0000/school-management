self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json()
        const options = {
            body: data.body,
            icon: data.icon || '/logo.jpeg',
            badge: '/logo.jpeg',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
            },
        }
        event.waitUntil(self.registration.showNotification(data.title, options))
    }
})

self.addEventListener('notificationclick', function (event) {
    event.notification.close()
    event.waitUntil(
        clients.openWindow('https://modern-nursery.vercel.app') // You should update this with your actual URL
    )
})

const CACHE_NAME = 'modern-nursery-cache-v1';
const urlsToCache = [
  '/logo.jpeg',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
            )
    );
});
