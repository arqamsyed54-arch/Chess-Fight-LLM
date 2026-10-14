/* Chess Fight LLM service worker: offline UI shell, honest limits.
   Static assets cache-first (offline capable). API calls always go to the
   network: the engine runs on the local server, so moves need it. If the
   server is unreachable the app shows its normal error paths. */
const CACHE = 'cfllm-v1';
const SHELL = ['index.html', '3d.html', 'styles.css', '3d.css', 'app.js',
  'js/game3d.js', 'js/board3d.js', 'js/coord.js', 'js/aiworker.js', 'js/model-loader.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'vendor/three.module.js', 'vendor/three.core.js', 'vendor/addons/controls/OrbitControls.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return; // engine needs the server
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    }
    return r;
  }).catch(() => caches.match('index.html'))));
});
