// 첫 화면·서비스 페이지의 신고 기한 계산(2026-10-24 시안 D). 날짜 규칙은 src/data/deadlines.json(법조문 대조분),
// 공휴일 연장은 ntsDeadline.js(택스 서치 shared/와 같은 파일 — 고치면 그쪽과 홈페이지 계산기들도 같이)가 한다.
// "말일부터 N개월": 말일 다음 날을 기산일로 민법 제160조(civilMonthsEnd). "날부터 N일": 초일 불산입(+N일).
import { parseIso, toIso, applyDeadlineExtension, weekdayKo, NTS_DEADLINE_LAW, LOCAL_TAX_DEADLINE_LAW } from "./ntsDeadline.js";
import { addDaysIso, civilMonthsEnd } from "./civilPeriod.js";

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ddayOf = (deadline, today) => Math.round((dayStart(deadline) - dayStart(today)) / 864e5);

export function computeDeadline(ev, startIso, { abroad = false, holidays = null, today = new Date() } = {}) {
  const base = parseIso(startIso);
  if (!base || !ev?.rule) return null;
  let rawIso, monthEndIso = null, n = null;
  if (ev.rule.monthEnd) {
    n = abroad && ev.rule.abroadMonths ? ev.rule.abroadMonths : ev.rule.monthEnd;
    monthEndIso = toIso(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    rawIso = civilMonthsEnd(addDaysIso(monthEndIso, 1), n).endIso;
  } else {
    rawIso = addDaysIso(toIso(base), ev.rule.days);
  }
  const ext = applyDeadlineExtension(parseIso(rawIso), holidays);
  return {
    startIso: toIso(base), monthEndIso, rawIso,
    deadlineIso: ext.deadlineIso, deadline: ext.deadline, weekday: weekdayKo(ext.deadline),
    shifted: ext.shifted, knownYear: ext.knownYear, extLaw: ev.local ? LOCAL_TAX_DEADLINE_LAW : NTS_DEADLINE_LAW,
    dday: ddayOf(ext.deadline, today),
    why: String(ev.why || "").replace("{n}", n ?? ""),
  };
}

// 매년(매달) 돌아오는 기한의 다음 날짜 — 오늘이 그날이면 오늘.
export function nextYearly(item, { holidays = null, today = new Date() } = {}) {
  const t = dayStart(today);
  let raw;
  if (item.rule.monthDay) {
    raw = new Date(t.getFullYear(), t.getMonth(), item.rule.monthDay);
    if (raw < t) raw = new Date(t.getFullYear(), t.getMonth() + 1, item.rule.monthDay);
  } else {
    const [m, d] = item.rule.md.split("-").map(Number);
    raw = new Date(t.getFullYear(), m - 1, d);
    if (raw < t) raw = new Date(t.getFullYear() + 1, m - 1, d);
  }
  const ext = applyDeadlineExtension(raw, holidays);
  return { rawIso: toIso(raw), deadlineIso: ext.deadlineIso, deadline: ext.deadline, weekday: weekdayKo(ext.deadline), shifted: ext.shifted, knownYear: ext.knownYear, dday: ddayOf(ext.deadline, t) };
}
