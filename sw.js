// Service worker for the GitHub copy: every picture is downloaded once and then served from the visitor's own browser.
// Picture URLs carry a content hash (?h=...), so a re-rendered picture gets a new URL and is fetched again; unchanged ones never are.
// shortcut: superseded pictures stay in the cache until the browser evicts them; add pruning if caches grow too big.
const IMG = 'pmap-img-v1', PAGE = 'pmap-page-v1', PHOTO = 'pmap-photo-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![IMG, PAGE, PHOTO].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
async function cacheFirst(name, req) {
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) c.put(req, r.clone());
  return r;
}
async function networkFirst(req) {  // the page: always the newest when online, the last copy when offline
  const c = await caches.open(PAGE);
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
  catch (e) { return (await c.match(req)) || Response.error(); }
}
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET') return;
  if (u.origin === location.origin) {
    if (/\/(thumbs|aerial|backup\/photos)\//.test(u.pathname)) return e.respondWith(cacheFirst(IMG, req));
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req));
    return;  // version.json and the rest: straight to the network
  }
  // community photos never change once uploaded (removed ones are no longer requested), so keep them too
  if (u.pathname.endsWith('/rest/v1/reports') && u.searchParams.get('select') === 'photo') return e.respondWith(cacheFirst(PHOTO, req));
});
