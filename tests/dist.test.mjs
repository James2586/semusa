// npm run build 뒤에 돌린다. 만들어진 페이지가 설계서 규칙을 지키는지 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAME_TITLE_RE } from "../scripts/validate-data.mjs";

const DIST = new URL("../dist/", import.meta.url).pathname;
const has = existsSync(DIST);

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "_astro" ? [] : htmlFiles(p);
    return f.endsWith(".html") ? [p] : [];
  });
}

test("페이지 45개(색인 41 + 공지·개인정보·오프라인 + 404)", { skip: !has }, () => {
  assert.equal(htmlFiles(DIST).length, 45);
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

test('대표 이름 앞·뒤에 "세무사"가 붙은 곳이 어느 페이지에도 없다(2026-10-28 운영자 — 이름과 떨어진 「세무사」는 괜찮음)', { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) assert.doesNotMatch(readFileSync(f, "utf8"), NAME_TITLE_RE, f);
});

test('"세무회계" 단어가 어느 페이지·매니페스트·검색 목록에도 없다(2026-10-25 운영자)', { skip: !has }, () => {
  for (const f of [...htmlFiles(DIST), join(DIST, "manifest.webmanifest"), join(DIST, "search.json"), join(DIST, "rss.xml")]) assert.ok(!readFileSync(f, "utf8").includes("세무회계"), f);
});

test("공지·개인정보·404는 noindex이고 sitemap에 없다", { skip: !has }, () => {
  for (const p of ["notice.html", "privacy.html", "404.html"]) {
    assert.match(readFileSync(join(DIST, p), "utf8"), /<meta name="robots" content="noindex"/, p);
  }
  const sm = readFileSync(join(DIST, "sitemap-0.xml"), "utf8");
  assert.equal((sm.match(/<loc>/g) || []).length, 41);
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
    const expect = /\/(404|offline)\.html$/.test(f) ? 0 : 1; // 오프라인 안내: 카카오톡은 인터넷이 있어야 열림
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
  // 칼럼·책의 「영상 보기」는 그 영상이 실제로 있는 쪽으로 간다(2026-10-28 stockval이 /about에 없어 눌러도 안 나왔음)
  const vids = JSON.parse(readFileSync(new URL("../src/data/videos.json", import.meta.url), "utf8")).videos;
  for (const v of vids) {
    const href = `${v.page ?? "/about"}#video-${v.id}`;
    assert.ok(h.includes(`href="${href}"`), `칼럼·책 영상 카드 링크 ${href} 없음`);
    const page = readFileSync(join(DIST, `${(v.page ?? "/about").slice(1)}.html`), "utf8");
    assert.ok(page.includes(`id="video-${v.id}"`), `${v.page ?? "/about"}에 영상 ${v.id} 없음 — 칼럼·책에서 눌러도 영상이 안 나옴`);
  }
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

test("용어 풀이: 용어마다 자리·원문·근거 조문 · 찾기 목록에 용어", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "glossary.html"), "utf8");
  const g = JSON.parse(readFileSync("src/data/glossary.json", "utf8"));
  for (const t of g.terms) {
    assert.match(h, new RegExp(`id="g-${t.id}"`), t.id);
    assert.ok(h.includes(t.law.replace(/&/g, "&amp;")), t.law);
  }
  assert.match(h, /출처 법제처 국가법령정보/);
  const j = JSON.parse(readFileSync(join(DIST, "search.json"), "utf8"));
  assert.equal(j.items.filter((i) => i.k === "용어").length, g.terms.length);
});

test("오프라인: sw.js가 미리 저장하는 쪽이 실제로 있고, 모든 쪽이 등록 · 오프라인 안내는 색인 밖", { skip: !has }, () => {
  const sw = readFileSync(join(DIST, "sw.js"), "utf8");
  const pre = JSON.parse(sw.match(/const PRECACHE = (\[[^\]]+\])/)[1]);
  assert.deepEqual(pre, ["/deadline", "/tax-calendar", "/offline"]);
  for (const u of pre) assert.ok(existsSync(join(DIST, `${u.slice(1)}.html`)), u);
  assert.match(sw, /url\.origin !== location\.origin\) return/); // 다른 사이트(계산기·카카오)는 건드리지 않음
  assert.match(readFileSync(join(DIST, "about.html"), "utf8"), /serviceWorker\.register\("\/sw\.js"\)/);
  assert.doesNotMatch(readFileSync(join(DIST, "sitemap-0.xml"), "utf8"), /offline/);
  assert.match(readFileSync(join(DIST, "offline.html"), "utf8"), /name="robots" content="noindex"/);
});

