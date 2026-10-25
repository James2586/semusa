// 경정청구 날짜 계산(2026-10-25). 세금 종류별 법정신고기한은 deadlines.json(법조문 대조분)의 규칙 그대로,
// 경정청구 기간은 국세기본법 제45조의2(appeal.json 경정청구 줄): ① 법정신고기한이 지난 후 5년, ③ 청구를 받은 날부터 2개월 →
// 그 2개월이 되는 날의 다음 날부터 불복 가능. 거부 통지 뒤 불복 기한은 deadlines.json "notice"(통지를 받은 날부터 90일).
// 기간 셈은 민법(초일 불산입·제160조), 납세자가 지킬 기한만 국세기본법 제5조 제1항 연장 — 세무서의 2개월에는 쓰지 않는다.
import { parseIso, toIso, weekdayKo, applyDeadlineExtension } from "./ntsDeadline.js";
import { addDaysIso, civilMonthsEnd } from "./civilPeriod.js";
import { computeDeadline } from "./deadlineCalc.js";

const day = (iso) => ({ iso, weekday: weekdayKo(parseIso(iso)) });
const validIso = (s) => { const d = parseIso(s); return d && d.getFullYear() >= 1950 && d.getFullYear() <= 2100 ? toIso(d) : null; };
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ddays = (iso, today) => Math.round((dayStart(parseIso(iso)) - dayStart(today)) / 864e5);
function extended(rawIso, holidays, today) {
  const ext = applyDeadlineExtension(parseIso(rawIso), holidays);
  return { rawIso, ...day(ext.deadlineIso), shifted: ext.shifted, knownYear: ext.knownYear, dday: ddays(ext.deadlineIso, today) };
}

// tax: appeal.json refundCalc.taxes 한 줄, src: { yearly, events }(deadlines.json)
// input: { year, dateIso, abroad, alt, claimIso, refusalIso }
export function computeRefundDates(tax, src, input = {}, { holidays = null, today = new Date() } = {}) {
  const [kind, id] = String(tax?.from || "").split(":");
  let legal, legalLaw, legalWhy;
  if (kind === "yearly") {
    const y = Number(input.year);
    if (!Number.isInteger(y) || y < 1950 || y > 2099) return null;
    const item = src.yearly.find((x) => x.id === id);
    if (!item?.rule?.md) return null;
    const useAlt = !!(input.alt && tax.alt);
    const md = useAlt ? tax.alt.md : item.rule.md;
    const [m, d] = md.split("-").map(Number);
    legal = extended(`${y + (tax.offset || 0)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, holidays, today);
    legalLaw = useAlt ? tax.alt.law : item.law;
    legalWhy = `${y + (tax.offset || 0)}년 ${m}월 ${d}일`;
  } else if (kind === "event") {
    const ev = src.events.find((x) => x.id === id);
    const base = validIso(input.dateIso);
    if (!ev || !base) return null;
    const r = computeDeadline(ev, base, { abroad: !!input.abroad, holidays, today });
    if (!r) return null;
    legal = { rawIso: r.rawIso, ...day(r.deadlineIso), shifted: r.shifted, knownYear: r.knownYear, dday: r.dday };
    legalLaw = ev.law; legalWhy = r.why;
  } else return null;

  // ① 법정신고기한이 지난 후 5년: 기한 다음 날부터 60개월(민법 제157조·제160조), 마지막 날이 쉬는 날이면 제5조 제1항
  const end5 = civilMonthsEnd(addDaysIso(legal.iso, 1), 60);
  const claimEnd = extended(end5.endIso, holidays, today);
  const out = { legal: { ...legal, law: legalLaw, why: legalWhy }, claimEnd, claim: null, refusal: null };

  const claimIso = validIso(input.claimIso);
  if (claimIso) {
    // ③ 청구를 받은 날부터 2개월(초일 불산입) — 세무서의 기간이라 연장하지 않고 날짜만, 다음 날부터 불복 가능
    const two = civilMonthsEnd(addDaysIso(claimIso, 1), 2).endIso;
    out.claim = { ...day(claimIso), late: claimIso > claimEnd.iso, twoMonths: day(two), appealFrom: day(addDaysIso(two, 1)) };
  }
  const refusalIso = validIso(input.refusalIso);
  if (refusalIso) {
    const ev = src.events.find((x) => x.id === "notice");
    const r = ev && computeDeadline(ev, refusalIso, { holidays, today });
    if (r) out.refusal = { ...day(refusalIso), deadline: { rawIso: r.rawIso, ...day(r.deadlineIso), shifted: r.shifted, knownYear: r.knownYear, dday: r.dday }, law: ev.law, why: r.why };
  }
  return out;
}
