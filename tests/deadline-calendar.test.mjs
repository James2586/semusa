// 기한 달력(2026-10-24): 계산 결과를 칸으로 옮기기만 하는지, 접힌 달·건너뛴 날·센 날 수가 맞는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeDeadline } from "../src/lib/deadlineCalc.js";
import { planCalendar, deadlineIcs } from "../src/lib/deadlineCalendar.js";
import { buildHolidayIndex } from "../src/lib/ntsDeadline.js";

const data = JSON.parse(readFileSync(new URL("../src/data/deadlines.json", import.meta.url), "utf8"));
const ev = (id) => data.events.find((e) => e.id === id);
const today = new Date(2026, 9, 24);
const hol = buildHolidayIndex([{ year: "2026", days: [{ date: "2026-10-03", name: "개천절" }, { date: "2026-10-05", name: "대체공휴일" }, { date: "2026-10-09", name: "한글날" }] }]);
const cells = (p) => p.items.flatMap((it) => (it.type === "fold" ? it.months : [it])).flatMap((m) => m.cells);
const at = (p, iso) => cells(p).find((c) => c.iso === iso);

test("양도 2026-08-20: 8월·10월·11월을 펼치고 9월은 접힘, 9.1~10.31을 세고 10.31·11.1을 건너 11.2", () => {
  const r = computeDeadline(ev("sell"), "2026-08-20", { holidays: hol, today });
  const p = planCalendar(r, { holidays: hol, today });
  assert.deepEqual(p.items.map((it) => (it.type === "fold" ? `fold:${it.months.map((m) => m.m).join(",")}` : `${it.m}`)), ["8", "fold:9", "10", "11"]);
  assert.equal(p.countFrom, "2026-09-01");
  assert.equal(p.counted, 61);
  assert.equal(p.items[1].counted, 30);
  assert.ok(at(p, "2026-08-20").start && at(p, "2026-08-31").monthEnd);
  assert.ok(at(p, "2026-10-31").raw && at(p, "2026-10-31").skip === "토요일" && at(p, "2026-11-01").skip === "일요일");
  assert.ok(at(p, "2026-11-02").final && !at(p, "2026-11-02").counted);
  assert.ok(at(p, "2026-10-24").today);
  // 중간 공휴일은 그대로 센다(건너뛰지 않음)
  assert.deepEqual(p.holidaysInCount.map((h) => h.name), ["개천절", "대체공휴일", "한글날"]);
  assert.ok(at(p, "2026-10-03").counted && !at(p, "2026-10-03").skip);
});

test("세무조사 통지 2026-09-03 + 30일: 10.3 개천절·10.4 일·10.5 대체공휴일을 건너 10.6, 두 달 모두 펼침", () => {
  const r = computeDeadline(ev("audit"), "2026-09-03", { holidays: hol, today });
  const p = planCalendar(r, { holidays: hol, today });
  assert.equal(r.deadlineIso, "2026-10-06");
  assert.deepEqual(p.items.map((it) => it.type), ["month", "month"]);
  assert.equal(p.counted, 30);
  assert.deepEqual(cells(p).filter((c) => c.skip).map((c) => `${c.iso.slice(5)} ${c.skip}`), ["10-03 개천절", "10-04 일요일", "10-05 대체공휴일"]);
  assert.equal(cells(p).filter((c) => c.final).length, 1);
});

test("상속 해외(9개월): 시작 달·마감 달만 펼치고 사이 8개월은 접힌 띠 하나, 오늘이 띠 밖이면 today 없음", () => {
  const r = computeDeadline(ev("inherit"), "2026-10-04", { abroad: true, holidays: hol, today: new Date(2026, 9, 10) });
  const p = planCalendar(r, { holidays: hol, today: new Date(2026, 9, 10) });
  assert.equal(r.rawIso, "2027-07-31");
  assert.equal(r.deadlineIso, "2027-08-02"); // 7.31 토·8.1 일 → 8.2(달을 넘어감 — 원래 마감 달·진짜 마감 달 둘 다 펼침)
  assert.deepEqual(p.items.filter((it) => it.type === "month").map((m) => m.m), [10, 7, 8]);
  const folds = p.items.filter((it) => it.type === "fold");
  assert.equal(folds.length, 1);
  assert.equal(folds[0].months.length, 8);
  assert.equal(folds[0].today, false);
  assert.equal(p.items[0].m, 10);
});

test("건너뛴 날이 없으면 원래 마감 표시 없이 진짜 마감만", () => {
  const r = computeDeadline(ev("inherit"), "2026-10-04", { holidays: hol, today });
  const p = planCalendar(r, { holidays: hol, today });
  assert.equal(r.shifted.length, 0);
  assert.ok(!cells(p).some((c) => c.raw || c.skip));
  assert.ok(at(p, r.deadlineIso).final && at(p, r.deadlineIso).counted);
});

test("일정 파일(.ics): 마감일 하루·30일 전·7일 전 알림, 줄은 75바이트 이하", () => {
  const ics = deadlineIcs({ name: "양도소득세 예정신고·납부", deadlineIso: "2026-11-02", startIso: "2026-08-20", url: "https://semusatax.vercel.app/deadline?e=sell&d=2026-08-20", law: "소득세법 제105조 제1항 제1호", now: new Date(2026, 7, 25) });
  assert.match(ics, /DTSTART;VALUE=DATE:20261102\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261103\r\n/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(ics, /TRIGGER:-P29DT15H/);
  for (const l of ics.split("\r\n")) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("일정 파일: 이미 지난 알림은 넣지 않는다(마감 10일 전이면 7일 전 알림만)", () => {
  const ics = deadlineIcs({ name: "취득세", deadlineIso: "2026-11-03", startIso: "2026-09-04", now: new Date(2026, 9, 24, 12) });
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 1);
  assert.match(ics, /TRIGGER:-P6DT15H/);
  assert.match(ics, /METHOD:PUBLISH/);
  assert.match(ics, /TRANSP:TRANSPARENT/);
});

test("연도를 치는 중인 값(0202-03-15)은 계산하지 않는다", () => {
  for (const e of data.events) assert.equal(computeDeadline(e, "0202-03-15", { today }), null, e.id);
});
