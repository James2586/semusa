// 법조문 선 문자 표 풀기(2026-10-24 5차 A1) — 실제 원문(docs/rates-sources.json)으로
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBox, splitLawLine, pickParagraphs } from "../src/lib/lawTable.js";

const S = JSON.parse(readFileSync("docs/rates-sources.json", "utf8")).items;
const tablesOf = (id) => S[id].lines.flatMap((l) => splitLawLine(l.t)).filter((x) => x.type === "table");

test("상속세 세율표: 5구간, 여러 줄 칸은 이어 붙임, 원문 글자 그대로", () => {
  const [t] = tablesOf("inherit26");
  assert.deepEqual(t.head, ["<과세표준>", "<세 율>"]);
  assert.equal(t.rows.length, 5);
  assert.deepEqual(t.rows[0], ["1억원 이하", "과세표준의 100분의 10"]);
  assert.deepEqual(t.rows[1], ["1억원 초과 5억원 이하", "1천만원 + (1억원을 초과하는 금액의 100분의 20)"]);
  assert.deepEqual(t.rows[4], ["30억원 초과", "10억4천만원 + (30억원을 초과하는 금액의 100분의 50)"]);
});
test("표의 모든 칸 글은 원문 줄에 (띄어쓰기만 달리) 들어 있다 — 숫자를 지어내지 않음", () => {
  for (const [id, it] of Object.entries(S)) for (const l of it.lines) for (const seg of splitLawLine(l.t)) {
    if (seg.type !== "table") continue;
    const flat = l.t.replace(/\s+/g, "");
    for (const c of [...seg.head, ...seg.rows.flat()]) for (const part of c.split(" ")) assert.ok(flat.includes(part.replace(/\s+/g, "")), `${id}: ${part}`);
  }
});
test("종합소득세율 8구간 · 종부세 2주택 이하 7구간 · 법인세 두 판", () => {
  assert.equal(tablesOf("income55")[0].rows.length, 8);
  assert.equal(tablesOf("jong9")[0].rows.length, 7);
  assert.equal(tablesOf("corp55")[0].rows[0][1], "과세표준의 100분의 10");
  assert.equal(tablesOf("corp55_2025")[0].rows[0][1], "과세표준의 100분의 9");
});
test("계산식 그림(열 없음)은 풀지 않는다 · 항 고르기 · 삭제 줄 빼기", () => {
  assert.deepEqual(parseBox("┌────┐ │a b │ └────┘"), { type: "formula" });
  const f = S.local11.lines.flatMap((l) => splitLawLine(l.t)).filter((x) => x.type === "formula");
  assert.equal(f.length, 2); // 제8호 지분 취득 계산식 · 나목 6억~9억원 세율 계산식
  const p = pickParagraphs(S.income104.lines, ["①"]);
  assert.ok(p[0].t.startsWith("① 거주자의 양도소득세는"));
  assert.ok(p.every((l) => !/삭제</.test(l.t)));
  assert.ok(!p.some((l) => l.t.startsWith("②")));
});
