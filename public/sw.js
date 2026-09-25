// Service Worker para Notificaciones Push de Logia Unión Fraternal No. 21
const CACHE_NAME = 'logia-uf21-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
    self.registration.showNotification(title, options)
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
