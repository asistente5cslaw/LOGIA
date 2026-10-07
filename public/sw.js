// Service Worker para Notificaciones Push de Logia Unión Fraternal No. 21
const CACHE_NAME = 'logia-uf21-v4';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/manifest-emblem.webmanifest',
  '/manifest-monogram.webmanifest',
  '/logo-uf21.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Permite que la PWA se abra incluso con conectividad intermitente.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});

// Evento de Notificación Push recibida
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Logia Unión Fraternal No. 21';
  const options = {
    body: data.body || 'Tienes un nuevo mensaje o convocatoria fraternal.',
    icon: '/logo-uf21.png',
    badge: '/logo-uf21.png',
    image: data.image || undefined,
    tag: data.tag || 'logia-notif-' + Date.now(),
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/app/calendar',
      timestamp: Date.now(),
    },
    actions: data.actions || [
      { action: 'open', title: 'Ver Tenida' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    (async () => {
      // Evita mostrar dos veces el mismo aviso si el envío se repite o quedan
      // dos eventos pendientes en el sistema operativo.
      const dedupeKey = `https://logia-uf21.local/push/${options.tag}`;
      const dedupeCache = await caches.open('logia-push-dedupe-v1');
      if (await dedupeCache.match(dedupeKey)) return;
      await dedupeCache.put(dedupeKey, new Response(String(Date.now())));
      return self.registration.showNotification(title, options);
    })()
  );
});

// Clic en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
