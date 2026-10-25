// 자주 묻는 질문 근거 원문(2026-10-25 6차 D)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseSrc, pickLines, faqQuotes, faqNumberGaps } from "../src/lib/faqSources.js";
import { checkFaq, parseFrontmatter } from "../scripts/validate-data.mjs";

const items = JSON.parse(readFileSync(new URL("../docs/faq-sources.json", import.meta.url), "utf8")).items;
const dir = new URL("../src/content/faq/", import.meta.url);
const faqs = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);

test("질문 20개, 4번부터는 근거 원문(src)이 있고 검사를 통과", () => {
  assert.equal(faqs.length, 20);
  for (const [f, t] of faqs) {
    assert.deepEqual(checkFaq(f, t, items), [], f);
    if (Number(parseFrontmatter(t).fm.order) >= 4) assert.ok(parseFrontmatter(t).fm.src, f);
  }
});

test("고른 원문에 「세무사」가 없다(쪽에 그대로 나감)", () => {
  for (const [f, t] of faqs) for (const q of faqQuotes(parseFrontmatter(t).fm.src, items)) for (const l of q.lines) assert.ok(!l.t.includes("세무사"), `${f} ${q.id}`);
});

test("항 고르기는 그 항의 호까지, 호 고르기는 그 줄만", () => {
  const lines = [{ t: "① 가" }, { t: "1. 나" }, { t: "② 다" }, { t: "1. 라" }, { t: "10. 마" }];
  assert.deepEqual(pickLines(lines, ["①"]).map((l) => l.t), ["① 가", "1. 나"]);
  assert.deepEqual(pickLines(lines, ["1."]).map((l) => l.t), ["1. 나", "1. 라"]);
  assert.deepEqual(parseSrc("a ① ②; b 1."), [{ id: "a", marks: ["①", "②"] }, { id: "b", marks: ["1."] }]);
});

test("원문에 없는 숫자는 잡는다 · 링크 주소 속 숫자는 세지 않음", () => {
  const q = faqQuotes("local20 ①", items);
  assert.deepEqual(faqNumberGaps("취득한 날부터 60일 안", q), []);
  assert.deepEqual(faqNumberGaps("취득한 날부터 61일 안", q), ["61일"]);
  assert.deepEqual(faqNumberGaps("취득한 날부터 60개월 안", q), ["60개월"]); // 단위까지 대조
  assert.deepEqual(faqNumberGaps("[기한 달력](/deadline?d=2026-01-01)", q), []);
});
