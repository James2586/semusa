// 용어 풀이(2026-10-24 3차 C3): 인용 원문 대조·풀이 숫자 대조가 실제로 막는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkGlossary } from "../scripts/validate-data.mjs";

const text = readFileSync("src/data/glossary.json", "utf8"), src = readFileSync("docs/glossary-sources.json", "utf8");
const data = JSON.parse(text);

test("지금 자료는 통과 · 용어 15개 이상 · 법 이름은 원문 그대로", () => {
  assert.deepEqual(checkGlossary(text, src), []);
  assert.ok(data.terms.length >= 15);
});
test("원문에 없는 인용을 막는다", () => {
  const d = structuredClone(data);
  d.terms[0].quotes[0].text = d.terms[0].quotes[0].text.replace("유상으로", "무상으로");
  assert.match(checkGlossary(JSON.stringify(d), src).join("\n"), /글자 그대로 없습니다/);
});
test("풀이에 원문에 없는 숫자를 넣으면 막는다", () => {
  const d = structuredClone(data);
  const t = d.terms.find((x) => x.id === "gift-deduction");
  t.plain = t.plain.replace("6억원", "7억원");
  assert.match(checkGlossary(JSON.stringify(d), src).join("\n"), /"7억"/);
  const p = d.terms.find((x) => x.id === "pre-assessment");
  p.plain = p.plain.replace("30일", "60일");
  assert.match(checkGlossary(JSON.stringify(d), src).join("\n"), /"60"/);
});
test("원문 근거 파일: 조문마다 시행일·확인일·법제처 원문 줄", () => {
  const s = JSON.parse(src).items;
  for (const [id, v] of Object.entries(s)) {
    assert.match(v.effectiveDate || "", /^\d{8}$/, id);
    assert.match(v.fetchedAt || "", /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(v.lines.length > 0, id);
  }
});
