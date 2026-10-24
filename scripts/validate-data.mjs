// 빌드 전에 운영자가 고치는 파일(src/data/*.json, src/content/faq/*.md)을 검사한다.
// 틀린 곳이 있으면 파일 이름과 줄 번호를 한국어로 알려 주고 빌드를 멈춘다.
import { readFileSync, readdirSync } from "node:fs";
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
  });
  if (!seen.size) errors.push("calculators.json: calculators가 비었습니다.");
  return errors;
}

export function checkServices(text, calcSlugs) {
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
    for (const c of s.calculators || []) {
      if (!calcSlugs.has(c)) errors.push(`${at}: 계산기 "${c}"는 calculators.json에 없습니다.`);
    }
  });
  return errors;
}

export function checkSite(text) {
  const errors = [];
  const { data, error } = parseJsonFile("site.json", text);
  if (error) return [error];
  for (const k of ["name", "rep", "repTitle", "siteUrl", "email", "kakaoUrl", "hours"]) {
    if (!data[k]) errors.push(`site.json: ${k}가 비었습니다.`);
  }
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
  errors.push(...checkServices(read("src/data/services.json"), calcSlugs));
  errors.push(...checkSite(read("src/data/site.json")));
  for (const f of ["src/data/calculators.json", "src/data/services.json", "src/data/site.json"]) {
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
