// Service Worker — Cache offline para PWA
const CACHE_NAME = 'reforma-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/storage.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/gastos.js',
  '/js/materiais.js',
  '/js/mao-de-obra.js',
  '/js/cronograma.js',
  '/js/planta-fotos.js',
  '/js/recibos.js',
  '/js/calculadora.js',
  '/js/fornecedores.js',
  '/js/relatorio.js',
];

// Instalar: cachear assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Ativar: limpar caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first, fallback para rede
self.addEventListener('fetch', (e) => {
  // Ignorar requests de CDN (Tesseract, jsPDF) — sempre da rede
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      });
    }).catch(() => {
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
