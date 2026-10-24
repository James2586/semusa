// 오프라인(2026-10-24 3차 D1): 인터넷이 끊겨도 기한 달력·올해 세금 달력이 열리게.
// 쪽(HTML)·글꼴·그림은 늘 인터넷 먼저(새 배포가 바로 보이게 — 글꼴 파일은 빌드마다 같은 이름으로 다시 잘리고 그림도 이름이 안 바뀜), 끊겼을 때만 저장본.
// 저장본 먼저는 이름에 내용이 박힌 /_astro/만. 미리 저장한 쪽과 그 쪽의 파일(CORE)은 지우지 않고, 다녀간 쪽·파일만 개수 상한으로 정리.
// 다른 사이트(계산기 iframe·카카오)는 건드리지 않는다. 이 파일을 고치면 VERSION을 올린다(옛 저장소를 지움). 개인정보는 저장하지 않는다 — 같은 사이트 GET 응답만.
const VERSION = "v4";
const CORE = `core-${VERSION}`, PAGES = `pages-${VERSION}`, ASSETS = `assets-${VERSION}`;
const PRECACHE = ["/deadline", "/tax-calendar", "/offline"];
const PAGE_MAX = 40, ASSET_MAX = 120;
const opts = { ignoreVary: true }; // 글꼴·모듈 스크립트는 cors 요청이라 Vary(Origin)가 걸리면 저장본과 안 맞는다 — 주소로만 찾는다

async function precache() {
  const core = await caches.open(CORE);
  for (const url of PRECACHE) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) continue;
    const html = await res.clone().text();
    await core.put(url, res);
    // 그 쪽이 쓰는 스크립트·스타일·글꼴도 같이(같은 사이트 경로만) — 스크립트가 불러오는 조각·CSS 속 글꼴까지 따라간다
    await crawl(core, [...html.matchAll(/(?:href|src)="(\/(?:_astro|fonts)\/[^"]+)"/g)].map((m) => m[1]));
  }
}
async function crawl(cache, start) {
  const seen = new Set(), queue = [...start];
  while (queue.length && seen.size < 200) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const res = await fetch(u, { cache: "no-cache" }).catch(() => null);
    if (!res?.ok) continue;
    await cache.put(u, res.clone());
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
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![CORE, PAGES, ASSETS].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name), keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}
async function fromCache(key) {
  for (const name of [CORE, PAGES, ASSETS]) { const hit = await (await caches.open(name)).match(key, opts); if (hit) return hit; }
  return null;
}
// 인터넷 먼저 → 성공하면 저장(미리 저장한 것은 CORE를 새로, 아니면 store), 실패하면 저장본
async function networkFirst(req, key, store, max) {
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") {
      const core = await caches.open(CORE);
      if (await core.match(key, opts)) await core.put(key, res.clone());
      else { await (await caches.open(store)).put(key, res.clone()); trim(store, max); }
    }
    return res;
  } catch {
    return (await fromCache(key)) || null;
  }
}
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    const key = url.pathname.replace(/\.html$/, "") || "/";
    e.respondWith(networkFirst(req, key, PAGES, PAGE_MAX).then((r) => r || fromCache("/offline")).then((r) => r || Response.error()));
    return;
  }
  if (url.pathname.startsWith("/_astro/")) {
    e.respondWith((async () => {
      const hit = await fromCache(url.pathname);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { await (await caches.open(ASSETS)).put(url.pathname, res.clone()); trim(ASSETS, ASSET_MAX); }
      return res;
    })());
    return;
  }
  if (/^\/(fonts|img)\//.test(url.pathname) || url.pathname === "/search.json") {
    e.respondWith(networkFirst(req, url.pathname, ASSETS, ASSET_MAX).then((r) => r || Response.error()));
  }
});
