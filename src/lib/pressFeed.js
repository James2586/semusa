// 이코노미조선 「성광호의 세무 ABC」 연재 자동 반영(2026-11-26 운영자 「연재 칼럼이 자동으로 추가 안되니」).
// 이코노미조선 검색(「성광호」)의 목록 자료(JSON)에서 연재 글만 골라 press.json articles에 더한다 — 제목·날짜·주소는 검색 결과 그대로.
// 주제(topic)·서비스·계산기 칸은 제목 낱말로만 고른다(세법 내용이 아니라 분류 — 손으로 고친 기존 글은 건드리지 않음).
// 지면(items)에 주소가 비어 있으면 같은 회(<N>)의 온라인 기사 주소를 채운다. 이 파일은 scripts/update-press.mjs·검사에서만 쓴다(빌드는 바깥에 나가지 않음).

export const SERIES = "성광호의 세무 ABC";
export const SEARCH_URL = (pn) => `https://economychosun.com/svc/news/data/list_search.data.html?query=${encodeURIComponent("성광호")}&sort=0&pn=${pn}`;

const unescape = (s) => String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();

// 검색 목록 자료 한 쪽 → 연재 글 [{ no, date, title, url }]
export function parseSearchItems(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((it) => {
    const sub = unescape(it.subtitle);
    const no = /^성광호의 세무 ABC\s*<(\d+)>/.exec(sub)?.[1];
    const d = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(String(it.date || ""));
    const url = String(it.link || "").replace(/^http:/, "https:");
    return {
      no: no ? Number(no) : null,
      date: d ? `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}` : "",
      title: unescape(it.title),
      url,
    };
  }).filter((a) => a.no && a.date && a.title && /^https:\/\/economychosun\.com\/site\/data\/html_dir\/\d{4}\/\d{2}\/\d{2}\/\d+\.html$/.test(a.url));
}

// 제목 낱말 → 주제·서비스·계산기(순서대로 먼저 맞는 것 — 기존 연재 19편의 손 분류와 주제가 같게 맞춘 순서, tests/press-feed.test.mjs)
const RULES = [
  { topic: "법인", re: /법인|가업|배당|대표/, services: ["corporate"], calculators: [] },
  { topic: "상속·증여", re: /상속|증여|대물림|차용증|금전대차/, services: ["inheritance-gift"], calculators: (t) => [/상속|대물림/.test(t) && "inheritance", /증여|대물림/.test(t) && "gift"].filter(Boolean) },
  { topic: "창업", re: /창업|개업|사업자/, services: ["bookkeeping"], calculators: [] },
  { topic: "금융", re: /ETF|주식|펀드|금융소득|ISA|연금/, services: [], calculators: [] },
  { topic: "보유세", re: /종부세|종합부동산|보유세|재산세|공시가/, services: ["real-estate"], calculators: ["jongbu"] },
  { topic: "취득", re: /취득세|공동 ?명의/, services: ["real-estate"], calculators: ["acquisition"] },
  { topic: "양도", re: /양도|주택|장특공|중과|비과세|매도|분양권|입주권|다주택|상가|아파트/, services: ["real-estate"], calculators: ["transfer"] },
];
export function classifyColumn(title = "") {
  const r = RULES.find((x) => x.re.test(title));
  if (!r) return { topic: "세금", services: [], calculators: [] };
  return { topic: r.topic, services: [...r.services], calculators: typeof r.calculators === "function" ? r.calculators(title) : [...r.calculators] };
}

// press.json + 검색에서 찾은 연재 글 → 새 press.json과 바뀐 것 목록(원본은 건드리지 않음)
export function mergePress(press, found) {
  const out = JSON.parse(JSON.stringify(press));
  const added = [], linked = [];
  const urls = new Set((out.articles || []).map((a) => a.url));
  for (const f of [...found].sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no)) {
    if (urls.has(f.url)) continue;
    urls.add(f.url);
    const a = { date: f.date, title: f.title, url: f.url, ...classifyColumn(f.title) };
    out.articles.push(a);
    added.push({ no: f.no, ...a });
  }
  out.articles.sort((a, b) => b.date.localeCompare(a.date));
  for (const it of out.items || []) {
    if (it.url || it.series !== SERIES) continue;
    const f = found.find((x) => x.no === it.no);
    if (f) { it.url = f.url; linked.push({ no: it.no, url: f.url }); }
  }
  return { press: out, added, linked };
}

// 검색 목록 전부(쪽마다 10건) — 실패하면 null
export async function readSeries({ fetchImpl = fetch, maxPages = 10 } = {}) {
  const all = [];
  for (let pn = 1; pn <= maxPages; pn++) {
    let data = null;
    for (let i = 0; i < 3 && !data; i++) {
      try {
        const res = await fetchImpl(SEARCH_URL(pn), { signal: AbortSignal.timeout(10000) });
        if (res.ok) data = await res.json();
      } catch {}
    }
    if (!data) return pn === 1 ? null : all;
    all.push(...parseSearchItems(data));
    if (!data.items?.length || pn >= Number(data.total_page || 0)) break;
  }
  return all;
}
