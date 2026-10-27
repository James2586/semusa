// 🛡 보안 점검 도구(2026-10-27, scripts/security-scan.mjs·scripts/security/) 시험:
//   ① 이 저장소에 기준선(security/baseline.json)에 없는 새 보안 경보가 없고, 지울 기준선 항목도 없다 — 새 경보는 고치거나,
//      의도한 것이면 `npm run security:scan -- --update-baseline` 뒤 그 항목에 status·reason을 적는다.
//   ② 이 저장소 규칙(주소·브라우저 저장소 값 → innerHTML, <script> 안 JSON, 자료 파일의 비밀 키)이 실제로 잡는지.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { runScan } = await import("../scripts/security-scan.mjs");
const { runRules, domXssInCode, astroScripts } = await import("../scripts/security/rules.mjs");
const { loadBaseline } = await import("../scripts/security/core.mjs");

const ROOT = path.join(import.meta.dirname, "..");

test("이 저장소: 기준선에 없는 새 보안 경보가 없고, 지울 기준선 항목도 없다", () => {
  const { comparison } = runScan(ROOT);
  const fresh = comparison.fresh.map((f) => `  [${f.severity}] ${f.file}:${f.line} ${f.rule} — ${f.message}`);
  assert.deepEqual(fresh, [], "새 보안 경보 — 고치거나, 의도한 것이면 기준선에 이유와 함께 더한다:\n" + fresh.join("\n"));
  assert.deepEqual(comparison.stale.map((e) => e.key), [], "이제 나오지 않는 기준선 항목 — 고쳤다면 security/baseline.json에서 지운다");
});

test("기준선: accepted 항목은 이유가 있고 key가 겹치지 않는다", () => {
  const b = loadBaseline(path.join(ROOT, "security", "baseline.json"));
  const keys = b.entries.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const e of b.entries) if (e.status === "accepted") assert.ok(e.reason.trim().length >= 10, e.key);
});

test("DOM XSS: 주소·localStorage 값을 innerHTML에 그대로 넣으면 잡고, 목록에서 고른 값·esc()·textContent는 통과", () => {
  const bad = `
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    out.innerHTML = \`<b>\${q}</b>\`;
    const memo = localStorage.getItem("memo");
    box.insertAdjacentHTML("beforeend", "<p>" + memo + "</p>");
    a.href = location.hash.slice(1);
  `;
  const r = domXssInCode(bad, "x.ts");
  assert.deepEqual(r.findings.map((f) => f.rule).sort(), ["xss/dom-source", "xss/dom-source", "xss/dom-url"]);
  const good = `
    const params = new URLSearchParams(location.search);
    const pe = events.find((e) => e.id === params.get("e"));
    out.innerHTML = \`<b>\${pe.name}</b>\`;
    out.innerHTML = \`<b>\${esc(params.get("q"))}</b>\`;
    out.textContent = params.get("q");
  `;
  assert.deepEqual(domXssInCode(good, "y.ts").findings, []);
});

test(".astro 스크립트 꺼내기: 자료용 set:html·JSON 태그(화살표 > 포함)는 건너뛰고 화면 스크립트만, 줄 번호는 파일 기준", () => {
  const code = [
    "---",
    "const x = 1;",
    "---",
    '<script type="application/json" set:html={JSON.stringify(list.map((a) => a)).replace(/</g, "\\\\u003c")} />',
    "<script>",
    "  el.innerHTML = location.search;",
    "</script>",
  ].join("\n");
  const s = astroScripts(code);
  assert.equal(s.length, 1);
  const f = domXssInCode(s[0].text, "p.astro", s[0].line).findings;
  assert.equal(f[0].line, 6);
});

test("<script> 안 JSON·자료 파일 비밀 키", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secscan-"));
  fs.mkdirSync(path.join(dir, "src/components"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src/data"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/components/A.astro"), '<script type="application/ld+json" set:html={JSON.stringify(ld)} />\n<script type="application/json" set:html={JSON.stringify(x).replace(/</g, "\\\\u003c")} />');
  fs.writeFileSync(path.join(dir, "src/data/site.json"), JSON.stringify({ kakaoMapKey: "abc", kakaoRestKey: "def" }));
  const f = runRules(dir).findings;
  assert.deepEqual(f.filter((x) => x.rule === "xss/json-in-script").map((x) => x.line), [1]);
  assert.deepEqual(f.filter((x) => x.rule === "secret/data-key").map((x) => x.key.split("|")[2]), ["kakaoRestKey"]);
});
