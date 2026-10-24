// 빌드 전에 운영자가 고치는 파일(src/data/*.json, src/content/faq/*.md)을 검사한다.
// 틀린 곳이 있으면 파일 이름과 줄 번호를 한국어로 알려 주고 빌드를 멈춘다.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

export function parseJsonFile(name, text) {
  try {
    return { data: JSON.parse(text) };
  } catch (e) {
    const m = /position (\d+)/.exec(e.message) || /column (\d+)/.exec(e.message);
    const lm = /line (\d+)/.exec(e.message);
    const line = lm ? Number(lm[1]) : m ? lineOf(text, Number(m[1])) : null;
    return { error: `${name}${line ? ` ${line}번째 줄 근처` : ""}: JSON 형식이 틀렸습니다 (쉼표·따옴표·괄호를 확인하세요).` };
  }
}

function findLine(text, needle) {
  const i = text.indexOf(needle);
  return i < 0 ? null : lineOf(text, i);
}

export function checkCalculators(text) {
  const errors = [];
  const { data, error } = parseJsonFile("calculators.json", text);
  if (error) return [error];
  const groups = new Set((data.groups || []).map((g) => g.id));
  if (!groups.size) errors.push("calculators.json: groups가 비었습니다.");
  const seen = new Set();
  (data.calculators || []).forEach((c, i) => {
    const at = `calculators.json ${findLine(text, `"slug": "${c.slug}"`) ?? "?"}번째 줄 (${i + 1}번째 계산기)`;
    for (const k of ["slug", "group", "name", "short", "url"]) {
      if (!c[k] || typeof c[k] !== "string" || !c[k].trim()) errors.push(`${at}: ${k}가 비었습니다.`);
    }
    if (c.slug && !/^[a-z0-9-]+$/.test(c.slug)) errors.push(`${at}: slug는 영어 소문자·숫자·-만 씁니다 ("${c.slug}").`);
    if (c.slug && seen.has(c.slug)) errors.push(`${at}: slug "${c.slug}"가 두 번 나옵니다.`);
    seen.add(c.slug);
    if (c.group && !groups.has(c.group)) errors.push(`${at}: group "${c.group}"는 groups에 없습니다.`);
    if (c.url && !/^https:\/\//.test(c.url)) errors.push(`${at}: url은 https://로 시작해야 합니다.`);
    for (const k of ["covers", "notCovered", "prepare"]) {
      if (c[k] !== undefined && !(Array.isArray(c[k]) && c[k].every((t) => typeof t === "string" && t.trim()))) errors.push(`${at}: ${k}는 글 목록(["…", "…"])이어야 합니다.`);
    }
    if (c.deadline !== undefined && c.deadline !== null && !(c.deadline.text && c.deadline.law)) errors.push(`${at}: deadline에는 text와 law(근거 조문)가 둘 다 있어야 합니다.`);
  });
  if (!seen.size) errors.push("calculators.json: calculators가 비었습니다.");
  return errors;
}

export function checkServices(text, calcSlugs, eventIds = null, yearlyIds = null, root = ROOT) {
  const errors = [];
  const { data, error } = parseJsonFile("services.json", text);
  if (error) return [error];
  const seen = new Set();
  (data.services || []).forEach((s, i) => {
    const at = `services.json ${findLine(text, `"slug": "${s.slug}"`) ?? "?"}번째 줄 (${i + 1}번째 서비스)`;
    for (const k of ["slug", "name", "short"]) {
      if (!s[k] || typeof s[k] !== "string" || !s[k].trim()) errors.push(`${at}: ${k}가 비었습니다.`);
    }
    if (s.slug && seen.has(s.slug)) errors.push(`${at}: slug "${s.slug}"가 두 번 나옵니다.`);
    seen.add(s.slug);
    if (!(s.deadlines || []).length) errors.push(`${at}: deadlines(기한)가 비었습니다.`);
    for (const d of s.deadlines || []) if (!d.text || !d.law) errors.push(`${at}: 기한 "${d.title || "?"}"에 text와 law(근거 조문)가 둘 다 있어야 합니다.`);
    for (const k of ["forWho", "does", "prepare", "steps"]) if (!(s[k] || []).length) errors.push(`${at}: ${k}가 비었습니다.`);
    for (const c of s.calculators || []) {
      if (!calcSlugs.has(c)) errors.push(`${at}: 계산기 "${c}"는 calculators.json에 없습니다.`);
    }
    if (s.keyDeadlines !== undefined && !(Array.isArray(s.keyDeadlines) && s.keyDeadlines.every((k) => Array.isArray(k) && k.length === 2 && k.every((t) => typeof t === "string" && t.trim())))) errors.push(`${at}: keyDeadlines는 [["상속세", "말일부터 6개월"], …] 모양이어야 합니다.`);
    for (const e of s.calcEvents || []) if (eventIds && !eventIds.has(e)) errors.push(`${at}: calcEvents "${e}"는 deadlines.json events에 없습니다.`);
    // 2026-10-24 2차 개편: 매년 돌아오는 기한(법인·기장)·머리 장식 사진·그 분야 질문
    for (const y of s.yearly || []) if (yearlyIds && !yearlyIds.has(y)) errors.push(`${at}: yearly "${y}"는 deadlines.json yearly에 없습니다.`);
    if (s.photo !== undefined && !existsSync(join(root, "public/img/photos", `${s.photo}-1200.webp`)) && !existsSync(join(root, "public/img/photos", `${s.photo}-900.webp`))) errors.push(`${at}: photo "${s.photo}" 파일이 public/img/photos/에 없습니다.`);
  });
  return errors;
}

// 첫 화면·서비스 페이지 기한 계산(2026-10-24): 일마다 계산 규칙·근거 조문·"하나 더 확인할 것"과 그 근거가 다 있어야 한다.
export function checkDeadlines(text) {
  const errors = [];
  const { data, error } = parseJsonFile("deadlines.json", text);
  if (error) return [error];
  const seen = new Set();
  (data.events || []).forEach((e, i) => {
    const at = `deadlines.json ${findLine(text, `"id": "${e.id}"`) ?? "?"}번째 줄 (${i + 1}번째 일)`;
    for (const k of ["id", "chip", "dateLabel", "name", "why", "law"]) if (!e[k] || typeof e[k] !== "string") errors.push(`${at}: ${k}가 비었습니다.`);
    if (!(Number.isInteger(e.rule?.monthEnd) || Number.isInteger(e.rule?.days))) errors.push(`${at}: rule은 { "monthEnd": 개월 } 또는 { "days": 일 }이어야 합니다.`);
    if (!e.fact?.text || !e.fact?.law) errors.push(`${at}: fact(하나 더 확인할 것)에는 text와 law(근거 조문)가 둘 다 있어야 합니다.`);
    if (seen.has(e.id)) errors.push(`${at}: id "${e.id}"가 두 번 나옵니다.`);
    seen.add(e.id);
  });
  if (!seen.size) errors.push("deadlines.json: events가 비었습니다.");
  (data.yearly || []).forEach((y, i) => {
    if (!y.name || !y.when || !y.law) errors.push(`deadlines.json: yearly ${i + 1}번째에 name·when·law(근거 조문)가 다 있어야 합니다.`);
    if (!(y.rule?.monthDay || /^\d{2}-\d{2}$/.test(y.rule?.md || ""))) errors.push(`deadlines.json: yearly ${i + 1}번째 rule은 { "md": "MM-DD" } 또는 { "monthDay": 일 }이어야 합니다.`);
  });
  return errors;
}

export function checkHome(text, svcSlugs, root = ROOT) {
  const errors = [];
  const { data, error } = parseJsonFile("home.json", text);
  if (error) return [error];
  (data.situations || []).forEach((s, i) => {
    if (!s.text) errors.push(`home.json: ${i + 1}번째 상황의 text가 비었습니다.`);
    if (!svcSlugs.has(s.service)) errors.push(`home.json: ${i + 1}번째 상황의 service "${s.service}"는 services.json에 없습니다.`);
  });
  if (!(data.situations || []).length) errors.push("home.json: situations가 비었습니다.");
  if (!Number.isInteger(data.booksTotal) || data.booksTotal < 1) errors.push("home.json: booksTotal은 책 권수(숫자)여야 합니다.");
  (data.books || []).forEach((b, i) => {
    if (!b.title || !/^#[0-9A-Fa-f]{6}$/.test(b.color || "")) errors.push(`home.json: ${i + 1}번째 책에 title과 color("#RRGGBB")가 있어야 합니다.`);
    if (b.date !== undefined && !/^\d{4}-\d{2}$/.test(b.date)) errors.push(`home.json: ${i + 1}번째 책 date는 "YYYY-MM"이어야 합니다.`);
    // 표지 사진(선택): public/ 아래 실제 파일이어야 한다
    if (b.cover !== undefined && !(/^\/img\/books\/[a-z0-9-]+\.(webp|png|jpg)$/.test(b.cover) && existsSync(join(root, "public", b.cover)))) errors.push(`home.json: ${i + 1}번째 책 cover "${b.cover}" 파일이 public/img/books/에 없습니다.`);
  });
  for (const k of ["consult", "steps", "prepare"]) if (!(data[k] || []).length) errors.push(`home.json: ${k}가 비었습니다.`);
  return errors;
}

// 지면 칼럼(2026-10-24): 기사 주소·날짜 모양, 주제 칸이 가리키는 서비스·계산기가 실제로 있는지
export function checkPress(text, svcSlugs, calcSlugs) {
  const errors = [];
  const { data, error } = parseJsonFile("press.json", text);
  if (error) return [error];
  (data.articles || []).forEach((a, i) => {
    const at = `press.json articles ${i + 1}번째`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || "")) errors.push(`${at}: date는 "YYYY-MM-DD"이어야 합니다.`);
    if (!a.title || !/^https:\/\//.test(a.url || "")) errors.push(`${at}: title과 https 주소가 있어야 합니다.`);
    for (const s of a.services || []) if (!svcSlugs.has(s)) errors.push(`${at}: services "${s}"는 services.json에 없습니다.`);
    for (const c of a.calculators || []) if (!calcSlugs.has(c)) errors.push(`${at}: calculators "${c}"는 calculators.json에 없습니다.`);
  });
  return errors;
}

// 상황 길잡이(2026-10-24 3차): 상황마다 가리키는 기한·서비스·계산기가 실제로 있는지
export function checkGuide(text, svcSlugs, calcSlugs, eventIds, yearlyIds) {
  const errors = [];
  const { data, error } = parseJsonFile("guide.json", text);
  if (error) return [error];
  const all = [...(data.situations || []), ...(data.who || [])];
  all.forEach((g) => {
    const at = `guide.json "${g.id}"`;
    if (!g.id || !g.label) errors.push(`${at}: id와 label이 있어야 합니다.`);
    if (g.event && !eventIds.has(g.event)) errors.push(`${at}: event "${g.event}"는 deadlines.json events에 없습니다.`);
    for (const y of g.yearly || []) if (!yearlyIds.has(y)) errors.push(`${at}: yearly "${y}"는 deadlines.json yearly에 없습니다.`);
    for (const x of g.services || []) if (!svcSlugs.has(x)) errors.push(`${at}: services "${x}"는 services.json에 없습니다.`);
    for (const c of g.calculators || []) if (!calcSlugs.has(c)) errors.push(`${at}: calculators "${c}"는 calculators.json에 없습니다.`);
  });
  if (!(data.situations || []).length) errors.push("guide.json: situations가 비었습니다.");
  return errors;
}

// 용어 풀이(3차 C3): 인용은 docs/glossary-sources.json 원문을 글자 그대로, 풀이의 숫자는 인용에 있는 것만
export function checkGlossary(text, srcText) {
  const errors = [];
  const { data, error } = parseJsonFile("glossary.json", text);
  if (error) return [error];
  const src = JSON.parse(srcText).items || {};
  const ids = new Set();
  for (const t of data.terms || []) {
    const at = `glossary.json "${t.id}"`;
    if (ids.has(t.id)) errors.push(`${at}: id가 겹칩니다.`);
    ids.add(t.id);
    if (!t.term || !t.plain || !t.law || !t.quotes?.length) { errors.push(`${at}: term·plain·law·quotes가 있어야 합니다.`); continue; }
    for (const q of t.quotes) if (!src[q.src]?.lines?.some((l) => l.includes(q.text))) errors.push(`${at}: 인용이 원문(${q.src})에 글자 그대로 없습니다 — "${String(q.text).slice(0, 30)}…"`);
    const quoted = t.quotes.map((q) => q.text).join(" ");
    for (const n of String(t.plain).match(/\d[\d,]*(?:억|천만|만)?/g) || []) if (!quoted.includes(n)) errors.push(`${at}: 풀이의 숫자 "${n}"이(가) 인용 원문에 없습니다.`);
    if (!src[t.quotes[0].src] || !t.law.startsWith(src[t.quotes[0].src].law)) errors.push(`${at}: law(${t.law})가 원문 법 이름과 다릅니다.`);
  }
  return errors;
}

// 주제 모아 보기(4차 A1): 주제마다 가리키는 기한·용어·질문 분야·계산기·서비스·칼럼 주제·책이 실제로 있는지
export function checkTopics(text, ctx) {
  const errors = [];
  const { data, error } = parseJsonFile("topics.json", text);
  if (error) return [error];
  const KINDS = [["events", "eventIds", "deadlines.json events"], ["yearly", "yearlyIds", "deadlines.json yearly"], ["glossary", "glossaryIds", "glossary.json"],
    ["faq", "faqCats", "FAQ category"], ["calculators", "calcSlugs", "calculators.json"], ["services", "svcSlugs", "services.json"], ["press", "pressTopics", "press.json topic"], ["books", "bookTitles", "home.json books"]];
  const seen = new Set();
  for (const t of data.topics || []) {
    const at = `topics.json "${t.slug}"`;
    if (!/^[a-z][a-z-]*$/.test(t.slug || "") || !t.name || !t.lead) errors.push(`${at}: slug(영문 소문자)·name·lead가 있어야 합니다.`);
    if (seen.has(t.slug)) errors.push(`${at}: slug가 겹칩니다.`);
    seen.add(t.slug);
    for (const [k, set, label] of KINDS) for (const v of t[k] || []) if (!ctx[set].has(v)) errors.push(`${at}: ${k} "${v}"는 ${label}에 없습니다.`);
    if (!(t.events?.length || t.yearly?.length)) errors.push(`${at}: 기한(events 또는 yearly)이 하나는 있어야 합니다.`);
  }
  if ((data.topics || []).length < 1) errors.push("topics.json: topics가 비었습니다.");
  return errors;
}

// 세금 생애 지도(4차 D1): 정거장마다 상황 길잡이 상황·주제·용어 id가 실제로 있는지, id 겹침 없음
export function checkLifemap(text, { guideIds, topicSlugs, glossaryIds }) {
  const errors = [];
  const { data, error } = parseJsonFile("lifemap.json", text);
  if (error) return [error];
  const seen = new Set();
  for (const s of [...(data.stops || []), ...(data.anytime || [])]) {
    const at = `lifemap.json "${s.id}"`;
    if (!/^[a-z][a-z-]*$/.test(s.id || "") || !s.label) errors.push(`${at}: id(영문 소문자)·label이 있어야 합니다.`);
    if (seen.has(s.id)) errors.push(`${at}: id가 겹칩니다.`);
    seen.add(s.id);
    if (!guideIds.has(s.guide)) errors.push(`${at}: guide "${s.guide}"는 guide.json situations에 없습니다.`);
    if (s.topic && !topicSlugs.has(s.topic)) errors.push(`${at}: topic "${s.topic}"는 topics.json에 없습니다.`);
    for (const g of s.glossary || []) if (!glossaryIds.has(g)) errors.push(`${at}: glossary "${g}"는 glossary.json에 없습니다.`);
  }
  if ((data.stops || []).length < 3) errors.push("lifemap.json: stops가 셋 이상이어야 합니다.");
  return errors;
}

export function checkSite(text) {
  const errors = [];
  const { data, error } = parseJsonFile("site.json", text);
  if (error) return [error];
  for (const k of ["name", "rep", "repTitle", "siteUrl", "email", "kakaoUrl", "hours"]) {
    if (!data[k]) errors.push(`site.json: ${k}가 비었습니다.`);
  }
  if (!/^https:\/\//.test(data.taxSearch?.url || "")) errors.push("site.json: taxSearch.url(통합검색 22 주소)이 비었거나 https로 시작하지 않습니다.");
  return errors;
}

export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, "\n"));
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: m[2].trim() };
}

