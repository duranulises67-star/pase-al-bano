// Service worker de Pase al Baño: guarda la app en el dispositivo para que abra sin internet.
// Al publicar una versión nueva, cambia el número de VERSION para que los dispositivos la descarguen.
const VERSION = 'pase-al-bano-v2';
const EXTERNOS = 'pase-al-bano-externos';
const ARCHIVOS = [
  './',
  './index.html',
  './app.js',
  './nube.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
// Bibliotecas de otros sitios que la app usa (tipografías, PDF y conexión con Firebase).
const HOSTS_EXTERNOS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION && k !== EXTERNOS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const redPrimero = (req, clave) => fetch(req)
  .then(res => { if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(clave || req, copia)); } return res; })
  .catch(() => caches.match(clave || req));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La página y la configuración: primero la red (para recibir cambios) y, sin conexión, la copia guardada.
  if (req.mode === 'navigate') { e.respondWith(redPrimero(req, './index.html')); return; }
  if (url.origin === self.location.origin && url.pathname.endsWith('/firebase-config.txt')) { e.respondWith(redPrimero(req)); return; }

  // Archivos propios: primero la copia guardada.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  // Bibliotecas externas con versión fija: se guardan la primera vez que se descargan.
  if (HOSTS_EXTERNOS.includes(url.hostname)) {
    e.respondWith(
      caches.open(EXTERNOS).then(c => c.match(req).then(r => r || fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; })))
    );
  }
});

// Al tocar un aviso del sistema, vuelve a la app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const abierta = lista.find(c => 'focus' in c);
    return abierta ? abierta.focus() : self.clients.openWindow('./');
  }));
});
