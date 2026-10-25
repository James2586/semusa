// 앱 아이콘·브라우저 탭 그림(PNG 5개)과 카카오톡 공유 그림(og.png)을 글자 로고 A로 다시 만든다(2026-10-24).
// 손으로 고치지 말고 이 스크립트로만: node scripts/make-brand-images.mjs  (Playwright 필요 — 빌드에는 쓰지 않음)
// 글꼴은 node_modules의 Noto Serif KR(@fontsource) 파일을 그대로 읽는다 — 기기 글꼴에 기대지 않는다.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// 프로젝트 의존성에 넣지 않은 Playwright — 없으면 전역 설치본을 쓴다
const pw = await import("playwright").catch(() => import(join(execSync("npm root -g").toString().trim(), "playwright/index.js")));
const { chromium } = pw.chromium ? pw : pw.default;

const ROOT = new URL("..", import.meta.url).pathname;
const FONT = join(ROOT, "node_modules/@fontsource/noto-serif-kr/files");
const face = (w, sub) => `@font-face{font-family:S;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(join(FONT, `noto-serif-kr-${sub}-${w}-normal.woff2`)).toString("base64")}) format("woff2")}`;
const FACES = [face(900, "korean"), face(700, "korean"), face(400, "korean"), face(400, "latin"), face(700, "latin")].join("");
const MOSS = "#1E3A2A", CREAM = "#F3F0E7", GOLD = "#E8C46A", MOSS2 = "#C3CDC6";

// "더+" 아이콘 한 장. round: 모서리 반지름(px, 0이면 네모 — iOS·마스커블은 기기가 깎는다), scale: 글자 크기(한 변 대비)
function iconHtml(size, { round, scale, drawPlus = 0 }) {
  // drawPlus: 작은 크기에서 글꼴 +가 1px로 번지면 굵기(px)를 정해 직접 그린다
  const plus = drawPlus ? `<svg class="pd" viewBox="0 0 10 10" width="${Math.round(size * scale * 0.5)}" height="${Math.round(size * scale * 0.5)}"><path d="M5 0v10M0 5h10" stroke="${GOLD}" stroke-width="${(drawPlus * 10) / Math.round(size * scale * 0.5)}"/></svg>` : `<span class="p">+</span>`;
  return `<style>${FACES}html,body{margin:0;background:transparent}
  .i{width:${size}px;height:${size}px;border-radius:${round}px;background:${MOSS};display:grid;place-items:center}
  .t{font-family:S;font-weight:900;font-size:${Math.round(size * scale)}px;line-height:1;color:${CREAM};letter-spacing:-.06em;transform:translateY(-.04em)}
  .p{font-weight:400;color:${GOLD};margin-left:.02em}.pd{display:inline-block;vertical-align:.12em;margin-left:.06em}</style><div class="i"><span class="t">더${plus}</span></div>`;
}

const OG = `<style>${FACES}html,body{margin:0}
.og{width:1200px;height:630px;box-sizing:border-box;padding:76px 84px;background:${MOSS};color:${CREAM};display:grid;align-content:space-between;font-family:S;
background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Cpath d='M22 18v8M18 22h8' stroke='%23F3F0E7' stroke-opacity='.07' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E")}
.t{font-weight:700;font-size:76px;line-height:1.3;letter-spacing:-.02em;margin:0}.t em{font-style:normal;color:${GOLD}}
.f{display:flex;align-items:center;gap:22px;white-space:nowrap}
.w{font-weight:900;font-size:50px;letter-spacing:-.035em;line-height:1}.w .p{font-weight:400;color:${GOLD};margin-left:.03em}
.s{font-weight:400;font-size:28px;color:${MOSS2};padding-left:22px;border-left:2px solid rgba(243,240,231,.24);line-height:1.15}
</style>
<div class="og"><p class="t">세금은 날짜부터<br><em>하나 더</em> 봅니다.</p>
<div class="f"><span class="w">하나 더<span class="p">+</span></span><span class="s">세무법인 성수 송파 WM센터 · 세무전문가 성광호</span></div></div>`;

const ICONS = [
  ["favicon-32.png", 32, { round: 7, scale: 0.5, drawPlus: 2 }], // 32px에선 가는 +가 번져 금색이 사라져 2px로 그림
  ["apple-touch-icon.png", 180, { round: 0, scale: 0.44 }],
  ["icon-192.png", 192, { round: 42, scale: 0.44 }],
  ["icon-512.png", 512, { round: 112, scale: 0.44 }],
  ["icon-maskable-512.png", 512, { round: 0, scale: 0.34 }], // 안전 구역(가운데 80%) 안에 글자
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, size, opt] of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(iconHtml(size, opt));
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(ROOT, "public", file), await page.locator(".i").screenshot({ omitBackground: true }));
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(OG);
await page.evaluate(() => document.fonts.ready);
writeFileSync(join(ROOT, "public/og.png"), await page.locator(".og").screenshot());
await browser.close();
console.log("아이콘 5개·og.png 만듦");
