// 쪽마다 공유 그림(2026-10-24 3차 B3): 목록의 쪽마다 그림이 있고(1200×630), 만든 쪽의 og:image가 그 그림을 가리킨다
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ogPagesFrom } from "../src/lib/ogPages.js";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const svc = read("src/data/services.json"), calc = read("src/data/calculators.json"), home = read("src/data/home.json");
const pages = ogPagesFrom({ services: svc.services, calculators: calc.calculators, groups: calc.groups, booksTotal: home.booksTotal });
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test("서비스·계산기마다 공유 그림이 있고 크기는 1200×630 — 자료를 고치면 node scripts/make-og-pages.mjs", () => {
  for (const s of svc.services) assert.ok(pages.some((p) => p.path === `/services/${s.slug}`), s.slug);
  for (const c of calc.calculators) assert.ok(pages.some((p) => p.path === `/calculators/${c.slug}`), c.slug);
  for (const p of pages) {
    const f = `public/og/${p.file}.png`;
    assert.ok(existsSync(f), `${f} 없음 — node scripts/make-og-pages.mjs`);
    assert.deepEqual(pngSize(readFileSync(f)), [1200, 630], f);
  }
  assert.equal(readdirSync("public/og").length, pages.length, "목록에 없는 그림이 남아 있음");
});
test("공유 그림 글에 세무사 명칭·결과 약속 없음", () => {
  for (const p of pages) assert.doesNotMatch([p.kicker, p.title, p.sub].join(" "), /세무사|절감|% ?줄/);
});
const DIST = "dist", has = existsSync(join(DIST, "index.html"));
test("만든 쪽의 og:image가 그 쪽 그림을 가리킨다", { skip: !has }, () => {
  for (const p of pages) {
    const f = join(DIST, `${p.path.slice(1)}.html`);
    assert.match(readFileSync(f, "utf8"), new RegExp(`property="og:image" content="https://semusatax\\.vercel\\.app/og/${p.file}\\.png"`), f);
  }
  assert.match(readFileSync(join(DIST, "index.html"), "utf8"), /property="og:image" content="https:\/\/semusatax\.vercel\.app\/og\.png"/);
});
