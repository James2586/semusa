// 🛡 semusa(홈페이지) 보안 점검 규칙(2026-10-27). 공용 엔진은 ./core.mjs(tax-search·stock-valuation과 같은 파일), 이 파일은 이 저장소 전용.
//   서버가 없는 정적 사이트라 볼 곳은 ① 화면 스크립트가 주소(?e=·#…)·브라우저 저장소 값을 innerHTML로 넣는지(DOM XSS)
//   ② JSON-LD·자료 칸을 <script>에 넣을 때 </script> 끊김 막기 ③ 자료 파일의 비밀 키 ④ 보안 헤더 ⑤ 의존성.
import {
  walkFiles, readText, parseCode, traverse, calleeName, isCall, memberPath, isFunctionNode, lineOf, nodeText, makeFinding,
  scanSecrets, checkVercelHeaders, 
} from "./core.mjs";
import { runSitePlan, siteProbeSection } from "./probe.mjs";

export const TITLE = "semusa(홈페이지) 보안 점검 보고서";
export const AUDIT_NOTES = {};

// .astro 파일의 화면 스크립트(<script>…</script>, 자료용 application/json·ld+json과 src= 바깥 파일 제외) — [글, 시작 줄]
export function astroScripts(code) {
  const out = [];
  let i = 0;
  while ((i = code.indexOf("<script", i)) !== -1) {
    // 여는 태그 끝: { } 안의 > (화살표 함수 등)는 건너뛴다
    let j = i + 7;
    let depth = 0;
    for (; j < code.length; j++) {
      const ch = code[j];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth <= 0) break;
    }
    const attrs = code.slice(i + 7, j);
    const selfClosing = code[j - 1] === "/";
    const close = selfClosing ? j : code.indexOf("</script>", j);
    if (close === -1) break;
    if (!selfClosing && !/\bsrc=|type=["']application\/(ld\+)?json["']|set:html/.test(attrs)) {
      out.push({ text: code.slice(j + 1, close), line: code.slice(0, j + 1).split("\n").length - 1 });
    }
    i = selfClosing ? j + 1 : close + 9;
  }
  return out;
}

// ── 주소·브라우저 저장소 값 → innerHTML(DOM XSS) ──
const CLIENT_SOURCE_PATHS = /^(window\.)?(location|document\.cookie|document\.referrer|document\.URL|document\.documentURI)(\.|$)/;
const STORAGE_GETTERS = /^(window\.)?(localStorage|sessionStorage)\.getItem$/;
const STRING_METHODS = new Set(["trim", "toLowerCase", "toUpperCase", "slice", "substring", "replace", "replaceAll", "split", "join", "toString", "concat", "at", "get", "getAll", "decodeURIComponent"]);
export const HTML_SAFE_FNS = new Set(["esc", "escapeHtml", "escHtml", "escape", "sanitize", "textOnly"]);

