// 기한 달력(2026-10-24 "결정적 한 장면"): computeDeadline 결과를 달·칸·상태로 옮긴다. 기한을 새로 계산하지 않는다 —
// 시작일·말일·원래 마감일·건너뛴 날·진짜 마감일은 결과 값 그대로, 쉬는 날 이름은 ntsDeadline.js(nonBusinessReason) 그대로.
// 펼치는 달: 시작 달·원래 마감 달·진짜 마감 달. 그 사이 달은 접힌 띠(fold) 하나로 묶고, 펼치면 볼 달 목록을 함께 준다.
import { parseIso, toIso, weekdayKo, nonBusinessReason, applyDeadlineExtension } from "./ntsDeadline.js";

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
  // 알림 시각(마감일 N일 전 오전 9시)이 이미 지났으면 그 알림은 넣지 않는다
  const [yy, mm, dd] = deadlineIso.split("-").map(Number);
  const alarmAt = (days) => new Date(yy, mm - 1, dd - days, 9);
  const d = deadlineIso.replace(/-/g, "");
  const next = addDays(deadlineIso, 1).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const desc = [`${name} 마감일입니다.`, law && `근거: ${law}`, "결과는 참고용입니다. 사정마다 다를 수 있으니 확인하세요.", url].filter(Boolean).join("\n");
  const alarm = (trig, t) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`${name} ${t}`)}`, `TRIGGER:${trig}`, "END:VALARM"];
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//hanadeo//deadline//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${d}-${startIso.replace(/-/g, "")}-${encodeURIComponent(name).replace(/%/g, "").slice(0, 24)}@semusatax.vercel.app`,
    `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, "TRANSP:TRANSPARENT",
    `SUMMARY:${icsEsc(`${name} 마감`)}`, `DESCRIPTION:${icsEsc(desc)}`, ...(url ? [`URL:${url}`] : []),
    // 마감일 0시 기준 — 29일 15시간 전 = 30일 전 오전 9시
    ...(alarmAt(30) > now ? alarm("-P29DT15H", "30일 전") : []), ...(alarmAt(7) > now ? alarm("-P6DT15H", "7일 전") : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// 올해 세금 달력(2026-10-24 3차 B1): deadlines.json yearly를 그해의 회차로 펼친다 — 매달(monthDay)은 12번, 매년(md)은 한 번.
// 쉬는 날 연장은 applyDeadlineExtension(국세기본법 §5①) 그대로. 새 기한을 만들지 않는다.
export function yearOccurrences(yearly, year, holidays = null) {
  const out = [];
  for (const it of yearly || []) {
    const raws = it.rule?.monthDay ? Array.from({ length: 12 }, (_, m) => new Date(year, m, it.rule.monthDay))
      : it.rule?.md ? [new Date(year, Number(it.rule.md.slice(0, 2)) - 1, Number(it.rule.md.slice(3)))] : [];
    for (const raw of raws) {
      const ext = applyDeadlineExtension(raw, holidays);
      out.push({ id: it.id, name: it.name, law: it.law, monthly: !!it.rule.monthDay, rawIso: toIso(raw), rawWeekday: weekdayKo(raw), deadlineIso: ext.deadlineIso, weekday: weekdayKo(ext.deadline), shifted: ext.shifted, knownYear: ext.knownYear });
    }
  }
  return out.sort((a, b) => a.deadlineIso.localeCompare(b.deadlineIso) || a.name.localeCompare(b.name));
}

// 여러 기한을 한 파일에(1년치) — 기한마다 하루 일정 + 7일 전 오전 9시 알림(지난 알림은 뺌)
export function yearIcs(items, { now = new Date(), url = "" } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//hanadeo//tax-calendar//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const it of items) {
    const d = it.deadlineIso.replace(/-/g, ""), next = addDays(it.deadlineIso, 1).replace(/-/g, "");
    const [yy, mm, dd] = it.deadlineIso.split("-").map(Number);
    lines.push("BEGIN:VEVENT", `UID:${d}-${it.id}@semusatax.vercel.app`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, "TRANSP:TRANSPARENT",
      `SUMMARY:${icsEsc(it.name)}`, `DESCRIPTION:${icsEsc([`근거: ${it.law}`, "결과는 참고용입니다.", url].filter(Boolean).join("\n"))}`);
    if (new Date(yy, mm - 1, dd - 7, 9) > now) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`${it.name} 7일 전`)}`, "TRIGGER:-P6DT15H", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
