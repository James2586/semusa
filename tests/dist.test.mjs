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

test("페이지 31개(색인 28 + 공지·개인정보 + 404)", { skip: !has }, () => {
  assert.equal(htmlFiles(DIST).length, 31);
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
  assert.equal((sm.match(/<loc>/g) || []).length, 28);
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

test("홈(시안 D): 기한 계산이 첫 화면, 구역 7개, 서비스·계산기 링크는 있는 페이지로, 책 33권·후기 2건·카카오톡 버튼", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "index.html"), "utf8");
  for (const id of ["h-hero", "h-svc", "h-up", "h-books", "h-how", "h-faq", "h-loc"]) assert.match(h, new RegExp(`id="${id}"`), id);
  for (const m of h.matchAll(/href="\/services\/([a-z-]+)"/g)) assert.ok(existsSync(join(DIST, "services", `${m[1]}.html`)), m[1]);
  for (const m of h.matchAll(/href="\/calculators\/([a-z-]+)"/g)) assert.ok(existsSync(join(DIST, "calculators", `${m[1]}.html`)), m[1]);
  assert.match(h, /data-dlcalc/);
  assert.match(h, /책 33권/);
  assert.equal((h.match(/class="card rv"/g) || []).length, 2);
  assert.match(h, /class="btn btn-kakao"/);
  // 기한 계산 자료의 근거 조문이 화면 자료에 그대로 실린다
  const dl = JSON.parse(readFileSync(new URL("../src/data/deadlines.json", import.meta.url), "utf8"));
  for (const e of dl.events) assert.ok(h.includes(e.law), e.id);
});

test("서비스 페이지 기한 계산: calcEvents가 있는 서비스만, 그 일만", { skip: !has }, () => {
  const svcs = JSON.parse(readFileSync(new URL("../src/data/services.json", import.meta.url), "utf8")).services;
  for (const s of svcs) {
    const h = readFileSync(join(DIST, "services", `${s.slug}.html`), "utf8");
    assert.equal(h.includes("data-dlcalc"), !!s.calcEvents, s.slug);
  }
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

test("마무리 띠: 404 말고 모든 페이지에 하나(홈도 — 2026-10-24 2차 개편 \"하나 더 물어보세요\" 통일), 불복 서비스는 기한 문구", { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) {
    const h = readFileSync(f, "utf8");
    const n = (h.match(/class="closing /g) || []).length;
    const expect = /\/404\.html$/.test(f) ? 0 : 1;
    assert.equal(n, expect, f);
  }
  assert.match(readFileSync(join(DIST, "services", "appeal.html"), "utf8"), /id="h-closing"[^>]*>기한이 있는 일입니다</);
  assert.match(readFileSync(join(DIST, "index.html"), "utf8"), /id="h-closing"[^>]*>하나 더 물어보세요</);
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

test("기한 달력(2026-10-24): 홈·서비스 계산 카드에서 이어지고, 자바스크립트 없이도 안내가 있다", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "deadline.html"), "utf8");
  assert.match(h, /<noscript>[\s\S]*홈의 기한 계산/);
  assert.match(h, /data-ics/);
  assert.match(h, /data-dc-data/);
  for (const f of ["index.html", "services/inheritance-gift.html", "services/real-estate.html", "services/appeal.html"]) {
    assert.match(readFileSync(join(DIST, f), "utf8"), /href="\/deadline" data-cal/, f);
  }
});

test("올해 세금 달력(2026-10-24 3차): 12달 × 두 해, 근거 조문, 자바스크립트 없이도 달력이 보인다", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "tax-calendar.html"), "utf8");
  assert.equal((h.match(/class="tc-mon"/g) || []).length, 24);
  assert.match(h, /국세기본법 제5조 제1항/);
  assert.match(readFileSync(join(DIST, "index.html"), "utf8"), /href="\/tax-calendar"/);
});

test("상황 길잡이: 상황마다 결과 묶음 · 법인 묶음 · 근거 조문 · 참고용 문구", { skip: !has }, () => {
  const html = readFileSync(join(DIST, "guide.html"), "utf8");
  const guide = JSON.parse(readFileSync("src/data/guide.json", "utf8"));
  for (const g of guide.situations) {
    assert.match(html, new RegExp(`data-panel="${g.id}"`), g.id);
    if (!g.services.includes("corporate")) assert.match(html, new RegExp(`data-panel="${g.id}-corp"`), `${g.id}-corp`);
  }
  assert.match(html, /근거 상속세 및 증여세법 제67조/);
  assert.match(html, /계산 결과는 참고용입니다/);
  assert.match(html, /보내는 것은 고른 상황과 날짜가 담긴 주소뿐입니다/);
  assert.match(html, /href="\/deadline\?e=inherit"/);
});

test("사이트 찾기: search.json · 머리글 찾기·글자 크게 · 질문 자리 id", { skip: !has }, () => {
  const j = JSON.parse(readFileSync(join(DIST, "search.json"), "utf8"));
  assert.ok(j.items.length > 40);
  assert.ok(j.items.some((i) => i.u.startsWith("/faq#q-")));
  const home = readFileSync(join(DIST, "index.html"), "utf8");
  assert.match(home, /id="sx"/);
  assert.match(home, /id="fsBtn"[^>]*aria-pressed="false"/);
  assert.match(home, /localStorage\.getItem\("fs"\)/);
  for (const i of j.items.filter((x) => x.u.startsWith("/faq#"))) assert.match(readFileSync(join(DIST, "faq.html"), "utf8"), new RegExp(`id="${i.u.slice(5)}"`));
});

test("상담 준비 꾸러미: 서비스마다 prepare 목록이 체크 칸으로 · 이 기기에만 안내", { skip: !has }, () => {
  const svc = JSON.parse(readFileSync("src/data/services.json", "utf8")).services;
  for (const sv of svc) {
    const h = readFileSync(join(DIST, `services/${sv.slug}.html`), "utf8");
    assert.match(h, new RegExp(`data-pk="${sv.slug}"`), sv.slug);
    for (const t of sv.prepare) assert.ok(h.includes(`value="${t.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`), `${sv.slug}: ${t}`);
    assert.match(h, /챙긴 표시는 이 기기에만 남고/);
  }
});
