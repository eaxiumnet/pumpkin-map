// Service worker for the GitHub copy: every picture is downloaded once and then served from the visitor's own browser.
// Picture URLs carry a content hash (?h=...), so a re-rendered picture gets a new URL and is fetched again; unchanged ones never are.
// shortcut: superseded pictures stay in the cache until the browser evicts them; add pruning if caches grow too big.
const IMG = 'pmap-img-v1', PAGE = 'pmap-page-v1', PHOTO = 'pmap-photo-v1', ASSET = 'pmap-asset-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![IMG, PAGE, PHOTO, ASSET].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
async function cacheFirst(name, req) {
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) {
    c.put(req, r.clone());
    if (name === ASSET) { const p = new URL(req.url).pathname; for (const k of await c.keys()) if (new URL(k.url).pathname === p && k.url !== req.url) c.delete(k); }  // a new 3D pack replaces the old one
  }
  return r;
}
function staleWhileRevalidate(req, e) {  // unhashed files that rarely change: the cached copy now, a fresh one for next time
  const c = caches.open(ASSET);
  const net = fetch(req).then(async r => { if (r.ok && r.status === 200) await (await c).put(req, r.clone()); return r; });
  e.waitUntil(net.catch(() => {}));  // must be called while the event is dispatched: Safari rejects a later waitUntil
  e.respondWith(c.then(c => c.match(req)).then(hit => hit || net));
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
    if (/\/apb3d\//.test(u.pathname) && u.searchParams.has('h')) return e.respondWith(cacheFirst(ASSET, req));  // 3D city: ?h= is the pack version
    if (/\/(scare|vendor)\//.test(u.pathname) && !req.headers.has('range')) return staleWhileRevalidate(req, e);  // <audio> range requests can't be cached
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req));
    return;  // version.json and the rest: straight to the network
  }
  // community photos never change once uploaded (removed ones are no longer requested), so keep them too
  if (u.pathname.endsWith('/rest/v1/reports') && u.searchParams.get('select') === 'photo') return e.respondWith(cacheFirst(PHOTO, req));
});
