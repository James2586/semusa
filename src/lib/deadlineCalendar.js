// 기한 달력(2026-10-24 "결정적 한 장면"): computeDeadline 결과를 달·칸·상태로 옮긴다. 기한을 새로 계산하지 않는다 —
// 시작일·말일·원래 마감일·건너뛴 날·진짜 마감일은 결과 값 그대로, 쉬는 날 이름은 ntsDeadline.js(nonBusinessReason) 그대로.
// 펼치는 달: 시작 달·원래 마감 달·진짜 마감 달. 그 사이 달은 접힌 띠(fold) 하나로 묶고, 펼치면 볼 달 목록을 함께 준다.
import { parseIso, toIso, weekdayKo, nonBusinessReason } from "./ntsDeadline.js";

const addDays = (iso, n) => { const d = parseIso(iso); return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const monthKey = (iso) => iso.slice(0, 7);

function buildMonth(y, m, ctx) {
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m - 1, d), iso = toIso(date);
    const reason = nonBusinessReason(date, ctx.holidays, { laborDay: ctx.laborDay });
    const c = { d, iso, dow: date.getDay(), weekday: weekdayKo(date) };
    if (reason && reason !== "토요일" && reason !== "일요일") c.holiday = reason;
    if (date.getDay() === 0 || date.getDay() === 6) c.weekend = true;
    if (iso === ctx.r.startIso) c.start = true;
    if (iso === ctx.r.monthEndIso) c.monthEnd = true;
    if (iso >= ctx.countFrom && iso <= ctx.r.rawIso) { c.counted = true; c.k = ctx.k++; }
    if (ctx.skips.has(iso)) { c.skip = ctx.skips.get(iso); c.j = ctx.j++; }
    if (iso === ctx.r.rawIso && ctx.r.shifted.length) c.raw = true;
    if (iso === ctx.r.deadlineIso) c.final = true;
    if (iso === ctx.todayIso) c.today = true;
    cells.push(c);
  }
  const counted = cells.filter((c) => c.counted).length;
  return { type: "month", y, m, first: first.getDay(), cells, counted };
}

export function planCalendar(r, { holidays = null, today = new Date(), laborDay = true } = {}) {
  if (!r?.startIso || !r?.rawIso || !r?.deadlineIso) return null;
  // 세는 첫날: "말일부터 N개월"은 말일 다음 날, "날부터 N일"은 다음 날(초일 불산입)
  const countFrom = addDays(r.monthEndIso || r.startIso, 1);
  const ctx = { r, holidays, laborDay, countFrom, skips: new Map(r.shifted.map((s) => [s.iso, s.reason])), todayIso: toIso(today), k: 0, j: 0 };
  const open = new Set([monthKey(r.startIso), monthKey(r.rawIso), monthKey(r.deadlineIso)]);
  const items = [];
  let fold = null;
  let [y, m] = r.startIso.split("-").map(Number);
  const [ey, em] = r.deadlineIso.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const mon = buildMonth(y, m, ctx);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (open.has(key)) {
      if (fold) { items.push(fold); fold = null; }
      items.push(mon);
    } else {
      if (!fold) fold = { type: "fold", months: [], counted: 0, today: false };
      fold.months.push(mon);
      fold.counted += mon.counted;
      if (mon.cells.some((c) => c.today)) fold.today = true;
    }
    m++; if (m > 12) { m = 1; y++; }
  }
  if (fold) items.push(fold);
  const counted = items.reduce((s, it) => s + it.counted, 0);
  return { items, countFrom, counted, holidaysInCount: items.flatMap((it) => (it.type === "fold" ? it.months : [it])).flatMap((mo) => mo.cells).filter((c) => c.counted && c.holiday).map((c) => ({ iso: c.iso, name: c.holiday })) };
}

// 내 달력에 넣기(.ics): 마감일 하루 일정 + D-30·D-7 오전 9시 알림. 브라우저 안에서 글자로만 만든다(서버로 보내지 않음).
const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// 한 줄 75바이트 넘으면 접는다(RFC 5545 3.1) — 한글이 잘리지 않게 글자 단위로
function fold(line) {
  const enc = new TextEncoder(), out = [];
  let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ""; bytes = 0; limit = 74; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
export function deadlineIcs({ name, deadlineIso, startIso, url = "", law = "", now = new Date() }) {
  const d = deadlineIso.replace(/-/g, "");
  const next = addDays(deadlineIso, 1).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const desc = [`${name} 마감일입니다.`, law && `근거: ${law}`, "결과는 참고용입니다. 사정마다 다를 수 있으니 확인하세요.", url].filter(Boolean).join("\n");
  const alarm = (trig, t) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`${name} ${t}`)}`, `TRIGGER:${trig}`, "END:VALARM"];
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//hanadeo//deadline//KO", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${d}-${startIso.replace(/-/g, "")}-${encodeURIComponent(name).replace(/%/g, "").slice(0, 24)}@semusatax.vercel.app`,
    `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${icsEsc(`${name} 마감`)}`, `DESCRIPTION:${icsEsc(desc)}`, ...(url ? [`URL:${url}`] : []),
    // 마감일 0시 기준 — 29일 15시간 전 = 30일 전 오전 9시
    ...alarm("-P29DT15H", "30일 전"), ...alarm("-P6DT15H", "7일 전"),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