test("주제 모아 보기: 주제마다 기한·용어·계산기·서비스 · 근거 조문 · 찾기 목록", { skip: !has }, () => {
  const T = JSON.parse(readFileSync("src/data/topics.json", "utf8")).topics;
  const dl = JSON.parse(readFileSync("src/data/deadlines.json", "utf8"));
  const g = JSON.parse(readFileSync("src/data/glossary.json", "utf8")).terms;
  for (const t of T) {
    const h = readFileSync(join(DIST, `topics/${t.slug}.html`), "utf8");
    for (const id of [...t.events, ...t.yearly]) { const e = [...dl.events, ...dl.yearly].find((x) => x.id === id); assert.ok(h.includes(e.law), `${t.slug}: ${e.law}`); }
    for (const id of t.glossary) assert.match(h, new RegExp(`href="/glossary#g-${id}"`), `${t.slug}: ${id}`);
    for (const c of t.calculators) assert.match(h, new RegExp(`href="/calculators/${c}"`), `${t.slug}: ${c}`);
    for (const s of t.services) assert.match(h, new RegExp(`href="/services/${s}"`), `${t.slug}: ${s}`);
    if (t.calculators.length) assert.match(h, /결과는 참고용입니다/);
  }
  const j = JSON.parse(readFileSync(join(DIST, "search.json"), "utf8"));
  assert.equal(j.items.filter((i) => i.k === "주제").length, T.length);
  assert.match(readFileSync(join(DIST, "topics.html"), "utf8"), /href="\/topics\/appeal"/);
});

