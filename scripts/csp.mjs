// 🛡 CSP 보고 단계(2026-10-29 운영자 「전부 진행해」) — vercel.json의 Content-Security-Policy-Report-Only 값을 만든다.
//   화면 안에 직접 적힌 스크립트(is:inline 5종 — 글자 크게·오프라인 등록·마감 띠·계산기 틀·자릿수 바퀴)는 지문(sha256)으로만 허용하고,
//   계산기 틀(iframe)은 calculators.json 주소의 출처만. Astro가 작은 스크립트를 화면에 끼워 넣지 않게 astro.config.mjs assetsInlineLimit(스크립트만 — 스타일은 예전처럼).
//   보고는 택스 서치 /api/admin?resource=csp&site=semusa(관리자 탭 ④). 막지 않는다 — 차단 전환은 운영자 결정.
//   node scripts/csp.mjs          빌드한 dist로 값을 다시 만들어 vercel.json에 씀(화면 안 스크립트를 고쳤으면 빌드 뒤 이것)
//   node scripts/csp.mjs --check  vercel.json 값이 지금 dist와 같은지만(다르면 exit 1) — tests/csp.test.mjs가 같은 대조
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CSP_HEADER = "Content-Security-Policy-Report-Only";
export const REPORT_URI = "https://tax-search-rho.vercel.app/api/admin?resource=csp&site=semusa";

function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** dist 쪽마다 화면 안에 적힌 실행 스크립트(src 없음·JSON 아님)의 sha256 지문 — 정렬, 중복 없이 */
export function inlineScriptHashes(distDir = path.join(ROOT, "dist")) {
  const set = new Set();
  for (const f of htmlFiles(distDir)) {
    const s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1] || "";
      if (/\ssrc=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs)) continue;
      set.add(`'sha256-${crypto.createHash("sha256").update(m[2], "utf8").digest("base64")}'`);
    }
  }
  return [...set].sort();
}

/** 계산기 틀 출처 — calculators.json 주소에서(새 계산기를 더하면 여기 저절로) */
export function calculatorOrigins(root = ROOT) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "src/data/calculators.json"), "utf8"));
  return [...new Set((d.calculators || []).map((c) => new URL(c.url).origin))].sort();
}

export function buildCsp({ hashes, frames }) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")} https://dapi.kakao.com https://t1.daumcdn.net`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://dapi.kakao.com",
    "media-src 'self'",
    `frame-src ${frames.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `report-uri ${REPORT_URI}`,
  ].join("; ");
}

function currentCspFromText(text) {
  const vj = JSON.parse(text);
  return vj.headers.flatMap((h) => h.headers).find((h) => h.key === CSP_HEADER)?.value || null;
}
export function currentCsp(root = ROOT) {
  return currentCspFromText(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
}

function main() {
  const want = buildCsp({ hashes: inlineScriptHashes(), frames: calculatorOrigins() });
  if (process.argv.includes("--check")) {
    if (currentCsp() !== want) { console.error("vercel.json CSP가 지금 dist와 다릅니다 — node scripts/csp.mjs로 다시 만드세요."); process.exitCode = 1; }
    else console.log("CSP 같음");
    return;
  }
  // 파일 모양(한 줄에 한 헤더)을 그대로 두고 그 값만 바꾼다
  const p = path.join(ROOT, "vercel.json");
  let text = fs.readFileSync(p, "utf8");
  const line = `        { "key": "${CSP_HEADER}", "value": ${JSON.stringify(want)} }`;
  const re = new RegExp(`^ *\\{ "key": "${CSP_HEADER}", "value": .*\\}$`, "m");
  if (re.test(text)) text = text.replace(re, () => line);
  else text = text.replace(/^( *\{ "key": "X-Frame-Options", "value": "SAMEORIGIN" \})$/m, (m) => `${m},\n${line}`);
  JSON.parse(text);
  if (currentCspFromText(text) !== want) throw new Error("vercel.json에 CSP 줄을 넣지 못했습니다(X-Frame-Options 줄 모양 확인)");
  fs.writeFileSync(p, text);
  console.log(`vercel.json CSP 다시 만듦 — 화면 안 스크립트 지문 ${inlineScriptHashes().length}개, 계산기 출처 ${calculatorOrigins().length}개`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
