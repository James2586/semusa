// 🛡 CSP 보고 단계(2026-10-29, scripts/csp.mjs) — 빌드한 dist와 vercel.json 값이 같은지(화면 안 스크립트를 고치고 지문을 안 바꾸면 여기서 걸림)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, inlineScriptHashes, calculatorOrigins, buildCsp, currentCsp, REPORT_URI } from "../scripts/csp.mjs";

test("vercel.json CSP(보고만) = 지금 dist 화면 안 스크립트 지문 + 계산기 출처", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "dist")), "npm run build 뒤에 돈다");
  const want = buildCsp({ hashes: inlineScriptHashes(), frames: calculatorOrigins() });
  assert.equal(currentCsp(), want, "화면 안 스크립트·계산기 목록이 바뀌었으면 빌드 뒤 node scripts/csp.mjs");
  assert.ok(inlineScriptHashes().length <= 6, "화면 안 스크립트는 is:inline 몇 개뿐(assetsInlineLimit — 스크립트만 파일로)");
  assert.doesNotMatch(want, /script-src[^;]*'unsafe-inline'/);
  assert.ok(want.endsWith(`report-uri ${REPORT_URI}`));
  assert.doesNotMatch(want, /report-to/);
  const vj = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(!vj.headers.flatMap((h) => h.headers).some((h) => h.key === "Content-Security-Policy"), "아직 차단하지 않는다(운영자 결정)");
  assert.match(fs.readFileSync(path.join(ROOT, "astro.config.mjs"), "utf8"), /assetsInlineLimit: \(file\) => \(\/\\.\(m\?js\|ts\)\$\/\.test\(file\) \? false : undefined\)/);
});

test("모든 계산기 출처가 frame-src에, 처리방침에 보고 안내", () => {
  const csp = currentCsp();
  for (const o of calculatorOrigins()) assert.ok(csp.includes(o), o);
  assert.match(fs.readFileSync(path.join(ROOT, "src/pages/privacy.astro"), "utf8"), /세무 지식 통합검색 서버로 보내며/);
});