function clientTaint(ast) {
  const names = new Set();
  const isTainted = (e) => {
    if (!e) return false;
    switch (e.type) {
      case "Identifier": return names.has(e.name);
      case "MemberExpression": case "OptionalMemberExpression": {
        const p = memberPath(e);
        if (p && CLIENT_SOURCE_PATHS.test(p)) return true;
        return isTainted(e.object);
      }
      case "TemplateLiteral": return e.expressions.some(isTainted);
      case "BinaryExpression": return e.operator === "+" && (isTainted(e.left) || isTainted(e.right));
      case "ConditionalExpression": return isTainted(e.consequent) || isTainted(e.alternate);
      case "LogicalExpression": return isTainted(e.left) || isTainted(e.right);
      case "AwaitExpression": case "TSAsExpression": case "TSNonNullExpression": case "ParenthesizedExpression": return isTainted(e.argument ?? e.expression);
      case "NewExpression": return e.callee.type === "Identifier" && ["URLSearchParams", "URL"].includes(e.callee.name) && e.arguments.some(isTainted);
      case "CallExpression": case "OptionalCallExpression": {
        const c = e.callee;
        const full = c.type === "MemberExpression" || c.type === "OptionalMemberExpression" ? memberPath(c) : c.name;
        if (full && STORAGE_GETTERS.test(full)) return true;
        if (c.type === "Identifier" && ["String", "decodeURIComponent", "decodeURI", "JSON.parse"].includes(c.name)) return e.arguments.some(isTainted);
        if (full === "JSON.parse") return e.arguments.some(isTainted);
        if ((c.type === "MemberExpression" || c.type === "OptionalMemberExpression") && !c.computed && STRING_METHODS.has(c.property.name)) return isTainted(c.object);
        return false;
      }
      default: return false;
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    traverse(ast, (n) => {
      if (n.type === "VariableDeclarator" && n.init && isTainted(n.init)) traverse(n.id, (x) => { if (x.type === "Identifier") names.add(x.name); });
      if (n.type === "AssignmentExpression" && n.left.type === "Identifier" && isTainted(n.right)) names.add(n.left.name);
    });
  }
  return isTainted;
}

function htmlSafe(e) {
  if (!e) return true;
  if (isCall(e) && HTML_SAFE_FNS.has(calleeName(e))) return true;
  if (e.type === "StringLiteral" || e.type === "NumericLiteral") return true;
  return false;
}
// 넣는 값 안에서 정화 함수로 감싸지 않은 채 오염된 조각이 있는지
function taintedPiece(e, isTainted) {
  if (!e || htmlSafe(e)) return null;
  if (e.type === "TemplateLiteral") { for (const x of e.expressions) { const t = taintedPiece(x, isTainted); if (t) return t; } return null; }
  if (e.type === "BinaryExpression" && e.operator === "+") return taintedPiece(e.left, isTainted) || taintedPiece(e.right, isTainted);
  if (e.type === "ConditionalExpression") return taintedPiece(e.consequent, isTainted) || taintedPiece(e.alternate, isTainted);
  if (e.type === "LogicalExpression") return taintedPiece(e.left, isTainted) || taintedPiece(e.right, isTainted);
  // arr.map((x) => `<li>${x}</li>`).join("") — 오염된 목록을 그리는 경우
  if (isCall(e) && calleeName(e) === "join") return taintedPiece(e.callee.object, isTainted);
  if (isCall(e) && calleeName(e) === "map" && (e.callee.type === "MemberExpression") && isTainted(e.callee.object)) return e.callee.object;
  return isTainted(e) ? e : null;
}

export function domXssInCode(code, rel, lineOffset = 0) {
  const findings = [];
  let sinks = 0;
  const ast = parseCode(code, rel.replace(/\.astro$/, ".ts"));
  if (!ast) return { findings: [makeFinding({ rule: "parse/script", severity: "low", file: rel, line: lineOffset + 1, message: "화면 스크립트를 읽지 못해 검사하지 못함", anchor: String(lineOffset), fix: "문법 확인" })], sinks };
  const isTainted = clientTaint(ast);
  const check = (node, what, value) => {
    sinks += 1;
    const piece = taintedPiece(value, isTainted);
    if (!piece) return;
    findings.push(makeFinding({
      rule: "xss/dom-source", severity: "high", file: rel, line: lineOf(node) + lineOffset,
      message: `주소·브라우저 저장소에서 온 값이 ${what}로 그대로 들어감: ${nodeText(code, piece, 60)} — 링크를 보낸 사람이 이 쪽에 스크립트를 넣을 수 있음`,
      anchor: what + ":" + nodeText(code, value, 100),
      fix: "textContent로 넣거나 esc()로 감싸기",
    }));
  };
  traverse(ast, (n) => {
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && ["innerHTML", "outerHTML"].includes(n.left.property?.name)) check(n, n.left.property.name, n.right);
    if (isCall(n) && calleeName(n) === "insertAdjacentHTML") check(n, "insertAdjacentHTML", n.arguments[1]);
    if (isCall(n) && n.callee.type === "MemberExpression" && memberPath(n.callee) === "document.write") check(n, "document.write", n.arguments[0]);
    // location.href = 주소값 / a.href = 주소값 — javascript: 주소로 바뀔 수 있음
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && ["href", "src", "action"].includes(n.left.property?.name) && isTainted(n.right)) {
      findings.push(makeFinding({
        rule: "xss/dom-url", severity: "medium", file: rel, line: lineOf(n) + lineOffset,
        message: `주소에서 온 값을 ${n.left.property.name}에 넣음: ${nodeText(code, n.right, 60)} — javascript: 주소면 스크립트가 돎`,
        anchor: `${n.left.property.name}:` + nodeText(code, n.right, 100), fix: "https://·/ 로 시작하는지 확인한 뒤에만",
      }));
    }
    void isFunctionNode;
  });
  return { findings, sinks };
}

function domXssFindings(root) {
  const out = [];
  let sinks = 0;
  for (const rel of walkFiles(root, { dirs: ["src"], exts: [".astro"] })) {
    for (const s of astroScripts(readText(root, rel))) {
      const r = domXssInCode(s.text, rel, s.line);
      out.push(...r.findings);
      sinks += r.sinks;
    }
  }
  for (const rel of walkFiles(root, { dirs: ["src/lib", "public"], exts: [".js", ".mjs"] })) {
    const r = domXssInCode(readText(root, rel), rel);
    out.push(...r.findings);
    sinks += r.sinks;
  }
  return { findings: out, sinks };
}

