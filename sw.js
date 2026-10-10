// Service worker: caches the app so it opens offline. Bump VERSION when files change.
var VERSION = 'calc-v3';
var FILES = [
  'cal.html', 'js/calc.js', 'js/app.js', 'manifest.webmanifest',
  'js/units.js', 'js/editor.js', 'js/convert.js', 'js/gst.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Serve from cache straight away, then refresh the cache in the background.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var fresh = fetch(e.request).then(function (res) {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      });
      if (hit) { fresh.catch(function () {}); return hit; }
      return fresh;
    });
  }));
});
