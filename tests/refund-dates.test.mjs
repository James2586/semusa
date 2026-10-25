// 경정청구 날짜 계산(2026-10-25): 세금 종류는 appeal.json refundCalc → deadlines.json 규칙, 기간은 국세기본법 제45조의2 ①·③
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeRefundDates } from "../src/lib/refundDates.js";

const A = JSON.parse(readFileSync(new URL("../src/data/appeal.json", import.meta.url), "utf8"));
const D = JSON.parse(readFileSync(new URL("../src/data/deadlines.json", import.meta.url), "utf8"));
const T = Object.fromEntries(A.refundCalc.taxes.map((t) => [t.id, t]));
const today = new Date(2026, 9, 25);

test("세금 종류는 deadlines.json에 있는 규칙만", () => {
  for (const t of A.refundCalc.taxes) {
    const [k, id] = t.from.split(":");
    assert.ok((k === "yearly" ? D.yearly : D.events).some((x) => x.id === id), t.from);
    if (t.alt) assert.ok(t.alt.law && /^\d\d-\d\d$/.test(t.alt.md));
  }
  assert.equal(A.rows.find((r) => r.stage === A.refundCalc.row).law, "국세기본법 제45조의2 제1항·제2항·제3항");
});

test("2025년 종합소득세: 5. 31.(일) → 6. 1., 5년 → 2031. 6. 2.(6. 1. 일요일), 9. 1. 청구 → 11. 1., 11. 2.부터 불복, 10. 15. 거부 → 2027. 1. 13.", () => {
  const r = computeRefundDates(T.income, D, { year: 2025, claimIso: "2026-09-01", refusalIso: "2026-10-15" }, { today });
  assert.equal(r.legal.iso, "2026-06-01");
  assert.equal(r.claimEnd.iso, "2031-06-02");
  assert.equal(r.claim.twoMonths.iso, "2026-11-01");
  assert.equal(r.claim.appealFrom.iso, "2026-11-02");
  assert.equal(r.refusal.deadline.iso, "2027-01-13");
});

test("성실신고확인 6. 30. · 법인세 · 부가세 1기·2기 · 증여세 · 상속세(외국 9개월)", () => {
  assert.equal(computeRefundDates(T.income, D, { year: 2025, alt: true }, { today }).legal.iso, "2026-06-30");
  assert.equal(computeRefundDates(T.corp, D, { year: 2025 }, { today }).legal.iso, "2026-03-31");
  assert.equal(computeRefundDates(T.vat1, D, { year: 2026 }, { today }).legal.iso, "2026-07-27"); // 7. 25. 토요일
  const v2 = computeRefundDates(T.vat2, D, { year: 2020 }, { today });
  assert.equal(v2.legal.iso, "2021-01-25");
  assert.equal(v2.claimEnd.iso, "2026-01-26"); // 2026. 1. 25. 일요일
  assert.ok(v2.claimEnd.dday < 0);
  const g = computeRefundDates(T.gift, D, { dateIso: "2026-03-10" }, { today });
  assert.equal(g.legal.iso, "2026-06-30");
  assert.equal(g.claimEnd.iso, "2031-06-30");
  assert.equal(computeRefundDates(T.inherit, D, { dateIso: "2026-01-15", abroad: true }, { today }).legal.iso, "2026-11-02"); // 1. 31.부터 9개월 = 10. 31.(토)
});

test("빈 값·잘못된 해는 계산하지 않음 · 마감 뒤 청구 표시", () => {
  assert.equal(computeRefundDates(T.income, D, { year: "" }, { today }), null);
  assert.equal(computeRefundDates(T.gift, D, { dateIso: "" }, { today }), null);
  assert.equal(computeRefundDates(T.income, D, { year: 2018, claimIso: "2026-01-02" }, { today }).claim.late, true);
});