test("상담 요청 글: 길잡이·기한 달력에 붙고, 이 기기 안에서만이라는 안내 · 저장소에 쓰지 않음", { skip: !has }, () => {
  for (const f of ["guide.html", "deadline.html"]) {
    const h = readFileSync(join(DIST, f), "utf8");
    assert.match(h, /data-cn-text/, f);
    assert.match(h, /이 글은 이 기기 안에서만 만들고, 사이트는 받거나 저장하지 않습니다/, f);
    assert.match(h, /href="mailto:[^"]+"[^>]*data-cn-mail/, `${f}: 이메일로 보내기`);
  }
  assert.doesNotMatch(readFileSync("src/components/ConsultNote.astro", "utf8"), /localStorage|sessionStorage|fetch\(/);
});

test("불복 절차: 흐름도(단계·기한 칩)·표·원문 접힘이 세무조사·불복 쪽에만, 자동 재생 없음", { skip: !has }, () => {
  const A = JSON.parse(readFileSync("src/data/appeal.json", "utf8"));
  const h = readFileSync(join(DIST, "services/appeal.html"), "utf8");
  for (const r of A.rows) { assert.match(h, new RegExp(`<th scope="row"[^>]*>${r.stage}</th>`), r.stage); assert.ok(h.includes(r.law), r.law); }
  for (const f of [...A.flow, ...A.refundFlow]) if (f.edge) assert.ok(h.includes(f.edge), f.edge);
  assert.equal((h.match(/<button[^>]*data-af-play/g) || []).length, 2, "불복 길·경정청구 길 흐름도 두 개");
  assert.match(h, /data-af-play/);
  assert.match(h, /법조문 원문 보기/);
  assert.doesNotMatch(readFileSync(join(DIST, "services/inheritance-gift.html"), "utf8"), /data-af-play|class="ap-t/);
  // 따라가기는 누를 때만 — 쪽을 열자마자 타이머를 걸지 않는다
  assert.doesNotMatch(readFileSync("src/components/AppealFlow.astro", "utf8").split("<script>")[1], /^\s*(setInterval|setTimeout)/m);
});

test("세금 생애 지도: 정거장마다 펼침 단추·내용(기한 근거·계산기·용어) · 첫 화면 맛보기 링크", { skip: !has }, () => {
  const L = JSON.parse(readFileSync("src/data/lifemap.json", "utf8"));
  const G = Object.fromEntries(JSON.parse(readFileSync("src/data/guide.json", "utf8")).situations.map((s) => [s.id, s]));
  const dl = JSON.parse(readFileSync("src/data/deadlines.json", "utf8"));
  const h = readFileSync(join(DIST, "life.html"), "utf8");
  for (const s of [...L.stops, ...L.anytime]) {
    assert.match(h, new RegExp(`id="lm-b-${s.id}"[^>]*aria-controls="lm-p-${s.id}"`), s.id);
    const g = G[s.guide];
    if (g.event) assert.ok(h.includes(dl.events.find((e) => e.id === g.event).law), `${s.id}: event law`);
    for (const y of g.yearly || []) assert.ok(h.includes(dl.yearly.find((e) => e.id === y).law), `${s.id}: ${y}`);
    for (const c of g.calculators) assert.match(h, new RegExp(`href="/calculators/${c}"`), `${s.id}: ${c}`);
    for (const t of s.glossary) assert.match(h, new RegExp(`href="/glossary#g-${t}"`), `${s.id}: ${t}`);
  }
  assert.equal((h.match(/class="lm-panel"[^>]*hidden/g) || []).length, L.stops.length + L.anytime.length - 1); // 처음엔 하나만 펼침
  const home = readFileSync(join(DIST, "index.html"), "utf8");
  for (const s of L.stops) assert.match(home, new RegExp(`href="/life#${s.id}"`));
});

test("세율·공제 한눈에: 고른 조문마다 원문 줄·표 칸이 그대로 · 출처 · 계산기·주제 쪽에서 잇기", { skip: !has }, () => {
  const R = JSON.parse(readFileSync("src/data/rates.json", "utf8"));
  const S = JSON.parse(readFileSync("docs/rates-sources.json", "utf8")).items;
  const h = readFileSync(join(DIST, "rates.html"), "utf8");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  for (const sec of R.sections) {
    assert.match(h, new RegExp(`id="r-${sec.id}"`));
    for (const g of sec.groups) for (const it of g.items) {
      const a = S[it.src];
      assert.ok(h.includes(`법률 제${a.promulgationNo}호`), it.src);
      for (const c of sec.calculators) assert.match(readFileSync(join(DIST, `calculators/${c}.html`), "utf8"), new RegExp(`href="/rates#r-${sec.id}"`), `${c} → ${sec.id}`);
    }
  }
  for (const cell of ["과세표준의 100분의 10", "10억4천만원 + (30억원을 초과하는 금액의 100분의 50)", "3억8,406만원 + (10억원을 초과하는 금액의 45퍼센트)", "1억5천200만원+(94억원을 초과하는 금액의 1천분의 27)", "과세표준의 100분의 9"]) assert.ok(h.includes(esc(cell)), cell);
  assert.match(h, /https:\/\/www\.law\.go\.kr\/법령\/상속세및증여세법\/\(21065,20251001\)\/제26조/);
  assert.doesNotMatch(h, /┌|│|┘/); // 선 문자가 그대로 남지 않음
  assert.match(readFileSync(join(DIST, "topics/transfer.html"), "utf8"), /href="\/rates#r-transfer"/);
});

test("구조화 데이터: 모든 JSON-LD가 읽히고, 위치 표시가 있는 쪽엔 BreadcrumbList · 서비스·책·칼럼 · RSS", { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) {
    const h = readFileSync(f, "utf8");
    const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const types = blocks.flatMap((b) => (Array.isArray(b) ? b : [b])).map((b) => b["@type"]);
    assert.ok(types.includes("AccountingService"), f);
    if (/class="crumb"/.test(h)) {
      const bc = blocks.flat().find((b) => b["@type"] === "BreadcrumbList");
      assert.ok(bc, `${f}: BreadcrumbList`);
      assert.equal(bc.itemListElement[0].item, "https://semusatax.vercel.app/");
      bc.itemListElement.forEach((e, i) => { assert.equal(e.position, i + 1); assert.match(e.item, /^https:\/\/semusatax\.vercel\.app\//); });
    }
  }
  assert.match(readFileSync(join(DIST, "services/appeal.html"), "utf8"), /"@type":"Service"/);
  const col = readFileSync(join(DIST, "columns.html"), "utf8");
  assert.match(col, /"@type":"Book"/);
  assert.match(col, /"@type":"Article"/);
  const rss = readFileSync(join(DIST, "rss.xml"), "utf8");
  const press = JSON.parse(readFileSync("src/data/press.json", "utf8")).articles;
  assert.equal((rss.match(/<item>/g) || []).length, press.length);
  assert.match(rss, /<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} 00:00:00 GMT<\/pubDate>/);
  assert.match(readFileSync(join(DIST, "index.html"), "utf8"), /rel="alternate" type="application\/rss\+xml"/);
});

test("이번 달 마감 띠: 모든 쪽에(머리글 바로 아래) · 기한은 deadlines.json yearly 이름 그대로 · 그리기 전 채우는 작은 스크립트", { skip: !has }, () => {
  const names = new Set(JSON.parse(readFileSync("src/data/deadlines.json", "utf8")).yearly.map((y) => y.name));
  for (const f of htmlFiles(DIST)) {
    const h = readFileSync(f, "utf8");
    const iH = h.indexOf("</header>"), iB = h.indexOf("data-mband hidden"), iM = h.indexOf("<main");
    assert.ok(iH > 0 && iH < iB && iB < iM, `${f}: 머리글 뒤·본문 앞`);
    const occ = JSON.parse(h.match(/data-mband-data>([^<]*)</)[1]);
    assert.ok(occ.length >= 12, f); // 매달 원천세만으로도 1년 12번
    for (const [iso, wd, name, known] of occ) { assert.match(iso, /^\d{4}-\d{2}-\d{2}$/); assert.match(wd, /^[월화수목금]$/, `${iso} ${wd}`); assert.ok(names.has(name), name); assert.ok(known === 0 || known === 1); }
  }
});

test("원문 기준일: 옮겨 둔 원문마다 법률 번호·받은 날 · 기한 근거 조문 · 감시 작업은 --check로 둘 다 대조", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "sources.html"), "utf8");
  for (const f of ["docs/glossary-sources.json", "docs/rates-sources.json"]) for (const a of Object.values(JSON.parse(readFileSync(f, "utf8")).items)) {
    assert.ok(h.includes(`법률 제${a.promulgationNo}호`), `${a.law} ${a.article}`);
    assert.ok(h.includes(a.fetchedAt.split("-").map(Number).join(". ") + "."), a.fetchedAt);
  }
  for (const y of JSON.parse(readFileSync("src/data/deadlines.json", "utf8")).yearly) assert.ok(h.includes(y.law), y.law);
  const wf = readFileSync(".github/workflows/law-watch.yml", "utf8");
  assert.match(wf, /make-glossary-sources\.mjs tax-search\/tests\/fixtures --check/);
  assert.match(wf, /make-rates-sources\.mjs tax-search\/tests\/fixtures --check/);
  assert.match(wf, /make-faq-sources\.mjs tax-search\/tests\/fixtures --check/);
  assert.match(wf, /TAX_SEARCH_TOKEN/);
});

