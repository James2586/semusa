// 오프라인(2026-10-24 3차 D1): 인터넷이 끊겨도 기한 달력·올해 세금 달력이 열리게.
// 쪽(HTML)은 늘 인터넷 먼저(새 배포가 바로 보이게) — 끊겼을 때만 저장본, 저장본도 없으면 /offline.
// /_astro·/fonts·/img는 이름에 내용이 박혀 있어 저장본 먼저. 다른 사이트(계산기 iframe·카카오)는 건드리지 않는다.
// 이 파일을 고치면 VERSION을 올린다(옛 저장소를 지움). 개인정보는 저장하지 않는다 — 같은 사이트 GET 응답만.
const VERSION = "v3";
const PAGES = `pages-${VERSION}`, ASSETS = `assets-${VERSION}`;
const PRECACHE = ["/deadline", "/tax-calendar", "/offline"];
const ASSET_MAX = 120;

async function precache() {
  const pages = await caches.open(PAGES), assets = await caches.open(ASSETS);
  for (const url of PRECACHE) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) continue;
    const html = await res.clone().text();
    await pages.put(url, res);
    // 그 쪽이 쓰는 스크립트·스타일·글꼴도 같이(같은 사이트 경로만) — 스크립트가 불러오는 조각·CSS 속 글꼴까지 따라간다
    await crawl(assets, [...html.matchAll(/(?:href|src)="(\/(?:_astro|fonts)\/[^"]+)"/g)].map((m) => m[1]));
  }
}
async function crawl(assets, start) {
  const seen = new Set(), queue = [...start];
  while (queue.length && seen.size < 200) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const res = await fetch(u).catch(() => null);
    if (!res?.ok) continue;
    await assets.put(u, res.clone());
    if (!/\.(js|css)$/.test(u)) continue;
    const text = await res.text();
    for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.{1,2}\/[^"']+\.js)["']|url\(["']?(\/(?:fonts|_astro)\/[^"')]+)["']?\)/g)) {
      const ref = m[1] ? new URL(m[1], location.origin + u).pathname : m[2];
      if (/^\/(_astro|fonts)\//.test(ref) && !seen.has(ref)) queue.push(ref);
    }
  }
}
self.addEventListener("install", (e) => { e.waitUntil(precache().then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - ASSET_MAX))) await cache.delete(k);
}
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const key = url.pathname.replace(/\.html$/, "") || "/";
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") { const c = await caches.open(PAGES); c.put(key, res.clone()); }
        return res;
      } catch {
        const c = await caches.open(PAGES);
        return (await c.match(key, { ignoreVary: true })) || (await c.match("/offline", { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }
  if (/^\/(_astro|fonts|img)\//.test(url.pathname)) {
    e.respondWith((async () => {
      // 글꼴·모듈 스크립트는 cors 요청이라 Vary(Origin)가 걸리면 저장본과 안 맞는다 — 주소로만 찾는다
      const c = await caches.open(ASSETS), hit = await c.match(url.pathname, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(url.pathname, res.clone()); trim(c); }
      return res;
    })());
  }
});
