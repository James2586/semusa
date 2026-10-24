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

test("홈: 6구역, 상황 칸은 있는 서비스 페이지로, 책 33권·후기 2건·카카오톡 버튼", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "index.html"), "utf8");
  for (const id of ["h-hero", "h-situ", "h-books", "h-how", "h-faq", "h-loc"]) assert.match(h, new RegExp(`id="${id}"`), id);
  for (const m of h.matchAll(/href="\/services\/([a-z-]+)"/g)) assert.ok(existsSync(join(DIST, "services", `${m[1]}.html`)), m[1]);
  assert.match(h, /책 33권/);
  assert.equal((h.match(/class="card rv"/g) || []).length, 2);
  assert.match(h, /class="btn btn-kakao"/);
});

test("계산기 13페이지: 계산 화면(iframe·제목), 새 창 링크, 참고용 문구, 상담 버튼", { skip: !has }, () => {
  const calcs = JSON.parse(readFileSync(new URL("../src/data/calculators.json", import.meta.url), "utf8")).calculators;
  for (const c of calcs) {
    const h = readFileSync(join(DIST, "calculators", `${c.slug}.html`), "utf8");
    assert.match(h, new RegExp(`<iframe[^>]*src="${c.url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`), c.slug);
    assert.match(h, /<iframe[^>]*title="[^"]+"/, c.slug);
    assert.match(h, /새 창에서 열기/, c.slug);
    assert.match(h, /결과는 참고용입니다/, c.slug);
    assert.match(h, /이 결과로 상담하기/, c.slug);
    if (c.deadline) assert.ok(h.includes(c.deadline.law), `${c.slug}: 근거 조문`);
  }
});

test("영상: 누를 때만 받고(preload=none), 33권·22권 설명과 글로 보기가 붙는다", { skip: !has }, () => {
  for (const p of ["index.html", "about.html"]) {
    const h = readFileSync(join(DIST, p), "utf8");
    assert.match(h, /<video[^>]*preload="none"/, p);
    assert.ok(!/<video[^>]*autoplay/.test(h), p);
    assert.match(h, /저서 33권 중 22권을 검색합니다/, p);
    assert.match(h, /영상 내용 글로 보기/, p);
  }
});

test("5단계: '다음 단계에서 채웁니다' 자리가 남지 않고, 서비스 5페이지마다 기한과 근거 조문", { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) assert.ok(!readFileSync(f, "utf8").includes("다음 단계에서 채웁니다"), f);
  const svcs = JSON.parse(readFileSync(new URL("../src/data/services.json", import.meta.url), "utf8")).services;
  for (const s of svcs) {
    const h = readFileSync(join(DIST, "services", `${s.slug}.html`), "utf8");
    assert.ok(s.deadlines.length > 0, s.slug);
    for (const d of s.deadlines) assert.ok(h.includes(d.law), `${s.slug}: ${d.law}`);
  }
});

test("마무리 한 줄: 홈·404 말고 모든 페이지 끝에 하나, 불복 서비스는 기한 문구", { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) {
    const h = readFileSync(f, "utf8");
    const n = (h.match(/class="closing /g) || []).length;
    const expect = /\/(index|404)\.html$/.test(f) ? 0 : 1;
    assert.equal(n, expect, f);
  }
  assert.match(readFileSync(join(DIST, "services", "appeal.html"), "utf8"), /기한이<img[^>]*>있는 일입니다\./);
});

test("칼럼·책: 대표 글 + 카드(종류 칩·새 창 표시) + 거르기 단추, 영상 카드는 소개 페이지 영상으로", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "columns.html"), "utf8");
  assert.match(h, /class="feat/);
  assert.ok((h.match(/class="card-a"/g) || []).length >= 6);
  assert.match(h, /aria-pressed="true"[^>]*data-kind="전체"/);
  assert.match(h, /href="\/about#video-portfolio"/);
  assert.match(readFileSync(join(DIST, "about.html"), "utf8"), /id="video-portfolio"/);
});

test("모든 페이지 바닥글과 전문가 소개에 통합검색 22로 가는 링크", { skip: !has }, () => {
  const url = JSON.parse(readFileSync(new URL("../src/data/site.json", import.meta.url), "utf8")).taxSearch.url;
  for (const f of htmlFiles(DIST)) assert.ok(readFileSync(f, "utf8").includes(`href="${url}"`), f);
  assert.match(readFileSync(join(DIST, "about.html"), "utf8"), /통합검색 22 열기/);
});
