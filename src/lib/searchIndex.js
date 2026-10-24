// 사이트 찾기(2026-10-24 3차 A2): 빌드 때 자료 파일(services·calculators·FAQ·press·deadlines·guide)에서 찾기 목록을 만들고,
// 화면은 그 목록을 글자로만 거른다(띄어쓰기·대소문자 무시). 새 글을 쓰지 않는다 — 제목·설명은 자료 파일 그대로.

// 줄임말 ↔ 정식 이름: 정식 이름이 든 항목에 줄임말을 덧붙여 "양도세"로도 "양도소득세" 항목이 걸리게
export const ALIASES = [
  ["양도소득세", "양도세"], ["종합부동산세", "종부세"], ["부가가치세", "부가세"], ["종합소득세", "종소세"],
  ["상속세", "상속"], ["증여세", "증여"], ["취득세", "취득"], ["원천세", "원천징수"], ["퇴직소득세", "퇴직금"],
  ["언제까지", "기한 마감"], ["세무조사", "조사"], ["고지서", "고지"], ["불복", "이의신청 심판청구 심사청구"], ["기장", "장부"],
];
// 자주 묻는 질문의 자리 이름: 파일 이름에서 앞 번호를 뗀 것(FaqList의 details id와 같게)
export const faqId = (path) => "q-" + String(path).split("/").pop().replace(/\.md$/, "").replace(/^\d+-/, "");
export const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");

const strip = (md) => String(md || "").replace(/\*\*|__|`|#+\s?/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
const clip = (s, n = 90) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function buildSearchIndex({ services = [], calculators = [], faqs = [], articles = [], events = [], yearly = [], situations = [], pages = [] }) {
  const items = [];
  const add = (it) => {
    const hay = [it.t, it.d, it.x].join(" ");
    const extra = ALIASES.filter(([full]) => hay.includes(full)).map(([, a]) => a).join(" ");
    // 제목의 정식 이름에 붙는 줄임말(a) — "양도세"가 "양도소득세 계산기" 제목에 든 것처럼 친다
    const a = ALIASES.filter(([full]) => String(it.t).includes(full)).map(([, x]) => x).join(" ");
    items.push({ ...it, x: [it.x, extra].filter(Boolean).join(" "), ...(a ? { a } : {}) });
  };
  for (const p of pages) add({ k: "쪽", t: p.t, d: p.d, u: p.u, x: p.x || "" });
  for (const s of services) add({ k: "서비스", t: s.name, d: s.short, u: `/services/${s.slug}`, x: [...(s.forWho || []), ...(s.does || []), ...(s.deadlines || []).map((d) => d.title)].join(" ") });
  for (const c of calculators) add({ k: "계산기", t: c.name, d: c.short, u: `/calculators/${c.slug}`, x: [c.intro, ...(c.covers || [])].join(" ") });
  for (const f of faqs) add({ k: "자주 묻는 질문", t: f.q, d: clip(strip(f.body)), u: `/faq#${f.id}`, x: [f.category, strip(f.body), f.law].join(" ") });
  for (const e of events) add({ k: "기한", t: `${e.name} 기한`, d: String(e.why || "").replace("{n}", e.rule?.monthEnd ?? ""), u: `/deadline?e=${e.id}`, x: [e.chip, e.dateLabel, e.law].join(" ") });
  for (const y of yearly) add({ k: "기한", t: `${y.name} 기한`, d: "매년 돌아오는 기한 — 올해 세금 달력", u: "/tax-calendar", x: y.law || "" });
  for (const g of situations) add({ k: "상황", t: g.label, d: "상황 길잡이에서 기한·서비스·계산기를 한 번에", u: `/guide?s=${g.id}`, x: "" });
  for (const a of articles) add({ k: "칼럼", t: a.title, d: `이코노미조선 · ${a.date.split("-").map(Number).join(". ")}.`, u: a.url, x: a.topic || "", ext: true });
  return items;
}

// 낱말마다 들어 있어야 걸린다(그리고). 제목(+제목의 줄임말)에 든 것이 앞, 바깥 칼럼은 조금 뒤, 같으면 원래 순서(쪽·서비스·계산기·질문·기한·상황·칼럼)
export function searchItems(items, query, limit = 30) {
  const terms = String(query || "").trim().split(/\s+/).map(norm).filter(Boolean);
  if (!terms.length) return [];
  const whole = norm(query);
  const out = [];
  items.forEach((it, i) => {
    const t = norm(it.t) + (it.a ? "|" + norm(it.a) : ""), all = t + "|" + norm(it.d) + "|" + norm(it.x);
    if (!terms.every((w) => all.includes(w))) return;
    let score = 0;
    if (t.includes(whole)) score += 10;
    if (t.startsWith(terms[0])) score += 2;
    for (const w of terms) if (t.includes(w)) score += 3;
    if (it.ext) score -= 1; // 바깥 칼럼은 같은 점수면 사이트 안 쪽보다 뒤
    out.push({ it, score, i });
  });
  return out.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, limit).map((o) => o.it);
}