test("세율 쪽: 법제처 링크는 그 판으로 · 판 이름표는 원문 메타 · 빠진 항 알림 · 부칙은 같은 판", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "rates.html"), "utf8");
  assert.match(h, /https:\/\/www\.law\.go\.kr\/법령\/법인세법\/\(21065,20251001\)\/제55조/);
  assert.match(h, /https:\/\/www\.law\.go\.kr\/법령\/법인세법\/\(21217,20251223\)\/제55조/);
  assert.match(h, /법률 제21217호\(2025\. 12\. 23\. 공포\) 판 — 지금 판/);
  assert.match(h, /법률 제21065호\(2025\. 10\. 1\. 공포\) 판</);
  assert.doesNotMatch(h, /20613/); // 바로 앞 판엔 그 판 세율의 적용례가 아닌 부칙을 붙이지 않음
  assert.match(h, /같은 조 ②은\(는\) 이 쪽에 옮기지 않았습니다/); // 상증법 §22②
  assert.doesNotMatch(h, /부칙\(법률 제\d+호, \d{8}\)/); // 날짜는 읽는 꼴로
});

test("첫 화면 가벼움(6차 A): 그려 둔 요소 1,000개 이하 · 자릿수 바퀴 칸은 쉬는 상태에 그리지 않음", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  const n = (h.match(/<[a-zA-Z][^>]*>/g) || []).length;
  assert.ok(n <= 1000, `첫 화면 요소 ${n}개`);
  // 「매년 돌아오는 날」은 쉬는 상태에서 숫자 글자만 — 바퀴(20칸)는 화면에 들어올 때 잠깐만 만든다
  const up = readFileSync(new URL("../src/components/UpcomingDeadlines.astro", import.meta.url), "utf8");
  assert.match(up, /dd\.textContent = label/);
  assert.match(up, /function spin\(\)/);
});

