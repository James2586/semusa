// 자주 묻는 질문 근거(2026-10-25 6차 D): 택스 서치가 법제처에서 받아 둔 법조문 원문(tests/fixtures/*-law*.json)에서
// 질문 답이 인용하는 조문만 docs/faq-sources.json으로 옮긴다. 손으로 고치지 말고:
//   node scripts/make-faq-sources.mjs [택스 서치 tests/fixtures 경로 — 기본 ../tax-search/tests/fixtures] [--check]
// scripts/validate-data.mjs checkFaq가 답의 숫자를 고른 원문 줄과 대조한다(src 칸이 있는 질문).
import { readFileSync } from "node:fs";
import { argDir, writeOrCheck } from "./lib/sourceCheck.mjs";
import { join, resolve } from "node:path";

const DIR = resolve(argDir(join(new URL("..", import.meta.url).pathname, "../tax-search/tests/fixtures")));
const J = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const at = (o, path) => path.reduce((x, k) => x?.[k], o);
const eff = (m) => m.effective || m.effectiveDate || m.basicEffectiveDate || null;

// [근거 이름, 파일, 조문 위치, 법 이름, 조문 표시, 공포·시행 메타 위치]
const SPEC = [
  ["inherit13", "inherit-tax-law.json", ["articles", "inherit", "13"], "상속세 및 증여세법", "제13조", ["meta", "inherit"]],
  ["inherit21", "inherit-tax-law.json", ["articles", "inherit", "21"], "상속세 및 증여세법", "제21조", ["meta", "inherit"]],
  ["inherit47", "gift-tax-law.json", ["articles", "inherit", "47"], "상속세 및 증여세법", "제47조", ["meta", "inherit"]],
  ["inherit53_2", "gift-tax-law.json", ["articles", "inherit", "53의2"], "상속세 및 증여세법", "제53조의2", ["meta", "inherit"]],
  ["income14", "ceo-pay-law.json", ["articles", "income", "14"], "소득세법", "제14조", ["meta", "income"]],
  ["income88", "transfer-tax-law.json", ["articles", "income", "88"], "소득세법", "제88조", ["meta", "income"]],
  ["income89", "transfer-tax-law.json", ["articles", "income", "89"], "소득세법", "제89조", ["meta", "income"]],
  ["income95", "transfer-tax-law.json", ["articles", "income", "95"], "소득세법", "제95조", ["meta", "income"]],
  ["income105", "transfer-tax-law.json", ["articles", "income", "105"], "소득세법", "제105조", ["meta", "income"]],
  ["incomeD154", "transfer-tax-law.json", ["articles", "incomeDecree", "154"], "소득세법 시행령", "제154조", ["meta", "incomeDecree"]],
  ["incomeD155", "transfer-tax-law.json", ["articles", "incomeDecree", "155"], "소득세법 시행령", "제155조", ["meta", "incomeDecree"]],
  ["local20", "acq-tax-law.json", ["articles", "localTax", "20"], "지방세법", "제20조", ["meta", "localTax"]],
  ["jong10_2", "jongbu-tax-law.json", ["articles", "jong26", "10의2"], "종합부동산세법", "제10조의2", ["meta", "jong26"]],
  ["jong16", "jongbu-tax-law.json", ["articles", "jong26", "16"], "종합부동산세법", "제16조", ["meta", "jong26"]],
  ["corp60", "corp-gift-law.json", ["articles", "corp", "60"], "법인세법", "제60조", ["meta", "corp"]],
  ["basic45_2", "procedure-law-excerpts.json", ["basic", "45의2"], "국세기본법", "제45조의2", ["basicMeta"]],
  ["basic61", "procedure-law-excerpts.json", ["basic", "61"], "국세기본법", "제61조", ["basicMeta"]],
  ["basic66", "procedure-law-excerpts.json", ["basic", "66"], "국세기본법", "제66조", ["basicMeta"]],
  ["basic68", "procedure-law-excerpts.json", ["basic", "68"], "국세기본법", "제68조", ["basicMeta"]],
  ["basic81_15", "procedure-law-excerpts.json", ["basic", "81의15"], "국세기본법", "제81조의15", ["basicMeta"]],
  // 불복 절차 한눈에 표(2026-10-25, src/data/appeal.json) — 결정 기간·행정소송·기한 특례
  ["basic5", "decision-period-law.json", ["basic", "5"], "국세기본법", "제5조", ["meta", "basic"]],
  ["basic56", "decision-period-law.json", ["basic", "56"], "국세기본법", "제56조", ["meta", "basic"]],
  ["basic65", "decision-period-law.json", ["basic", "65"], "국세기본법", "제65조", ["meta", "basic"]],
  ["basic80_2", "decision-period-law.json", ["basic", "80의2"], "국세기본법", "제80조의2", ["meta", "basic"]],
];

const items = {};
for (const [id, file, path, law, article, metaPath] of SPEC) {
  const j = J(file), a = at(j, path), m = at(j, metaPath) || {};
  if (!a?.lines?.length) throw new Error(`${file} ${path.join("/")}: 조문이 없음`);
  if (m.law && m.law !== law) throw new Error(`${id}: 법 이름이 다름 ${m.law} ≠ ${law}`);
  items[id] = { law, article, title: a.title, promulgationDate: m.promulgationDate || null, promulgationNo: m.promulgationNo || null,
    effectiveDate: a.effectiveDate || eff(m), fetchedAt: j.fetchedAt, from: `tax-search tests/fixtures/${file}`, lines: a.lines.map((l) => ({ d: l.d, t: l.t })) };
}
writeOrCheck(join(new URL("..", import.meta.url).pathname, "docs/faq-sources.json"), items,
  "자주 묻는 질문 근거 원문 — 법제처 법령 원문을 택스 서치가 받아 둔 것. scripts/make-faq-sources.mjs로만 갱신.", "질문 근거 원문");