// ── <script> 안 JSON(JSON-LD·자료 칸): 글에 </script>가 들어가면 쪽이 끊김 → .replace(/</g, "\\u003c") ──
function jsonInScriptFindings(root) {
  const out = [];
  for (const rel of walkFiles(root, { dirs: ["src"], exts: [".astro"] })) {
    const code = readText(root, rel);
    const re = /<script\b[^>]*\bset:html=\{([\s\S]*?)\}\s*\/?>/g;
    let m;
    while ((m = re.exec(code))) {
      const expr = m[1];
      if (!/JSON\.stringify/.test(expr) || /replace\(\s*\/<\/g/.test(expr)) continue;
      out.push(makeFinding({
        rule: "xss/json-in-script", severity: "low", file: rel, line: code.slice(0, m.index).split("\n").length,
        message: `<script>에 넣는 JSON에서 < 를 바꾸지 않음: ${expr.trim().slice(0, 60)} — 자료 글에 </script>가 들어가면 쪽 뒤가 스크립트로 읽힘`,
        anchor: expr.trim().slice(0, 100), fix: '다른 자료 칸처럼 .replace(/</g, "\\\\u003c")',
      }));
    }
  }
  return out;
}

// ── 자료 파일(src/data/*.json)에 비밀 키 이름 ──
function dataKeyFindings(root) {
  const out = [];
  for (const rel of walkFiles(root, { dirs: ["src/data"], exts: [".json"] })) {
    let data;
    try { data = JSON.parse(readText(root, rel)); } catch { continue; }
    const walk = (o, at) => {
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string" && v && /(rest|admin|secret|private|server).*(key|token)|password|client_?secret/i.test(k)) {
          out.push(makeFinding({
            rule: "secret/data-key", severity: "high", file: rel, message: `자료 파일에 비밀 키로 보이는 칸 ${at}${k} — 이 파일 글은 빌드된 쪽에 그대로 실림`,
            anchor: at + k, fix: "JavaScript 키(도메인 제한)만 두고 REST·Admin 키는 빼기",
          }));
        }
        walk(v, `${at}${k}.`);
      }
    };
    walk(data, "");
  }
  return out;
}

export function runRules(root) {
  const dom = domXssFindings(root);
  const findings = [
    ...dom.findings,
    ...jsonInScriptFindings(root),
    ...dataKeyFindings(root),
    ...scanSecrets(root, walkFiles(root, { dirs: ["."], ignoreDirs: ["public/img", "public/media"] }), { skip: [/^security\//, /^docs\/.*-sources\.json$/] }),
    ...checkVercelHeaders(root, { wantCsp: true, wantHsts: true }),
  ];
  const sections = [{
    title: "화면 스크립트의 innerHTML",
    lines: [`.astro 화면 스크립트·src/lib·public의 innerHTML·insertAdjacentHTML·document.write ${dom.sinks}곳을 봤다 — 주소(?e=·#…)·localStorage·sessionStorage에서 온 값이 정화 없이 들어가는 곳만 xss/dom-source로 나온다(빌드 때 자료 파일로 만든 글은 대상 아님).`],
  }];
  return { findings, sections };
}

export const LIMITS = [
  "값 추적은 스크립트 한 덩어리 안(선언·대입)까지만 — 함수에 넘겨 계산한 결과(날짜 계산 등)는 안전하다고 본다.",
  "계산기 iframe이 띄우는 바깥 사이트(홈페이지 계산기들)는 그 저장소에서 따로 본다.",
  "Vercel 프로젝트 설정·카카오 앱의 JavaScript 키 도메인 제한은 저장소 밖이라 보지 못한다.",
];

// ── 운영 사이트 확인(GET만) ──
export const SITE = "https://semusatax.vercel.app";
// 운영 확인 계획(GET만) — tax-search api/_securityProbe.js SEMUSA_PLAN(관리자 탭·밤 9시 점검)과 같게 둔다(한쪽을 고치면 같이).
export const PROBE_PLAN = {
  site: SITE, name: "semusa",
  headers: ["/", "/deadline"],
  acceptHeaders: { "csp-report-only": "CSP 보고 단계(2026-10-29 — 보고는 택스 서치 관리자 탭 ④ semusa 칸, 차단 전환은 운영자 결정 뒤)" },
  files: true, sourceMaps: true,
};

export async function runProbes() {
  return [siteProbeSection(await runSitePlan(PROBE_PLAN), { footer: [] })];
}
