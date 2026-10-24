// 법조문 원문 대조(2026-10-24 5차 A3): 받은 날만 다르면 바뀜이 아니고, 글자·법률 번호가 다르면 바뀜
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSources } from "../scripts/lib/sourceCheck.mjs";

const base = { a: { law: "상속세 및 증여세법", article: "제26조", title: "상속세 세율", promulgationNo: "21065", fetchedAt: "2026-10-22", lines: [{ d: 1, t: "원문" }] } };
test("받은 날만 다르면 바뀐 곳 없음", () => {
  assert.deepEqual(diffSources(base, { a: { ...base.a, fetchedAt: "2026-11-02" } }), []);
});
test("원문 글자·법률 번호·조문이 생기거나 사라지면 알림", () => {
  const d = diffSources(base, { a: { ...base.a, promulgationNo: "22000", lines: [{ d: 1, t: "바뀐 원문" }] }, b: { ...base.a, article: "제56조" } });
  assert.equal(d.length, 3);
  assert.match(d.join("\n"), /promulgationNo 21065 → 22000/);
  assert.match(d.join("\n"), /원문 1줄 달라짐/);
  assert.match(d.join("\n"), /새로 생김/);
  assert.match(diffSources(base, {}).join(""), /사라짐/);
});
