const CACHE_NAME = 'memory-game-v1';
const urlsToCache = [
  '/gameHub/flipgame/games/memory.html',
  '/gameHub/flipgame/games/memory-ai.js',
  '/gameHub/flipgame/manifest.json',
  '/gameHub/flipgame/icon.png',
  '/gameHub/flipgame/icons/icons8-user-100.png',
  '/gameHub/flipgame/icons/nerd-hair.png',
  '/gameHub/flipgame/icons/icons8-caveman-100.png',
  '/gameHub/flipgame/icons/icons8-user-male.gif',
  '/gameHub/flipgame/icons/circle-user.gif',
  '/gameHub/flipgame/icons/icons8-person-female.gif',
  '/gameHub/flipgame/icons/One.gif',
  '/gameHub/flipgame/icons/two.gif',
  '/gameHub/flipgame/Assets/flip.mp3',
  '/gameHub/flipgame/Assets/match.mp3',
  '/gameHub/flipgame/Assets/win.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // delete old cache
          }
        })
      );
    })
  );
});
