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

export function checkServices(text, calcSlugs, eventIds = null) {
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
    // 표지 사진(선택): public/ 아래 실제 파일이어야 한다
    if (b.cover !== undefined && !(/^\/img\/books\/[a-z0-9-]+\.(webp|png|jpg)$/.test(b.cover) && existsSync(join(root, "public", b.cover)))) errors.push(`home.json: ${i + 1}번째 책 cover "${b.cover}" 파일이 public/img/books/에 없습니다.`);
  });
  for (const k of ["consult", "steps", "prepare"]) if (!(data[k] || []).length) errors.push(`home.json: ${k}가 비었습니다.`);
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
  try { eventIds = new Set(JSON.parse(dlText).events.map((e) => e.id)); } catch {}
  errors.push(...checkServices(read("src/data/services.json"), calcSlugs, eventIds));
  errors.push(...checkSite(read("src/data/site.json")));
  let svcSlugs = new Set();
  try { svcSlugs = new Set(JSON.parse(read("src/data/services.json")).services.map((s) => s.slug)); } catch {}
  errors.push(...checkHome(read("src/data/home.json"), svcSlugs, root));
  for (const f of ["src/data/calculators.json", "src/data/services.json", "src/data/site.json", "src/data/home.json", "src/data/videos.json", "src/data/deadlines.json"]) {
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
