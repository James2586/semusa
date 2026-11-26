import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSearchItems, classifyColumn, mergePress } from "../src/lib/pressFeed.js";

const press = JSON.parse(readFileSync("src/data/press.json", "utf8"));
const svc = new Set(JSON.parse(readFileSync("src/data/services.json", "utf8")).services.map((s) => s.slug));
const calc = new Set(JSON.parse(readFileSync("src/data/calculators.json", "utf8")).calculators.map((c) => c.slug));

// 이코노미조선 검색 목록 자료의 모양(2026-11-26 실제 응답에서 줄임)
const SAMPLE = {
  total_page: 1,
  items: [
    { link: "https://economychosun.com/site/data/html_dir/2026/11/30/2026113000011.html", title: "장특공 믿고 버텼다간 &#39;한도 폭탄&#39;", subtitle: "성광호의 세무 ABC <20>", date: "2026년 11월 30일" },
    { link: "https://economychosun.com/site/data/html_dir/2026/11/09/2026110900025.html", title: "10년 보유도 공제 0원? 종부세 개편, 은퇴자 1주택자 '뒤통수'", subtitle: "성광호의 세무 ABC <19>", date: "2026년 11월 09일" },
    { link: "https://economychosun.com/site/data/html_dir/2025/05/23/2025052300002.html", title: "다른 사람 글", subtitle: "성공의 조건 <3>", date: "2025년 05월 26일" },
    { link: "https://economychosun.com/site/data/html_dir/2024/11/01/2024110100001.html", title: "음모론에 현혹되는 인간에 대한 고찰", subtitle: "BOOKS", date: "2024년 11월 04일" },
  ],
};

test("검색 목록에서 「성광호의 세무 ABC」 연재만 고르고 제목·날짜·주소를 그대로 읽는다", () => {
  const got = parseSearchItems(SAMPLE);
  assert.deepEqual(got.map((a) => a.no), [20, 19]);
  assert.equal(got[0].title, "장특공 믿고 버텼다간 '한도 폭탄'");
  assert.equal(got[0].date, "2026-11-30");
  assert.equal(got[1].url, "https://economychosun.com/site/data/html_dir/2026/11/09/2026110900025.html");
});

test("제목 낱말 분류가 손으로 붙인 기존 연재의 주제와 같다", () => {
  for (const a of press.articles) assert.equal(classifyColumn(a.title).topic, a.topic, a.title);
});

test("분류가 고르는 서비스·계산기는 실제로 있는 것", () => {
  for (const t of [...press.articles.map((a) => a.title), "가족 간 차용증", "ETF 세금", "상가 양도", "없는 낱말"]) {
    const c = classifyColumn(t);
    for (const s of c.services) assert.ok(svc.has(s), s);
    for (const k of c.calculators) assert.ok(calc.has(k), k);
  }
});

test("새 연재만 더하고, 주소가 빈 지면에 같은 회 기사 주소를 잇고, 두 번 돌려도 그대로", () => {
  const base = { ...press, items: press.items.map((i) => ({ ...i })), articles: press.articles.filter((a) => !a.url.includes("2026110900025")) };
  for (const i of base.items) if (i.no === 19 || i.no === 20) delete i.url;
  const found = parseSearchItems(SAMPLE);
  const { press: next, added, linked } = mergePress(base, found);
  assert.deepEqual(added.map((a) => a.no), [20, 19]);
  assert.equal(next.articles[0].url, found[0].url);
  assert.equal(next.articles[0].topic, "양도");
  assert.deepEqual(linked.map((l) => l.no).sort(), [19, 20]);
  assert.equal(next.articles.length, base.articles.length + 2);
  const again = mergePress(next, found);
  assert.equal(again.added.length + again.linked.length, 0);
  assert.equal(base.articles.length, press.articles.length - 1); // 원본은 건드리지 않음
});