test("이 사이트가 일하는 방식(6차 B): 원칙·기한 계산 단계(근거 조문)·원문 수·측정값·둘러보기 · 바닥글·소개 쪽에서 잇기", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "how.html"), "utf8");
  for (const s of ["법조문은 원문 그대로", "계산은 과정까지", "민법 제157조", "민법 제160조", "국세기본법 제5조 제1항", "상속세 및 증여세법 제68조", "Lighthouse", "3분 둘러보기", "/deadline?e=gift&amp;d=2026-11-10"]) assert.ok(h.includes(s), s);
  // 용어 풀이·세율·질문이 옮겨 둔 원문 — 같은 조문(같은 판)은 한 번만
  const all = ["glossary", "rates", "faq"].flatMap((k) => Object.values(JSON.parse(readFileSync(new URL(`../docs/${k}-sources.json`, import.meta.url), "utf8")).items));
  const n = new Set(all.map((a) => `${a.law}|${a.article}|${a.promulgationNo}`)).size;
  assert.ok(h.includes(`옮겨 둔 법조문 ${n}조문`), String(n));
  assert.match(readFileSync(join(DIST, "index.html"), "utf8"), /href="\/how"/);
  assert.match(readFileSync(join(DIST, "about.html"), "utf8"), /href="\/how"/);
});

test("부기(6차 C): 한 쪽에 한 마리 이하 · 장식(alt 빈칸) · 기한 달력·계산기·길잡이·세율·404에 · 오프라인은 「연결 안 됨」 그림을 쪽 안에", { skip: !has }, () => {
  for (const f of htmlFiles(DIST)) {
    const h = readFileSync(f, "utf8");
    const n = (h.match(/class="buki[ "]/g) || []).length;
    assert.ok(n <= 1, `${f}: 부기 ${n}마리`);
    for (const m of h.matchAll(/<img class="buki[^>]*>/g)) assert.match(m[0], /alt=""/, f);
  }
  for (const [p, pose] of [["deadline.html", "deadline"], ["calculators/index.html", "calculated"], ["guide.html", "found"], ["rates.html", "warning"], ["404.html", "default"]]) {
    const file = existsSync(join(DIST, p)) ? join(DIST, p) : join(DIST, p.replace("/index.html", ".html"));
    assert.match(readFileSync(file, "utf8"), new RegExp(`/img/buki/buki-${pose}-200\\.webp`), p);
  }
  const off = readFileSync(join(DIST, "offline.html"), "utf8");
  assert.match(off, /class="off-buki"[^>]*>\s*<svg/);
  assert.doesNotMatch(off, /\/img\/buki\/buki-offline\.svg/);
});

test("자주 묻는 질문 20개(6차 D): 근거 조문·원문 접힘 · 분야 칩 · 첫 화면은 분야마다 하나 · 질문 구조화 데이터 20개", { skip: !has }, () => {
  const h = readFileSync(join(DIST, "faq.html"), "utf8");
  assert.equal((h.match(/<details data-cat=/g) || []).length, 20);
  assert.ok((h.match(/법조문 원문 보기/g) || []).length >= 17);
  for (const c of ["상속", "증여", "양도", "취득·보유", "법인·기장", "불복"]) assert.match(h, new RegExp(`data-cat="${c}"`), c);
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1])].flat()).find((j) => j["@type"] === "FAQPage");
  assert.equal(ld.mainEntity.length, 20);
  const home = readFileSync(join(DIST, "index.html"), "utf8").split('id="h-faq"')[1].split("</section>")[0];
  assert.equal((home.match(/<details data-cat=/g) || []).length, 6);
});

test("오시는 길 카카오 지도: 숨긴 칸만 그려 두고 SDK는 보일 때 스크립트가 · 끌기·휠 잡지 않음 · 처리방침 안내", { skip: !has }, () => {
  for (const f of ["location.html", "index.html"]) {
    const h = readFileSync(join(DIST, f), "utf8");
    assert.match(h, /<div[^>]*data-kmap[^>]*hidden/, f);
    assert.doesNotMatch(h, /<script[^>]*src="https:\/\/dapi\.kakao\.com/, f); // 처음부터 받지 않음
    assert.match(h, /href="https:\/\/map\.kakao\.com\/[^"]*"/, f); // 지도 못 그려도 버튼은 남음
  }
  const src = readFileSync(new URL("../src/components/LocationBlock.astro", import.meta.url), "utf8");
  assert.match(src, /draggable: false/);
  assert.match(src, /scrollwheel: false/);
  assert.match(src, /IntersectionObserver/);
  assert.match(readFileSync(join(DIST, "privacy.html"), "utf8"), /카카오 지도/);
});
