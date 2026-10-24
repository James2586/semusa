// 용어 풀이 근거(2026-10-24 3차 C3): 택스 서치가 법제처에서 받아 둔 법조문 원문(tests/fixtures/*-law*.json)에서
// 용어 풀이가 인용하는 조문만 docs/glossary-sources.json으로 옮긴다. 손으로 고치지 말고:
//   node scripts/make-glossary-sources.mjs [택스 서치 tests/fixtures 경로 — 기본 ../tax-search/tests/fixtures]
// tests/glossary.test.mjs가 src/data/glossary.json의 인용(quote)을 이 파일 원문과 글자 그대로 대조한다.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DIR = resolve(process.argv[2] || join(new URL("..", import.meta.url).pathname, "../tax-search/tests/fixtures"));
const J = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const at = (o, path) => path.reduce((x, k) => x?.[k], o);

// [근거 이름, 파일, 조문 위치, 법 이름, 조문 표시, 공포·시행 메타 위치]
const SPEC = [
  ["income88", "transfer-tax-law.json", ["articles", "income", "88"], "소득세법", "제88조", ["meta", "income"]],
  ["income127", "withholding-law-excerpts.json", ["act", "127"], "소득세법", "제127조", ["actMeta"]],
  ["local6", "acq-heavy-law.json", ["articles", "localTax", "6"], "지방세법", "제6조", ["meta", "localTax"]],
  ["inherit21", "inherit-tax-law.json", ["articles", "inherit", "21"], "상속세 및 증여세법", "제21조", ["meta", "inherit"]],
  ["inherit47", "gift-tax-law.json", ["articles", "inherit", "47"], "상속세 및 증여세법", "제47조", ["meta", "inherit"]],
  ["inherit53", "gift-tax-law.json", ["articles", "inherit", "53"], "상속세 및 증여세법", "제53조", ["meta", "inherit"]],
  ["basic26_2", "gift-tax-law.json", ["articles", "basic", "26의2"], "국세기본법", "제26조의2", ["meta", "basic"]],
  ["basic45", "inherit-expert-law.json", ["articles", "basic", "45"], "국세기본법", "제45조", ["meta", "basic"]],
  ["basic45_2", "late-correction-law.json", ["excerpts", "basic45_2"], "국세기본법", "제45조의2", ["meta", "basic"]],
  ["basic45_3", "inherit-expert-law.json", ["articles", "basic", "45의3"], "국세기본법", "제45조의3", ["meta", "basic"]],
  ["basic55", "procedure-law-excerpts.json", ["basic", "55"], "국세기본법", "제55조", ["basicMeta"]],
  ["basic61", "procedure-law-excerpts.json", ["basic", "61"], "국세기본법", "제61조", ["basicMeta"]],
  ["basic66", "procedure-law-excerpts.json", ["basic", "66"], "국세기본법", "제66조", ["basicMeta"]],
  ["basic68", "procedure-law-excerpts.json", ["basic", "68"], "국세기본법", "제68조", ["basicMeta"]],
  ["basic81_15", "procedure-law-excerpts.json", ["basic", "81의15"], "국세기본법", "제81조의15", ["basicMeta"]],
];

const items = {};
for (const [id, file, path, law, article, metaPath] of SPEC) {
  const j = J(file), a = at(j, path), m = at(j, metaPath) || {};
  if (!a?.lines?.length) throw new Error(`${file} ${path.join("/")}: 조문이 없음`);
  if (m.law && m.law !== law) throw new Error(`${id}: 법 이름이 다름 ${m.law} ≠ ${law}`);
  items[id] = { law, article, title: a.title, promulgationDate: m.promulgationDate || null, promulgationNo: m.promulgationNo || null,
    effectiveDate: a.effectiveDate || m.basicEffectiveDate || null, fetchedAt: j.fetchedAt, from: `tax-search tests/fixtures/${file}`, lines: a.lines.map((l) => l.t) };
}
writeFileSync(join(new URL("..", import.meta.url).pathname, "docs/glossary-sources.json"),
  JSON.stringify({ _note: "용어 풀이 인용 원문 — 법제처 법령 원문을 택스 서치가 받아 둔 것. scripts/make-glossary-sources.mjs로만 갱신.", items }, null, 1) + "\n");
console.log(`조문 ${Object.keys(items).length}개 → docs/glossary-sources.json`);
