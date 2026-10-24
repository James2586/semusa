// 세율·공제 한눈에 근거(2026-10-24 5차 A1): 택스 서치가 법제처에서 받아 둔 법조문 원문(tests/fixtures/*-law*.json)에서
// /rates가 보이는 조문·부칙만 docs/rates-sources.json으로 옮긴다. 손으로 고치지 말고:
//   node scripts/make-rates-sources.mjs [택스 서치 tests/fixtures 경로 — 기본 ../tax-search/tests/fixtures]
// 쪽은 이 파일의 원문 줄을 그대로 그린다(표는 src/lib/lawTable.js가 선 문자 표를 풀어서) — 숫자를 따로 옮겨 적지 않는다.
import { readFileSync } from "node:fs";
import { argDir, writeOrCheck } from "./lib/sourceCheck.mjs";
import { join, resolve } from "node:path";

const DIR = resolve(argDir(join(new URL("..", import.meta.url).pathname, "../tax-search/tests/fixtures")));
const J = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const at = (o, path) => path.reduce((x, k) => x?.[k], o);
const ymd = (s) => `${Number(s.slice(0, 4))}. ${Number(s.slice(4, 6))}. ${Number(s.slice(6, 8))}.`;
const eff = (m) => m.effective || m.effectiveDate || m.basicEffectiveDate || null;

// [근거 이름, 파일, 조문 위치, 법 이름, 조문 표시, 메타 위치]
const SPEC = [
  ["inherit26", "inherit-tax-law.json", ["articles", "inherit", "26"], "상속세 및 증여세법", "제26조", ["meta", "inherit"]],
  ["inherit56", "gift-tax-law.json", ["articles", "inherit", "56"], "상속세 및 증여세법", "제56조", ["meta", "inherit"]],
  ["inherit18", "inherit-tax-law.json", ["articles", "inherit", "18"], "상속세 및 증여세법", "제18조", ["meta", "inherit"]],
  ["inherit21", "inherit-tax-law.json", ["articles", "inherit", "21"], "상속세 및 증여세법", "제21조", ["meta", "inherit"]],
  ["inherit22", "inherit-tax-law.json", ["articles", "inherit", "22"], "상속세 및 증여세법", "제22조", ["meta", "inherit"]],
  ["inherit53", "gift-tax-law.json", ["articles", "inherit", "53"], "상속세 및 증여세법", "제53조", ["meta", "inherit"]],
  ["income104", "transfer-tax-law.json", ["articles", "income", "104"], "소득세법", "제104조", ["meta", "income"]],
  ["local11", "acq-tax-law.json", ["articles", "localTax", "11"], "지방세법", "제11조", ["meta", "localTax"]],
  ["jong9", "jongbu-tax-law.json", ["articles", "jong26", "9"], "종합부동산세법", "제9조", ["meta", "jong26"]],
  ["income55", "ceo-pay-law.json", ["articles", "income", "55"], "소득세법", "제55조", ["meta", "income"]],
  ["corp55", "corp-gift-law.json", ["articles", "corp", "55"], "법인세법", "제55조", ["meta", "corp"]],
  ["corp55_2025", "corp-gift-law.json", ["articles", "corp2025", "55"], "법인세법", "제55조", ["meta", "corp2025"]],
];
// 부칙(시행일·적용례) — 원문 한 줄씩. 그 부칙의 법률 번호가 같은 무리의 조문 판과 같아야 한다(checkRates).
// 바로 앞 판(corp55_2025)엔 부칙을 붙이지 않는다 — 그 판의 1호 세율은 더 앞선 개정에서 온 것이라 제20613호 부칙이 적용례가 아니다(2026-10-24 검토).
const ADDENDA = [
  ["corpAdd21217_1", "corp-gift-law.json", ["addenda", "corp21217"], "1"],
  ["corpAdd21217", "corp-gift-law.json", ["addenda", "corp21217"], "5"],
];

const items = {};
for (const [id, file, path, law, article, metaPath] of SPEC) {
  const j = J(file), a = at(j, path), m = at(j, metaPath) || {};
  if (!a?.lines?.length) throw new Error(`${file} ${path.join("/")}: 조문이 없음`);
  if (m.law && m.law !== law) throw new Error(`${id}: 법 이름이 다름 ${m.law} ≠ ${law}`);
  items[id] = { law, article, title: a.title, promulgationDate: m.promulgationDate || null, promulgationNo: m.promulgationNo || null,
    effectiveDate: a.effectiveDate || eff(m), fetchedAt: j.fetchedAt, from: `tax-search tests/fixtures/${file}`, lines: a.lines.map((l) => ({ d: l.d, t: l.t })) };
}
for (const [id, file, path, art] of ADDENDA) {
  const j = J(file), a = at(j, path);
  const t = a?.articles?.[art];
  if (!t) throw new Error(`${id}: 부칙 제${art}조가 없음`);
  items[id] = { law: a.law, article: `부칙(법률 제${a.promulgationNo}호, ${ymd(a.promulgationDate)} 공포) 제${art}조`, title: art === "1" ? "시행일" : "적용례", promulgationDate: a.promulgationDate, promulgationNo: a.promulgationNo,
    effectiveDate: null, fetchedAt: j.fetchedAt, from: `tax-search tests/fixtures/${file}`, lines: [{ d: 1, t }] };
}
writeOrCheck(join(new URL("..", import.meta.url).pathname, "docs/rates-sources.json"), items,
  "세율·공제 한눈에(/rates) 원문 — 법제처 법령 원문을 택스 서치가 받아 둔 것. scripts/make-rates-sources.mjs로만 갱신.", "세율·공제 원문");
