/**
 * The service worker. Hand-written, no build plugin — the whole policy is
 * twenty lines of routing and it is worth being able to read it.
 *
 * What it is for in v1 is narrow, and deliberately so (#70, #72): this app is
 * server-first. The worker exists to make the app installable and to keep it
 * from showing a dinosaur when the signal drops mid-meeting. It is NOT a sync
 * engine, and it does not make the app work offline in general — the offline
 * write path is the attendance outbox (issue 11), which is client code, not
 * this file.
 *
 * Three rules:
 *
 *   1. Anything under /auth is never touched. A cached redirect or a cached
 *      session response is how one person's session gets handed to the next.
 *   2. Navigations go to the network first and fall back to the cached shell.
 *      Server-rendered HTML is the point of a server-first app; a cache-first
 *      navigation would show yesterday's roster as though it were today's.
 *   2b. A few read screens (#61 as narrowed by #70; #72 as amended 2026-09-02;
 *      bst-v1.2 #1) are kept readable offline: the last successful render of
 *      each is stashed and served when the network is gone. The Meeting page —
 *      its List and its Calendar view each stashing their own render — so the
 *      schedule is there in a room with no signal; People and the Groups
 *      segment so a leader who adds someone in the field can see the queued
 *      row waiting to upload (issue 18) rather than a "no signal" wall. Still
 *      network-first, so an online open is always fresh — and the stale copy
 *      is a server render from the last connection, the same trade the
 *      calendar makes.
 *   3. Build assets (/_next/static/*) are cache-first forever, because their
 *      URLs already carry a build hash — a changed file is a changed URL.
 *
 * Bumping CACHE drops every old entry on activate. That is the only
 * invalidation this file has, and it is enough because rule 3 is the only
 * long-lived cache in it.
 */
const CACHE = "bst-v4";
const OFFLINE_URL = "/offline";
/** Read screens whose last good render is stashed and served when the network
 * is gone (rule 2b). Stash keys carry the query string, so the Meeting page's
 * List and Calendar views each keep their own (bst-v1.2 #1). Everything else
 * offline gets the /offline wall (rule 2). */
const OFFLINE_READABLE = new Set(["/calendar", "/people", "/people/groups"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"]))
      // A failed precache must not leave a half-installed worker in place.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Rule 1. Sessions are never this worker's business.
  if (url.pathname.startsWith("/auth")) return;

  // Rule 3. Hashed build output.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Rule 2b. The offline-readable screens (#61/#70; #72 amended): network-first,
  // but every good response is stashed under its own URL — query string
  // included, so the Meeting page's List and Calendar views stay separate
  // (bst-v1.2 #1) — and served back when the network is gone; a miss falls
  // back to the bare path's stash, then the /offline wall. A client-side nav
  // to one of these fails its RSC fetch offline and Next falls back to a full
  // navigation — which lands here and gets the stale render.
  if (request.mode === "navigate" && OFFLINE_READABLE.has(url.pathname)) {
    const key = url.pathname + url.search;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(key, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(key)
            .then(
              (hit) =>
                hit ??
                caches
                  .match(url.pathname)
                  .then(
                    (bare) =>
                      bare ?? caches.match(OFFLINE_URL).then((fallback) => fallback ?? Response.error()),
                  ),
            ),
        ),
    );
    return;
  }

  // Rule 2. Screens.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error()),
      ),
    );
  }
});
