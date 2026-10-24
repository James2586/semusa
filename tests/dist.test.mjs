// npm run build 뒤에 돌린다. 만들어진 페이지가 설계서 규칙을 지키는지 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const has = existsSync(DIST);

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "_astro" ? [] : htmlFiles(p);
    return f.endsWith(".html") ? [p] : [];
  });
}

test("페이지 28개(색인 25 + 공지·개인정보 + 404)", { skip: !has }, () => {
  assert.equal(htmlFiles(DIST).length, 28);
});

test("모든 페이지: lang=ko, 제목, 설명, canonical, h1 하나, 본문 건너뛰기", { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) {
    const h = readFileSync(f, "utf8");
    assert.match(h, /<html lang="ko"/, f);
    assert.match(h, /<title>[^<]+<\/title>/, f);
    assert.match(h, /<meta name="description" content="[^"]+"/, f);
    assert.match(h, /<link rel="canonical" href="https:\/\/semusatax\.vercel\.app\//, f);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, `${f}: h1은 하나`);
    assert.match(h, /본문으로 건너뛰기/, f);
  }
});

test('"세무사" 명칭이 어느 페이지에도 없다', { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) assert.ok(!readFileSync(f, "utf8").includes("세무사"), f);
});

test("공지·개인정보·404는 noindex이고 sitemap에 없다", { skip: !has }, () => {
  for (const p of ["notice.html", "privacy.html", "404.html"]) {
    assert.match(readFileSync(join(DIST, p), "utf8"), /<meta name="robots" content="noindex"/, p);
  }
  const sm = readFileSync(join(DIST, "sitemap-0.xml"), "utf8");
  assert.equal((sm.match(/<loc>/g) || []).length, 25);
  assert.ok(!/notice|privacy|404/.test(sm));
});

test("바깥 새 창 링크에는 rel=noopener", { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) {
    for (const a of readFileSync(f, "utf8").match(/<a [^>]*target="_blank"[^>]*>/g) || []) {
      assert.match(a, /rel="noopener"/, `${f}: ${a}`);
    }
  }
});

test("계산기 상세 페이지에는 휴대폰 아래 막대가 없다", { skip: !has }, () => {
  assert.ok(!readFileSync(join(DIST, "calculators/gift.html"), "utf8").includes('class="bbar"'));
  assert.ok(readFileSync(join(DIST, "index.html"), "utf8").includes('class="bbar"'));
});
