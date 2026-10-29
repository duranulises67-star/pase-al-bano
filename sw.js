// Service worker de Pase al Baño: guarda la app en el dispositivo para que abra sin internet.
// Al publicar una versión nueva, cambia el número de VERSION para que los dispositivos la descarguen.
const VERSION = 'pase-al-bano-v3';
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

// En un wifi sin salida a internet las peticiones no fallan: se quedan esperando.
// Por eso ninguna espera a la red más de unos segundos.
const conTiempo = (promesa, ms) => Promise.race([promesa, new Promise((_, mal) => setTimeout(() => mal(new Error('sin respuesta')), ms))]);
// Solo se guarda una respuesta que de verdad vino del sitio: un wifi con página de acceso
// responde con su propia página, y esa no debe reemplazar a la app.
const esPropia = res => res && res.ok && !res.redirected && res.type === 'basic';
const deVersion = url => caches.open(VERSION).then(c => c.match(url));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La página siempre sale de la copia guardada: abre al instante, con o sin internet.
  // Las versiones nuevas llegan cuando cambia este archivo (VERSION).
  if (req.mode === 'navigate') {
    e.respondWith(
      deVersion('./index.html')
        .then(r => r || conTiempo(fetch(req), 8000))
        .catch(() => deVersion('./'))
    );
    return;
  }

  // Configuración de Firebase: primero la red (para recibir cambios), pero sin esperar de más.
  if (url.origin === self.location.origin && url.pathname.endsWith('/firebase-config.txt')) {
    e.respondWith(
      conTiempo(fetch(req), 4000)
        .then(res => {
          const tipo = res.headers.get('content-type') || '';
          if (!esPropia(res) || tipo.includes('html')) throw new Error('respuesta ajena');
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put(url.href, copia));
          return res;
        })
        .catch(() => deVersion(url.href).then(r => r || new Response('', { status: 404 })))
    );
    return;
  }

  // Archivos propios: primero la copia guardada.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(r => r || conTiempo(fetch(req), 8000)));
    return;
  }

  // Bibliotecas externas con versión fija: se guardan la primera vez que se descargan.
  if (HOSTS_EXTERNOS.includes(url.hostname)) {
    e.respondWith(
      caches.open(EXTERNOS).then(c => c.match(req).then(r => r || conTiempo(fetch(req), 6000).then(res => {
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      }))).catch(() => Response.error())
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