export function checkFaq(name, text) {
  const errors = [];
  const p = parseFrontmatter(text);
  if (!p) return [`faq/${name}: 맨 위 --- 사이 머리말이 없습니다.`];
  if (!p.fm.q) errors.push(`faq/${name}: q(질문)가 비었습니다.`);
  if (!p.fm.category) errors.push(`faq/${name}: category가 비었습니다.`);
  if (!p.fm.order || !/^\d+$/.test(p.fm.order)) errors.push(`faq/${name}: order는 숫자여야 합니다.`);
  if (!p.body) errors.push(`faq/${name}: 답 본문이 비었습니다.`);
  return errors;
}

// 운영자 결정(2026-10-24): 운영자가 말하기 전까지 "세무사" 명칭을 쓰지 않는다.
export const BANNED_WORDS = ["세무사"];
export function checkBannedWords(name, text) {
  return BANNED_WORDS.filter((w) => text.includes(w)).map((w) => `${name}: "${w}" 명칭은 쓰지 않습니다(운영자 결정). "세무전문가"로 바꾸세요.`);
}

export function validateAll(root = ROOT) {
  const read = (p) => readFileSync(join(root, p), "utf8");
  const errors = [];
  const calcText = read("src/data/calculators.json");
  errors.push(...checkCalculators(calcText));
  let calcSlugs = new Set();
  try { calcSlugs = new Set(JSON.parse(calcText).calculators.map((c) => c.slug)); } catch {}
  const dlText = read("src/data/deadlines.json");
  errors.push(...checkDeadlines(dlText));
  let eventIds = new Set();
  let yearlyIds = new Set();
  try { eventIds = new Set(JSON.parse(dlText).events.map((e) => e.id)); yearlyIds = new Set(JSON.parse(dlText).yearly.map((e) => e.id)); } catch {}
  errors.push(...checkServices(read("src/data/services.json"), calcSlugs, eventIds, yearlyIds));
  errors.push(...checkSite(read("src/data/site.json")));
  let svcSlugs = new Set();
  try { svcSlugs = new Set(JSON.parse(read("src/data/services.json")).services.map((s) => s.slug)); } catch {}
  errors.push(...checkHome(read("src/data/home.json"), svcSlugs, root));
  errors.push(...checkPress(read("src/data/press.json"), svcSlugs, calcSlugs));
  errors.push(...checkGlossary(read("src/data/glossary.json"), read("docs/glossary-sources.json")));
  errors.push(...checkGuide(read("src/data/guide.json"), svcSlugs, calcSlugs, eventIds, yearlyIds));
  {
    const ids = (f, pick) => { try { return new Set(pick(JSON.parse(read(f)))); } catch { return new Set(); } };
    const faqCats = new Set(readdirSync(join(root, "src/content/faq")).filter((f) => f.endsWith(".md"))
      .map((f) => (readFileSync(join(root, "src/content/faq", f), "utf8").match(/^category:\s*(.+)$/m) || [])[1]?.trim()).filter(Boolean));
    errors.push(...checkTopics(read("src/data/topics.json"), {
      svcSlugs, calcSlugs, eventIds, yearlyIds, faqCats,
      glossaryIds: ids("src/data/glossary.json", (d) => d.terms.map((t) => t.id)),
      pressTopics: ids("src/data/press.json", (d) => d.articles.map((a) => a.topic)),
      bookTitles: ids("src/data/home.json", (d) => d.books.map((b) => b.title)),
    }));
    errors.push(...checkLifemap(read("src/data/lifemap.json"), {
      guideIds: ids("src/data/guide.json", (d) => d.situations.map((s) => s.id)),
      topicSlugs: ids("src/data/topics.json", (d) => d.topics.map((t) => t.slug)),
      glossaryIds: ids("src/data/glossary.json", (d) => d.terms.map((t) => t.id)),
    }));
  }
  for (const f of ["src/data/calculators.json", "src/data/services.json", "src/data/site.json", "src/data/home.json", "src/data/videos.json", "src/data/deadlines.json", "src/data/press.json", "src/data/guide.json", "src/data/glossary.json", "src/data/topics.json", "src/data/lifemap.json"]) {
    errors.push(...checkBannedWords(f, read(f)));
  }
  const faqDir = join(root, "src/content/faq");
  for (const f of readdirSync(faqDir).filter((f) => f.endsWith(".md"))) {
    const t = readFileSync(join(faqDir, f), "utf8");
    errors.push(...checkFaq(f, t), ...checkBannedWords(`faq/${f}`, t));
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = validateAll();
  if (errors.length) {
    console.error("\n자료 파일에 고칠 곳이 있어 빌드를 멈춥니다:\n");
    for (const e of errors) console.error(" - " + e);
    console.error("");
    process.exit(1);
  }
  console.log("자료 파일 검사 통과");
}
