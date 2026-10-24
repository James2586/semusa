// 3차 업그레이드 독립 검토(2026-10-24) 고친 것이 다시 깨지지 않게
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(p, "utf8");
test("글자 크게: 계산기 틀은 키우지 않고(되돌림 zoom), 창은 넓은 화면에서만", () => {
  const css = read("src/styles/global.css");
  assert.match(css, /html\[data-fs="lg"\] :is\(main, \.foot\) \{ zoom: 1\.15; \}/);
  assert.match(css, /html\[data-fs="lg"\] \.frame \{ zoom: calc\(1 \/ 1\.15\); \}/);
  assert.match(css, /@media \(min-width: 700px\) \{ html\[data-fs="lg"\] dialog \{ zoom: 1\.15; \} \}/);
});
test("sw.js: 저장본 먼저는 /_astro/만 — 글꼴·그림·쪽은 인터넷 먼저(빌드마다 같은 이름으로 바뀜)", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/_astro\/"\)\)/);
  const tail = sw.slice(sw.indexOf("(fonts|img)"));
  assert.ok(tail.indexOf("networkFirst(req, url.pathname") > 0 && tail.indexOf("networkFirst(req, url.pathname") < 200, "글꼴·그림은 networkFirst");
  assert.match(sw, /const CORE = /); // 미리 저장한 것은 정리 대상 밖
});
test("찾기: 목록을 못 받으면 알리고, 다시 받기는 입력 때만(끊긴 동안 끝없이 돌지 않게)", () => {
  const s = read("src/components/SiteSearch.astro");
  assert.match(s, /찾기 목록을 불러오지 못했습니다/);
  const render = s.slice(s.indexOf("function render()"), s.indexOf("function open("));
  assert.doesNotMatch(render, /load\(\)/);
  assert.match(s, /input\.addEventListener\("input", \(\) => \{ render\(\); if \(failed && !items\) load\(\)\.then\(render\); \}\)/);
});
test("14px 아래로 줄이는 transform: scale 금지(글자 14px 이상 규칙)", () => {
  const files = ["src/styles/global.css", ...["src/components", "src/pages", "src/pages/services", "src/pages/calculators"].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".astro")).map((f) => join(d, f)))];
  for (const f of files) for (const m of read(f).matchAll(/font-size:\s*14px[^}]*transform:\s*scale\(\.\d+\)/g)) assert.fail(`${f}: ${m[0]}`);
});
test("올해 세금 달력: 오늘이 속한 해로 연다", () => {
  assert.match(read("src/pages/tax-calendar.astro"), /chips\.find\(\(c\) => Number\(c\.dataset\.year\) === nowY\)/);
});
