// shared/civilPeriod.js — 민법 기간 계산(달력 날짜만, 시간대 없음) 공용 도우미(2026-10-16 shared/limitationPeriod.js에서 떼어 냄).
// 국세기본법 제4조 → 민법 제157조(초일 불산입)·제159조(말일 종료)·제160조(역에 의한 계산: 최후의 월·연에서 기산일에 해당한 날의 전일,
// 해당일이 없으면 그 월의 말일). ⏳ 제척기간(limitationPeriod.js)·후발적 경정청구 3개월(lateCorrection.js)·⏳ 조세 기한 계산기가 같이 쓴다.
// 공휴일 연장(국세기본법 제5조①)은 여기서 하지 않는다 — 호출부가 shared/ntsDeadline.js applyDeadlineExtension으로.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function parseIsoDate(iso) {
  const m = ISO_RE.exec(String(iso || ""));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1950 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}
export const pad = (n) => String(n).padStart(2, "0");
export const toIsoParts = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
export function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export function addDaysIso(iso, n) {
  const p = parseIsoDate(iso);
  if (!p) return null;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return toIsoParts({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}
export function daysBetweenIso(fromIso, toIso) {
  const a = parseIsoDate(fromIso), b = parseIsoDate(toIso);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

// 민법 제160조 — 기산일(startIso)부터 N년: 최후의 연에서 기산일에 해당한 날의 전일로 만료(②), 해당일이 없으면 그 월의 말일(③).
// 반환 { endIso, rule } — rule은 화면에 그대로 보이는 계산 설명.
export function civilYearsEnd(startIso, years) {
  const p = parseIsoDate(startIso);
  if (!p || !Number.isInteger(years) || years < 1) return null;
  const y = p.y + years;
  if (p.d > daysInMonth(y, p.m)) {
    return { endIso: toIsoParts({ y, m: p.m, d: daysInMonth(y, p.m) }), rule: `${y}년 ${p.m}월에 기산일(${p.d}일)에 해당하는 날이 없어 그 월의 말일로 만료(민법 제160조③)` };
  }
  return { endIso: addDaysIso(toIsoParts({ y, m: p.m, d: p.d }), -1), rule: `${years}년 뒤 기산일에 해당한 날(${toIsoParts({ y, m: p.m, d: p.d })})의 전일로 만료(민법 제160조②)` };
}

// 민법 제160조 — 기산일(startIso)부터 N개월: 최후의 월에서 기산일에 해당한 날의 전일로 만료(②), 해당일이 없으면 그 월의 말일(③).
// 예: 기산일 2026-03-01 + 3개월 → 2026-06-01의 전일 2026-05-31 / 기산일 2025-11-30 + 3개월 → 2026-02월엔 30일이 없어 2026-02-28.
export function civilMonthsEnd(startIso, months) {
  const p = parseIsoDate(startIso);
  if (!p || !Number.isInteger(months) || months < 1) return null;
  const idx = p.m - 1 + months;
  const y = p.y + Math.floor(idx / 12), m = (idx % 12) + 1;
  if (p.d > daysInMonth(y, m)) {
    return { endIso: toIsoParts({ y, m, d: daysInMonth(y, m) }), rule: `${y}년 ${m}월에 기산일(${p.d}일)에 해당하는 날이 없어 그 월의 말일로 만료(민법 제160조③)` };
  }
  return { endIso: addDaysIso(toIsoParts({ y, m, d: p.d }), -1), rule: `${months}개월 뒤 기산일에 해당한 날(${toIsoParts({ y, m, d: p.d })})의 전일로 만료(민법 제160조②)` };
}
