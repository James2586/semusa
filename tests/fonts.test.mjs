import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SERIF_TAGS, SERIF_CLASSES, serifText } from "../scripts/subset-fonts.mjs";

const SRC = new URL("../src/", import.meta.url).pathname;
const DIST = new URL("../dist/", import.meta.url).pathname;
const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]));

test("제목 글꼴을 쓰는 CSS 선택자는 글자 자르기 목록에 있다", () => {
  for (const f of files(SRC).filter((f) => /\.(astro|css)$/.test(f))) {
    const css = readFileSync(f, "utf8");
    for (const m of css.matchAll(/([^{}]+)\{[^}]*font-family:\s*var\(--f-display\)/g)) {
      const sel = m[1].trim().split(/\s+/).pop();
      const cls = (sel.match(/\.([a-z0-9-]+)/gi) || []).map((c) => c.slice(1));
      const tag = /^[a-z0-9]+/i.exec(sel)?.[0];
      assert.ok(cls.some((c) => SERIF_CLASSES.includes(c)) || SERIF_TAGS.includes(tag), `${f}: "${sel}"를 SERIF_CLASSES에 더하세요`);
    }
  }
});

test("serifText는 제목·표시 클래스의 글자만 모은다", () => {
  const t = serifText('<p>본문</p><h1>제목 <em>강조</em></h1><span class="logo">하나</span><div class="x">아님</div>');
  assert.match(t, /제목/); assert.match(t, /강조/); assert.match(t, /하나/);
  assert.ok(!t.includes("본문") && !t.includes("아님"));
});

test("잘라 낸 제목 글꼴은 60KB 이하", { skip: !existsSync(join(DIST, "fonts")) }, () => {
  for (const f of ["serif-ko-700.woff2", "serif-la-700.woff2"]) {
    const n = statSync(join(DIST, "fonts", f)).size;
    assert.ok(n > 1000 && n < 60 * 1024, `${f}: ${n} bytes`);
  }
});
