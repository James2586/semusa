// 첫 화면·서비스 페이지의 신고 기한 계산(2026-10-24 시안 D). 날짜 규칙은 src/data/deadlines.json(법조문 대조분),
// 공휴일 연장은 ntsDeadline.js(택스 서치 shared/와 같은 파일 — 고치면 그쪽과 홈페이지 계산기들도 같이)가 한다.
// "말일부터 N개월": 말일 다음 날을 기산일로 민법 제160조(civilMonthsEnd). "날부터 N일": 초일 불산입(+N일).
import { parseIso, toIso, applyDeadlineExtension, weekdayKo, NTS_DEADLINE_LAW, LOCAL_TAX_DEADLINE_LAW } from "./ntsDeadline.js";
import { addDaysIso, civilMonthsEnd } from "./civilPeriod.js";

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ddayOf = (deadline, today) => Math.round((dayStart(deadline) - dayStart(today)) / 864e5);

export function computeDeadline(ev, startIso, { abroad = false, holidays = null, today = new Date() } = {}) {
  const base = parseIso(startIso);
  // 연도를 치는 중인 값(0202-…)은 계산하지 않는다 — 날짜 칸의 min·max(1950~2100)와 같은 범위만
  if (!base || !ev?.rule || base.getFullYear() < 1950 || base.getFullYear() > 2100) return null;
  let rawIso, monthEndIso = null, n = null;
  if (ev.rule.monthEnd) {
    n = abroad && ev.rule.abroadMonths ? ev.rule.abroadMonths : ev.rule.monthEnd;
    monthEndIso = toIso(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    const end = civilMonthsEnd(addDaysIso(monthEndIso, 1), n);
    if (!end) return null; // 연도를 치는 중(0202-… 같은 값)이면 계산하지 않는다
    rawIso = end.endIso;
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

// 매년(매달) 돌아오는 기한의 다음 날짜 — 이번 회차를 연장(주말·공휴일)까지 적용한 뒤 그날이 오늘보다 앞일 때만 다음 회차로.
// (원래 날짜로 비교하면 주말이라 미뤄진 실제 마감 당일에 벌써 다음 회차를 보여 준다 — 2026-10-24 검토)
export function nextYearly(item, { holidays = null, today = new Date() } = {}) {
  const t = dayStart(today);
  const nth = (k) => {
    if (item.rule.monthDay) return new Date(t.getFullYear(), t.getMonth() - 1 + k, item.rule.monthDay);
    const [m, d] = item.rule.md.split("-").map(Number);
    return new Date(t.getFullYear() - 1 + k, m - 1, d);
  };
  for (let k = 0; k < 4; k++) {
    const raw = nth(k), ext = applyDeadlineExtension(raw, holidays);
    if (ext.deadline >= t) return { rawIso: toIso(raw), rawWeekday: weekdayKo(raw), deadlineIso: ext.deadlineIso, deadline: ext.deadline, weekday: weekdayKo(ext.deadline), shifted: ext.shifted, knownYear: ext.knownYear, dday: ddayOf(ext.deadline, t) };
  }
  return null;
}
