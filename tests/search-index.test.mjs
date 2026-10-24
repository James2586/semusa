// 사이트 찾기(2026-10-24 3차 A2): 목록 만들기·거르기
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSearchIndex, searchItems, faqId, norm } from "../src/lib/searchIndex.js";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const svc = read("src/data/services.json"), calc = read("src/data/calculators.json"), dl = read("src/data/deadlines.json"), guide = read("src/data/guide.json"), press = read("src/data/press.json");
const items = buildSearchIndex({ services: svc.services, calculators: calc.calculators, events: dl.events, yearly: dl.yearly, situations: guide.situations, articles: press.articles,
  faqs: [{ q: "상속세는 언제까지 신고하나요?", category: "상속", order: 1, law: "상속세 및 증여세법 제67조", id: "q-inheritance-deadline", body: "상속개시일이 속하는 달의 말일부터 **6개월 안**에 신고합니다." }] });

test("줄임말로도 걸린다: 양도세 → 양도소득세 계산기, 종부세 → 종합부동산세", () => {
  assert.ok(searchItems(items, "양도세").some((i) => i.u === "/calculators/transfer"));
  assert.ok(searchItems(items, "종부세").some((i) => i.u === "/calculators/jongbu"));
});
test("띄어쓰기 무시 · 낱말 모두 들어 있어야(그리고) · 제목에 든 것이 앞", () => {
  const r = searchItems(items, "상속 기한");
  assert.ok(r.length > 0);
  assert.ok(r.every((i) => /상속/.test(norm([i.t, i.d, i.x].join(""))) && /기한/.test(norm([i.t, i.d, i.x].join("")))));
  assert.ok(/상속/.test(r[0].t));
  assert.deepEqual(searchItems(items, "상속세신고").map((i) => i.u), searchItems(items, "상속세 신고").filter((i) => norm(i.t + i.d + i.x).includes("상속세신고")).map((i) => i.u));
});
test("질문은 /faq#자리, 칼럼은 새 창, 빈 검색은 빈 목록", () => {
  const f = searchItems(items, "6개월").find((i) => i.k === "자주 묻는 질문");
  assert.equal(f.u, "/faq#q-inheritance-deadline");
  assert.doesNotMatch(f.d, /\*\*/);
  assert.ok(items.filter((i) => i.k === "칼럼").every((i) => i.ext && /^https:/.test(i.u)));
  assert.deepEqual(searchItems(items, "   "), []);
});
test("faqId는 파일 앞 번호를 뗀다", () => {
  assert.equal(faqId("../content/faq/01-inheritance-deadline.md"), "q-inheritance-deadline");
});
test("줄임말 검색: 정식 이름이 제목에 든 계산기가 칼럼보다 앞", () => {
  const r = searchItems(items, "양도세");
  assert.equal(r[0].k === "칼럼", false, r.map((i) => i.t).join(" / "));
  assert.ok(r.findIndex((i) => i.u === "/calculators/transfer") < r.findIndex((i) => i.k === "칼럼"));
});
