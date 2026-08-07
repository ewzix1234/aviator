const CACHE = 'back2back-v10';

// Le cœur de l'app : sans ces fichiers, rien ne s'affiche. L'installation échoue
// si l'un d'eux manque, c'est voulu.
const ESSENTIELS = [
  '.', 'index.html', 'style.css', 'app.js', 'game.js', 'manifest.json',
];

// Les images : on veut les avoir toutes hors ligne, mais un fichier absent ne doit
// pas faire échouer l'installation entière — d'où la mise en cache une par une.
const IMAGES = [
  'img/placeholder.png', 'img/icon-192.png', 'img/icon-512.png',
  'img/avion1.png', 'img/avion2.png', 'img/avion3.png', 'img/avion4.png', 'img/avion5.png',
  'img/avion6.png', 'img/avion7.png', 'img/avion8.png', 'img/avion9.png', 'img/avion10.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ESSENTIELS);
    await Promise.allSettled(IMAGES.map((u) => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache d'abord : le jeu tourne à l'identique sans réseau. Ce qui n'est pas encore
// en cache est récupéré puis conservé pour la prochaine fois.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const enCache = await caches.match(e.request);
    if (enCache) return enCache;
    try {
      const reponse = await fetch(e.request);
      if (reponse.ok && new URL(e.request.url).origin === location.origin) {
        const c = await caches.open(CACHE);
        c.put(e.request, reponse.clone());
      }
      return reponse;
    } catch (err) {
      // hors ligne et rien en cache : on sert au moins la page d'accueil
      return (await caches.match('index.html')) || Response.error();
    }
  })());
});
