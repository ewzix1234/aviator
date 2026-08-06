const CACHE = 'aviator-v7';
// Les images d'avions ne sont pas listées : elles sont mises en cache à la volée
// par le gestionnaire fetch, ce qui évite de casser l'installation quand un
// fichier img/avionN.png n'a pas encore été déposé.
const FICHIERS = [
  '.', 'index.html', 'style.css', 'app.js', 'game.js', 'manifest.json',
  'img/placeholder.png', 'img/icon-192.png', 'img/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
