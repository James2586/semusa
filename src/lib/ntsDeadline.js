// shared/ntsDeadline.js — 국세 기한 연장(국세기본법 §5①) 공용 순수 로직(2026-10-09).
// 신고·신청·청구 등의 기한이 공휴일·토요일·노동절(5월 1일)이면 그다음 날이 기한이다(다음 날도 쉬는 날이면 계속 넘긴다).
// 프론트(⏳ 조세 기한 계산기·📅 다가오는 신고기한·과세전적부심사청구서 양식)와 서버(문서 저장 시 마감일 자동 채움,
// 과세전적부심사청구서 [상황 정보])가 같이 쓴다. 날짜는 AI가 아니라 여기서만 계산하고, 넘긴 이유를 화면에 그대로 보여 준다.
//
// 공휴일 목록은 호출부가 넘긴다(서버: api/_holidays.js가 tax_constants의 kr_holidays에서 읽음 — 한국천문연구원 특일 정보 API로 채움,
// 화면: /api/faq?resource=holidays). 그 연도 목록이 없으면 토요일·일요일·노동절만 넘기고 knownYear:false로 알린다
// (조용히 틀리지 않게 — 화면은 "이 연도 공휴일 자료 없음"을 표시한다).
// ⚠ 처분청의 처리·결정 "예상" 기한(경정청구 2개월·이의신청 30일 등)에는 쓰지 않는다 — 납세자가 지켜야 하는 기한에만 쓴다.

import { addDaysIso as civilAddDaysIso, civilMonthsEnd, civilYearsEnd } from "./civilPeriod.js";

export const NTS_DEADLINE_LAW = "국세기본법 §5①";
// 지방세(재산세 등)의 같은 규칙(공휴일·대체공휴일·토요일·일요일·노동절이면 다음 날) — 날짜 계산은 같고 근거 조문만 다르다(2026-10-09).
export const LOCAL_TAX_DEADLINE_LAW = "지방세기본법 §24";
export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
export const MAX_SHIFT_DAYS = 15; // 설·추석 연휴 + 주말이 이어져도 이보다 길지는 않다(무한 반복 방지)

export function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "YYYY-MM-DD" → 그날 0시(로컬) Date. 형식이 틀리거나 없는 날짜면 null.
export function parseIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

