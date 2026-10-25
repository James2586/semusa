// 쪽마다 공유 그림(2026-10-24 3차 B3) — public/og/<file>.png. 손으로 고치지 말고: node scripts/make-og-pages.mjs  (Playwright 필요 — 빌드에는 쓰지 않음)
// 목록·글은 src/lib/ogPages.js(자료 파일 그대로). 글꼴은 node_modules의 Noto Serif KR 전체(쪼갠 파일 124개)를 가짜 주소로 읽어 빠진 글자가 없게.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { ogPagesFrom } from "../src/lib/ogPages.js";

const pw = await import("playwright").catch(() => import(join(execSync("npm root -g").toString().trim(), "playwright/index.js")));
const { chromium } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname;
const FS = join(ROOT, "node_modules/@fontsource/noto-serif-kr");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const svc = read("src/data/services.json"), calc = read("src/data/calculators.json"), home = read("src/data/home.json");
const pages = ogPagesFrom({ services: svc.services, calculators: calc.calculators, groups: calc.groups, booksTotal: home.booksTotal, topics: read("src/data/topics.json").topics });
const MOSS = "#1E3A2A", CREAM = "#F3F0E7", GOLD = "#E8C46A", MOSS2 = "#C3CDC6";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const html = (p) => `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/400.css"><link rel="stylesheet" href="/700.css"><link rel="stylesheet" href="/900.css">
<style>html,body{margin:0}
.og{width:1200px;height:630px;box-sizing:border-box;padding:70px 84px 64px;background:${MOSS};color:${CREAM};display:grid;grid-template-rows:auto 1fr auto;gap:22px;font-family:'Noto Serif KR';
background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Cpath d='M22 18v8M18 22h8' stroke='%23F3F0E7' stroke-opacity='.07' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E")}
.k{display:flex;align-items:center;gap:16px;font-weight:700;font-size:28px;color:${GOLD};letter-spacing:.01em}.k::before{content:"";width:40px;height:2px;background:${GOLD}}
.m{align-self:center;display:grid;gap:22px}
.t{font-weight:700;font-size:var(--fs);line-height:1.22;letter-spacing:-.02em;margin:0;text-wrap:balance}
.s{font-weight:400;font-size:31px;line-height:1.45;color:${MOSS2};margin:0;text-wrap:balance}
.f{display:flex;align-items:center;gap:22px;white-space:nowrap}
.w{font-weight:900;font-size:44px;letter-spacing:-.035em;line-height:1}.w .p{font-weight:400;color:${GOLD};margin-left:.03em}
.n{font-weight:400;font-size:26px;color:${MOSS2};padding-left:22px;border-left:2px solid rgba(243,240,231,.24);line-height:1.15}
</style>
<div class="og" style="--fs:${p.title.length > 14 ? 70 : 86}px"><p class="k">${esc(p.kicker)}</p>
<div class="m"><p class="t">${esc(p.title)}</p>${p.sub ? `<p class="s">${esc(p.sub)}</p>` : ""}</div>
<div class="f"><span class="w">하나 더<span class="p">+</span></span><span class="n">세무법인 성수 송파 WM센터 · 세무전문가 성광호</span></div></div>`;

const OUT = join(ROOT, "public/og");
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) unlinkSync(join(OUT, f)); // 없어진 쪽의 그림이 남지 않게
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
let cur = "";
await page.route("http://og.local/**", (r) => {
  const u = new URL(r.request().url()).pathname;
  if (u === "/") return r.fulfill({ contentType: "text/html", body: cur });
  return r.fulfill({ body: readFileSync(join(FS, u)), contentType: u.endsWith(".css") ? "text/css" : "font/woff2" });
});
for (const p of pages) {
  cur = html(p);
  await page.goto("http://og.local/");
  await page.evaluate(async () => { await document.fonts.ready; });
  const ov = await page.evaluate(() => { const o = document.querySelector(".og"); return o.scrollHeight > 630 || o.scrollWidth > 1200; });
  if (ov) throw new Error(`글이 그림 밖으로 넘침: ${p.file}`);
  writeFileSync(join(OUT, `${p.file}.png`), await page.locator(".og").screenshot());
}
await browser.close();
console.log(`공유 그림 ${pages.length}장 만듦 → public/og/`);
