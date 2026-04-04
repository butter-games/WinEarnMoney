var CACHE_NAME = "prmg-v1";
var ASSETS = [
  "/index.html",
  "/css/style.css",
  "/js/api.js",
  "/js/ledger.js",
  "/js/auth.js",
  "/js/main.js",
  "/js/game-categories.js",
  "/manifest.json",
];

// Install - cache core assets
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fall back to cache
self.addEventListener("fetch", function(e) {
  // Skip API calls and non-GET
  if (e.request.url.includes("/api/") || e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request).then(function(res) {
      var clone = res.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(e.request, clone);
      });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
