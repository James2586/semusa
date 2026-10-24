// 첫 화면 신고 기한 계산(src/lib/deadlineCalc.js) — 날짜 규칙은 src/data/deadlines.json(법조문 대조분)만.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeDeadline, nextYearly } from "../src/lib/deadlineCalc.js";
import { buildHolidayIndex } from "../src/lib/ntsDeadline.js";

const data = JSON.parse(readFileSync(new URL("../src/data/deadlines.json", import.meta.url), "utf8"));
const ev = Object.fromEntries(data.events.map((e) => [e.id, e]));
const today = new Date(2026, 9, 24);
const at = (id, iso, o = {}) => computeDeadline(ev[id], iso, { today, ...o });

test("상속세: 돌아가신 달 말일부터 6개월(외국 주소 9개월) — 민법 제160조", () => {
  const r = at("inherit", "2026-10-04");
  assert.equal(r.monthEndIso, "2026-10-31");
  assert.equal(r.rawIso, "2027-04-30");
  assert.equal(r.deadlineIso, "2027-04-30");
  assert.equal(r.dday, 188);
  assert.equal(r.why, "돌아가신 날이 속한 달의 마지막 날부터 6개월");
  assert.equal(at("inherit", "2026-10-04", { abroad: true }).rawIso, "2027-07-31");
  // 8월 말일 → 기산일 9월 1일 + 6개월 → 2027-02-28
  assert.equal(at("inherit", "2026-08-31").rawIso, "2027-02-28");
});

test("증여세 3개월: 마감이 일요일이면 다음 날(국세기본법 §5①)", () => {
  const r = at("gift", "2026-10-04");
  assert.equal(r.rawIso, "2027-01-31");
  assert.equal(r.deadlineIso, "2027-02-01");
  assert.equal(r.shifted[0].reason, "일요일");
  assert.equal(r.dday, 100);
});

test("양도소득세 예정신고 2개월, 취득세 60일(지방세기본법 §24), 불복 90일·과세전적부심사 30일(초일 불산입)", () => {
  assert.equal(at("sell", "2026-10-04").deadlineIso, "2026-12-31");
  const b = at("buy", "2026-10-04");
  assert.equal(b.rawIso, "2026-12-03");
  assert.equal(b.extLaw, "지방세기본법 §24");
  assert.equal(at("notice", "2026-10-04").rawIso, "2027-01-02");
  assert.equal(at("notice", "2026-10-04").deadlineIso, "2027-01-04"); // 토 → 일 → 월
  assert.equal(at("audit", "2026-10-04").rawIso, "2026-11-03");
});

test("공휴일 자료가 있으면 공휴일도 넘기고, 없는 연도는 knownYear:false", () => {
  const hol = buildHolidayIndex([{ year: "2027", days: [{ date: "2027-02-01", name: "가상 공휴일" }] }]);
  const r = computeDeadline(ev.gift, "2026-10-04", { today, holidays: hol });
  assert.equal(r.deadlineIso, "2027-02-02");
  assert.equal(r.knownYear, true);
  assert.equal(at("gift", "2026-10-04").knownYear, false);
});

test("매년 돌아오는 기한: 다음 날짜와 주말 연장", () => {
  const y = Object.fromEntries(data.yearly.map((i) => [i.id, i]));
  assert.equal(nextYearly(y.withholding, { today }).deadlineIso, "2026-11-10");
  assert.equal(nextYearly(y.jongbu, { today }).deadlineIso, "2026-12-15");
  assert.equal(nextYearly(y.vat1, { today }).deadlineIso, "2027-07-26"); // 7/25 일요일
  assert.equal(nextYearly(y.withholding, { today: new Date(2026, 10, 10) }).dday, 0); // 그날(화)이면 D-0
  assert.equal(nextYearly(y.withholding, { today: new Date(2026, 9, 10) }).deadlineIso, "2026-10-12"); // 10일 토 → 월
});

test("기한 자료: 모든 일·하나 더 확인할 것에 근거 조문", () => {
  for (const e of data.events) {
    assert.ok(e.law && e.fact?.text && e.fact?.law && e.why && e.chip && e.dateLabel, e.id);
    assert.ok(e.rule.monthEnd || e.rule.days, e.id);
  }
  for (const i of data.yearly) assert.ok(i.law && i.when && (i.rule.md || i.rule.monthDay), i.id);
});