// "2026.3.10" · "2026. 3. 10." · "2026-03-10" · "20260310" · "2026년 3월 10일" → "2026-03-10"(못 읽으면 null)
export function looseDateToIso(raw) {
  const s = String(raw || "").trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) m = /^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[.일]?$/.exec(s);
  if (!m) return null;
  const iso = `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
  return parseIso(iso) ? iso : null;
}

export function weekdayKo(d) {
  return WEEKDAY_KO[d.getDay()];
}

// 공휴일 자료 → { byDate: Map(iso → 이름), years: Set(자료가 있는 연도) }.
// rows: [{ year: "2026", days: [{ date: "2026-10-03", name: "개천절" }, …] }] (api/_holidays.js의 공개 형식)
export function buildHolidayIndex(rows) {
  const byDate = new Map();
  const years = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !Array.isArray(r.days) || !r.days.length) continue;
    years.add(String(r.year));
    for (const d of r.days) if (d && parseIso(d.date)) byDate.set(d.date, String(d.name || "공휴일"));
  }
  return { byDate, years };
}

// 그날이 쉬는 날이면 사유, 아니면 null. laborDay:false — 노동절(국세기본법 §5①·지방세기본법 §24에만 있는 연장 사유)을 쉬는 날로
// 보지 않는다(법원에 내는 기간 — 민법 §161은 토요일·공휴일만. 공휴일 자료에 5월 1일이 공휴일로 올라 있으면 그대로 넘긴다).
// laborDayLabel: 5월 1일의 이름 — 국세기본법 §5① 3호(2025.11.11 개정)·지방세기본법 §24① 모두 "노동절"(「노동절 제정에 관한 법률」, 2026-10-16 원문 대조 — 예전 기본값 "근로자의 날").
export function nonBusinessReason(date, index, { laborDay = true, laborDayLabel = "노동절" } = {}) {
  const iso = toIso(date);
  const named = index?.byDate?.get(iso);
  if (named) return named;
  if (date.getDay() === 6) return "토요일";
  if (date.getDay() === 0) return "일요일";
  if (laborDay && iso.slice(5) === "05-01") return laborDayLabel;
  return null;
}

// 기한 연장 — { deadline(Date), deadlineIso, shifted:[{iso, weekday, reason}], knownYear(그 연도 공휴일 자료가 있었는지), laborDay }
export function applyDeadlineExtension(deadline, index = null, { laborDay = true, laborDayLabel = "노동절" } = {}) {
  let d = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const shifted = [];
  const yearsSeen = new Set([String(d.getFullYear())]);
  for (let i = 0; i < MAX_SHIFT_DAYS; i++) {
    const reason = nonBusinessReason(d, index, { laborDay, laborDayLabel });
    if (!reason) break;
    shifted.push({ iso: toIso(d), weekday: weekdayKo(d), reason });
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    yearsSeen.add(String(d.getFullYear()));
  }
  const knownYear = [...yearsSeen].every((y) => index?.years?.has(y));
  return { deadline: d, deadlineIso: toIso(d), shifted, knownYear, laborDay, laborDayLabel };
}

// 화면·문서에 그대로 붙이는 연장 설명. 넘긴 날이 없으면 "". law: 연장 근거(기본 국세기본법 §5①, 행정소송 제소기간은 민법 §161).
// 예: " → 국세기본법 §5① 연장: 10-03(토) 개천절, 10-04(일) 일요일, 10-05(월) 대체공휴일 → 2026-10-06(화)"
export function extensionNote(ext, law = NTS_DEADLINE_LAW) {
  if (!ext || !ext.shifted.length) return "";
  const days = ext.shifted.map((s) => `${s.iso.slice(5)}(${s.weekday}) ${s.reason}`).join(", ");
  return ` → ${law} 연장: ${days} → ${ext.deadlineIso}(${weekdayKo(ext.deadline)})`;
}

export function unknownYearNote(ext) {
  if (!ext || ext.knownYear) return "";
  return ext.laborDay === false ? "※ 이 연도 공휴일 자료가 없어 토·일요일만 반영했어요." : `※ 이 연도 공휴일 자료가 없어 토·일요일·${ext.laborDayLabel || "노동절"}만 반영했어요.`;
}

// 기준일 + n일(초일 불산입) 기한에 연장까지 — 계산식 글 포함. opts.laborDay·opts.law는 위 연장 함수 참고(기본: 국세기본법 §5①).
export function addDaysWithExtension(baseIso, days, baseLabel, index = null, today = new Date(), { laborDay = true, law = NTS_DEADLINE_LAW, laborDayLabel } = {}) {
  const base = parseIso(baseIso);
  if (!base) return null;
  const raw = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const ext = applyDeadlineExtension(raw, index, { laborDay, laborDayLabel });
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return {
    base, rawDeadline: raw, rawDeadlineIso: toIso(raw),
    deadline: ext.deadline, deadlineIso: ext.deadlineIso, shifted: ext.shifted, knownYear: ext.knownYear, laborDay: ext.laborDay, laborDayLabel: ext.laborDayLabel,
    dday: Math.round((ext.deadline - t) / 86400000),
    formula: `${baseLabel} ${toIso(base)} + ${days}일(초일 불산입) = ${toIso(raw)}(${weekdayKo(raw)})${extensionNote(ext, law)}`,
  };
}

// 기준일부터 N개월·N년(민법 §157 초일 불산입 → 기준일 다음 날이 기산일, §160 역에 의한 계산) 기한에 연장까지 — 계산식 글 포함(2026-10-16).
// 예전 ⏳ 계산기는 "기준일 + 3개월(같은 날짜, 말일 보정)"이라 말일 경계에서 민법 계산과 달랐다(2026-02-28 → 05-28, 민법 05-31).
// period: { months } 또는 { years }. 경정청구 5년(§45의2①)·후발적 3개월(§45의2②)이 쓴다.
export function addCivilPeriodWithExtension(baseIso, period, baseLabel, index = null, today = new Date(), { laborDay = true, law = NTS_DEADLINE_LAW, laborDayLabel } = {}) {
  const base = parseIso(baseIso);
  if (!base || !period) return null;
  const startIso = civilAddDaysIso(toIso(base), 1);
  const end = period.years ? civilYearsEnd(startIso, period.years) : civilMonthsEnd(startIso, period.months);
  if (!end) return null;
  const raw = parseIso(end.endIso);
  const ext = applyDeadlineExtension(raw, index, { laborDay, laborDayLabel });
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const span = period.years ? `${period.years}년` : `${period.months}개월`;
  return {
    base, startIso, rawDeadline: raw, rawDeadlineIso: end.endIso, rule: end.rule,
    deadline: ext.deadline, deadlineIso: ext.deadlineIso, shifted: ext.shifted, knownYear: ext.knownYear, laborDay: ext.laborDay, laborDayLabel: ext.laborDayLabel,
    dday: Math.round((ext.deadline - t) / 86400000),
    formula: `${baseLabel} ${toIso(base)} → 기산일 ${startIso}(다음 날, 초일 불산입) + ${span} → ${end.rule} = ${end.endIso}(${weekdayKo(raw)})${extensionNote(ext, law)}`,
  };
}

// 경정청구서 유형 D(후발적 경정청구, correctionMode "late" — shared/lateCorrection.js LATE_MODE와 같은 값. 그 파일이 이 파일을 import해서 상수를 가져오지 않는다)
// 저장 마감일: 후발적 사유를 안 날 + 3개월(국세기본법 §45의2②). 다른 유형(5년·감면·누락)은 기준일이 여러 가지라 대상이 아니다.
export const LATE_CORRECTION_RULE = { field: "lcKnownDate", months: 3, baseLabel: "후발적 사유가 발생한 것을 안 날", what: "후발적 경정청구 기한(국세기본법 §45의2②)" };

// 저장 문서 마감일 자동 채움(api/answer.js handleSaveDoc) — 문서 종류별 기준일 칸과 일수.
// 기준일이 없거나 못 읽으면 null(채우지 않음). 경정청구서는 유형 D(후발적, 안 날 + 3개월)만 — 위 LATE_CORRECTION_RULE(2026-10-16).
// noExtension: 기한 연장(§5①)을 하지 않는다 — 세무조사 연기신청은 "조사 개시 전까지"라 개시 예정일을 뒤로 미루면 안 된다(2026-10-09).
export const AUTO_DEADLINE_RULES = {
  과세전적부심사청구서: { field: "psNoticeReceivedDate", days: 30, baseLabel: "통지받은 날", what: "과세전적부심사 청구 기한" },
  이유서: { field: "appealBaseDate", days: 90, baseLabel: "처분 통지를 받은 날", what: "이의신청 기한" },
  조세심판청구서: { field: "appealBaseDate", days: 90, baseLabel: "기한 기준일", what: "심판청구 기한" },
  심사청구서: { field: "appealBaseDate", days: 90, baseLabel: "기한 기준일", what: "심사청구 기한" }, // 국세기본법 §61①②(2026-10-11)
  // 행정소송 소장(2026-10-11, shared/courtSuit.js) — 결정 통지를 받은 날 + 90일(국세기본법 §56③). court: 법원에 내는 기간이라 민법 §161 연장만.
  행정소송소장: { field: "appealBaseDate", days: 90, baseLabel: "결정 통지를 받은 날", what: "행정소송 제소기간", court: true },
  세무조사연기신청서: { field: "auditStartDate", days: 0, baseLabel: "조사 개시 예정일", what: "세무조사 연기신청(조사 개시 전까지)", noExtension: true },
  // 고충민원(국세청 훈령 기한 — 국세기본법 §5① 연장 대상이 아님): 부과제척기간이 지나기 30일 전까지. 앞당겨질 뿐 미루지 않는다.
  고충민원신청서: { field: "grLimitationEnd", days: -30, baseLabel: "부과제척기간 만료일", what: "고충민원 신청 기한(제척기간 만료 30일 전까지)", noExtension: true },
};
export function autoDocDeadline(docType, fields, index = null) {
  if (docType === "경정청구서") {
    if (fields?.correctionMode !== "late") return null;
    const r = addCivilPeriodWithExtension(fields?.[LATE_CORRECTION_RULE.field], { months: LATE_CORRECTION_RULE.months }, LATE_CORRECTION_RULE.baseLabel, index);
    if (!r) return null;
    return { deadlineIso: r.deadlineIso, note: `${LATE_CORRECTION_RULE.what} — 자동 계산: ${r.formula}${r.knownYear ? "" : " (공휴일 자료 없는 연도)"}`.slice(0, 300) };
  }
  const rule = AUTO_DEADLINE_RULES[docType];
  if (!rule) return null;
  if (rule.noExtension) {
    const base = parseIso(fields?.[rule.field]);
    if (!base) return null;
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + rule.days);
    const formula = rule.days
      ? `${rule.baseLabel} ${toIso(base)}(${weekdayKo(base)}) ${rule.days > 0 ? "+" : "−"} ${Math.abs(rule.days)}일 = ${toIso(d)}(${weekdayKo(d)})`
      : `${rule.baseLabel} ${toIso(base)}(${weekdayKo(base)})`;
    return { deadlineIso: toIso(d), formula, note: `${rule.what} — ${formula}`.slice(0, 300) };
  }
  const r = addDaysWithExtension(fields?.[rule.field], rule.days, rule.baseLabel, index, new Date(),
    rule.court ? { laborDay: false, law: COURT_DEADLINE_LAW } : undefined);
  if (!r) return null;
  return { deadlineIso: r.deadlineIso, note: `${rule.what} — 자동 계산: ${r.formula}${r.knownYear ? "" : " (공휴일 자료 없는 연도)"}`.slice(0, 300) };
}

// 결과 기록 → 다음 단계 청구 기한(2026-10-09). 📂 내 저장 문서 "결과 기록"에서 일부인용·거부/기각과 그 결정(거부) 통지를 받은 날을 넣으면
// 다음 단계 기한을 계산해 마감일 칸에 넣는다(세무사가 보고 저장) → 08시 기한 알림 크론(D-7·D-1)이 그대로 이어진다.
// 모두 "통지를 받은 날부터 90일"(초일 불산입): 국세기본법 §61①·§68①(처분 — 경정청구 거부 포함, 이의신청은 §66에서 §61① 준용),
// §61②·§68②(이의신청 결정), §56③(심사·심판청구 결정 → 행정소송). 행정소송 제소기간은 법원에 내는 기간이라 연장은 민법 §161(토요일·
// 공휴일)로만 한다 — 국세기본법 §5①의 노동절 연장까지 쓰면 하루 늦은 날짜를 알려 줄 수 있다.
// 과세전적부심사는 결정 통지가 아니라 그 뒤 납부고지서를 받은 날이 기준이라, 입력칸 이름(baseLabel)을 그 날로 받는다(2026-10-09 UX E5 — 예전엔
// 대상이 아니어서 불채택을 기록해도 다음 기한 안내가 없었다). 가산세 감면 신청은 대상이 아니다. 지방세 사건은 지방세기본법 기한을 따로 확인하라고 화면에 적는다.
export const COURT_DEADLINE_LAW = "민법 §161";
export const NEXT_STAGE_OUTCOMES = ["partial", "rejected"];
export const NEXT_STAGE_RULES = {
  // grievanceIfLate: 이 기한마저 지나면 📂 결과 기록이 고충민원 신청서를 권한다(2026-10-09). 불복을 거치지 않은 처분이라 고충민원 대상이 되는
  // 경우 — 이의신청·심판청구 결정이 확정된 사건은 고충민원 대상에서 빠질 수 있어(국세청 안내) 다른 두 규칙에는 두지 않는다.
  경정청구서: { baseLabel: "경정청구 결과(거부·일부 경정) 통지를 받은 날", what: "이의신청·심사청구·심판청구 기한", short: "불복청구 기한", days: 90, law: "국세기본법 §61①·§68①(이의신청은 §66에서 §61① 준용)", grievanceIfLate: true },
  이유서: { baseLabel: "이의신청 결정 통지를 받은 날", what: "심사청구·심판청구 기한", short: "심사·심판청구 기한", days: 90, law: "국세기본법 §61②·§68②" },
  조세심판청구서: { baseLabel: "심판청구 결정 통지를 받은 날", what: "행정소송 제소 기한", short: "행정소송 기한", days: 90, law: "국세기본법 §56③", court: true },
  심사청구서: { baseLabel: "심사청구 결정 통지를 받은 날", what: "행정소송 제소 기한", short: "행정소송 기한", days: 90, law: "국세기본법 §56③", court: true },
  과세전적부심사청구서: { baseLabel: "결정 뒤 납부고지서를 받은 날", what: "이의신청·심사청구·심판청구 기한", short: "불복청구 기한", days: 90, law: "국세기본법 §61①·§68①(이의신청은 §66에서 §61① 준용)", grievanceIfLate: true },
};
// 결과 기록에서 "다음 단계 문서 쓰기"로 여는 문서 종류(2026-10-09 UX E5). 심사·심판청구 기각 뒤 행정소송 소장(본인소송용 초안)은 2026-10-11부터.
export const NEXT_STAGE_DOC_TYPES = {
  경정청구서: ["이유서", "심사청구서", "조세심판청구서"],
  과세전적부심사청구서: ["이유서", "심사청구서", "조세심판청구서"],
  이유서: ["심사청구서", "조세심판청구서"],
  조세심판청구서: ["행정소송소장"],
  심사청구서: ["행정소송소장"],
};
export function nextStageRule(docType, outcome) {
  return NEXT_STAGE_OUTCOMES.includes(outcome) ? NEXT_STAGE_RULES[docType] || null : null;
}
// 통지를 받은 날 → addDaysWithExtension 결과 + note(마감일 메모 — 카카오 알림 문구에 그대로 나가므로 짧게). 날짜가 없거나 틀리면 null.
export function nextStageDeadline(rule, noticeIso, index = null, today = new Date()) {
  if (!rule) return null;
  const r = addDaysWithExtension(noticeIso, rule.days, rule.baseLabel, index, today,
    rule.court ? { laborDay: false, law: COURT_DEADLINE_LAW } : undefined);
  if (!r) return null;
  const laborDayKept = rule.court && r.deadlineIso.slice(5) === "05-01"
    ? " — 5월 1일(노동절)은 법원 기간을 늘리는 날이 아니라 그대로 뒀어요(민법 §161은 토요일·공휴일만)" : "";
  return { ...r, formula: r.formula + laborDayKept, note: `${rule.short}(통지 ${toIso(r.base).slice(5)} + ${rule.days}일)` };
}
