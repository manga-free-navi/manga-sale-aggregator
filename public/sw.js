const CACHE_NAME = 'manga-sale-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 外部ドメイン（広告やGoogle Analyticsなど）への通信は、サービスワーカーでは介入せずスルーする
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch((err) => {
        // 通信エラー発生時も、ブラウザがエラーを吐かないよう空のResponseオブジェクトを返す
        return new Response('', { status: 408, statusText: 'Network Error' });
      });
    })
  );
});
