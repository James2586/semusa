// 🛡 보안 점검 도구 공용 엔진(2026-10-27). tax-search·stock-valuation·semusa 세 저장소에 **같은 파일**로 둔다 —
//   고칠 땐 세 곳에 글자 그대로 복사(저장소마다 다른 규칙은 scripts/security/rules.mjs에만).
//   여기엔 파일 훑기·코드 읽기(@babel/parser)·찾은 것(finding)·기준선(security/baseline.json) 대조·보고서·
//   공용 규칙(비밀값·보안 헤더)·운영 사이트 GET 확인만 둔다. AI·바깥 업체 호출 없음(운영 확인은 GET만, 응답 본문은 저장하지 않음).
import fs from "node:fs";
import path from "node:path";
import { parse as babelParse } from "@babel/parser";

export const SEVERITY_ORDER = ["high", "medium", "low", "info"];
export const SEVERITY_LABEL = { high: "높음", medium: "중간", low: "낮음", info: "참고" };

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", ".vercel", ".astro", "coverage", "test-results", "playwright-report", "__pycache__", ".claude",
]);

// ── 파일 ──
export function walkFiles(root, { dirs = ["."], exts = null, ignoreDirs = [], ignoreFiles = [] } = {}) {
  const ignore = new Set([...DEFAULT_IGNORE_DIRS, ...ignoreDirs]);
  const out = [];
  const visit = (abs) => {
    let st;
    try { st = fs.statSync(abs); } catch { return; }
    if (st.isDirectory()) {
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (ignore.has(path.basename(abs)) || ignore.has(rel)) return;
      for (const name of fs.readdirSync(abs).sort()) visit(path.join(abs, name));
      return;
    }
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (ignoreFiles.some((p) => (p instanceof RegExp ? p.test(rel) : p === rel))) return;
    if (exts && !exts.includes(path.extname(abs))) return;
    out.push(rel);
  };
  for (const d of dirs) visit(path.join(root, d));
  return [...new Set(out)];
}

export function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// ── 코드 읽기 ──
const parseCache = new Map();
export function parseCode(code, rel) {
  const key = rel + "\u0000" + code.length;
  if (parseCache.has(key)) return parseCache.get(key);
  const ts = /\.(ts|tsx|astro)$/.test(rel);
  let ast = null;
  try {
    ast = babelParse(code, {
      sourceType: "unambiguous",
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      plugins: ["jsx", ...(ts ? ["typescript"] : []), "importAttributes", "topLevelAwait"],
    });
  } catch {
    ast = null;
  }
  parseCache.set(key, ast);
  return ast;
}

// 반복(스택)으로 훑는다 — 1MB 넘는 파일의 긴 문자열 이어 붙이기에서 재귀가 넘치지 않게.
export function traverse(root, enter) {
  const stack = [[root, null]];
  while (stack.length) {
    const [node, parent] = stack.pop();
    if (!node || typeof node.type !== "string") continue;
    if (enter(node, parent) === false) continue;
    const keys = Object.keys(node);
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments" || k === "innerComments" || k === "extra") continue;
      const v = node[k];
      if (Array.isArray(v)) {
        for (let j = v.length - 1; j >= 0; j--) if (v[j] && typeof v[j].type === "string") stack.push([v[j], node]);
      } else if (v && typeof v.type === "string") {
        stack.push([v, node]);
      }
    }
  }
}

export function isFunctionNode(n) {
  return !!n && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression" || n.type === "ObjectMethod" || n.type === "ClassMethod");
}

// 부르는 함수 이름(그냥 이름이면 그 이름, a.b()면 b).
export function calleeName(call) {
  const c = call?.callee;
  if (!c) return null;
  if (c.type === "Identifier") return c.name;
  if ((c.type === "MemberExpression" || c.type === "OptionalMemberExpression") && !c.computed && c.property?.type === "Identifier") return c.property.name;
  return null;
}
export function isCall(n) {
  return n && (n.type === "CallExpression" || n.type === "OptionalCallExpression");
}

// a?.b.c → "a.b.c"(계산식 칸·호출이 섞이면 null)
export function memberPath(n) {
  const parts = [];
  let cur = n;
  while (cur) {
    if (cur.type === "Identifier") { parts.unshift(cur.name); return parts.join("."); }
    if (cur.type === "ThisExpression") { parts.unshift("this"); return parts.join("."); }
    if ((cur.type === "MemberExpression" || cur.type === "OptionalMemberExpression")) {
      if (cur.computed) {
        if (cur.property.type === "StringLiteral") parts.unshift(cur.property.value);
        else return null;
      } else parts.unshift(cur.property.name);
      cur = cur.object;
      continue;
    }
    return null;
  }
  return null;
}

// 이름 있는 함수: 선언·const f = () => …·export 모두(같은 이름이 여럿이면 처음 것).
export function collectFunctions(ast) {
  const map = new Map();
  if (!ast) return map;
  const add = (name, fn) => { if (name && fn && !map.has(name)) map.set(name, fn); };
  for (const st of ast.program.body) {
    const decl = st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration" ? st.declaration : st;
    if (!decl) continue;
    if (decl.type === "FunctionDeclaration") add(decl.id?.name, decl);
    if (decl.type === "VariableDeclaration") {
      for (const d of decl.declarations) {
        if (d.id?.type === "Identifier" && isFunctionNode(d.init)) add(d.id.name, d.init);
      }
    }
  }
  return map;
}

// import { a as b } from "./x.js" → b → { source, imported: "a" }
export function collectImports(ast) {
  const map = new Map();
  if (!ast) return map;
  for (const st of ast.program.body) {
    if (st.type !== "ImportDeclaration") continue;
    for (const s of st.specifiers) {
      if (s.type === "ImportSpecifier") map.set(s.local.name, { source: st.source.value, imported: s.imported.name ?? s.imported.value });
      else if (s.type === "ImportDefaultSpecifier") map.set(s.local.name, { source: st.source.value, imported: "default" });
    }
  }
  return map;
}

export function lineOf(node) {
  return node?.loc?.start?.line ?? 0;
}

export function nodeText(code, node, max = 160) {
  if (!node || node.start == null) return "";
  return code.slice(node.start, node.end).replace(/\s+/g, " ").trim().slice(0, max);
}

// ── 찾은 것 ──
// key는 줄 번호를 넣지 않는다(위아래에 줄이 늘어도 기준선이 그대로 맞게) — 규칙 + 파일 + 기준 글자(anchor).
export function makeFinding({ rule, severity, file, line = 0, message, anchor, fix = "" }) {
  if (!SEVERITY_ORDER.includes(severity)) throw new Error(`모르는 위험도: ${severity}`);
  const a = String(anchor ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  return { rule, severity, file, line, message, fix, key: `${rule}|${file}|${a}` };
}

// 같은 key가 여럿이면 #2·#3을 붙인다(파일 안 순서 기준).
export function finalizeFindings(list) {
  const sorted = [...list].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  const seen = new Map();
  for (const f of sorted) {
    const n = (seen.get(f.key) || 0) + 1;
    seen.set(f.key, n);
    if (n > 1) f.key = `${f.key}#${n}`;
  }
  return sorted;
}

// ── 기준선 ──
// security/baseline.json: { entries: [{ key, status: "open"|"accepted", reason, since }] }
//   open = 알고 있지만 아직 고치지 않음(보고서에 계속 보임), accepted = 검토해 괜찮다고 정함(이유 필수).
//   기준선에 없는 새 항목, 그리고 이제 나오지 않는 기준선 항목(고쳤으면 지울 것)은 시험을 실패시킨다.
export function loadBaseline(file) {
  if (!fs.existsSync(file)) return { entries: [] };
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const entries = Array.isArray(data.entries) ? data.entries : [];
  for (const e of entries) {
    if (!e.key || !["open", "accepted"].includes(e.status)) throw new Error(`기준선 항목 형식이 틀림: ${JSON.stringify(e)}`);
    if (e.status === "accepted" && !String(e.reason || "").trim()) throw new Error(`accepted 항목엔 이유(reason)가 필요함: ${e.key}`);
  }
  return { ...data, entries };
}

export function compareBaseline(findings, baseline) {
  const byKey = new Map(baseline.entries.map((e) => [e.key, e]));
  const fresh = [];
  const known = [];
  for (const f of findings) {
    const e = byKey.get(f.key);
    if (e) known.push({ ...f, baseline: e });
    else fresh.push(f);
  }
  const found = new Set(findings.map((f) => f.key));
  const stale = baseline.entries.filter((e) => !found.has(e.key));
  return { fresh, known, stale };
}

// 관리자 화면·서버 점검이 읽는 요약(security/scan.json) — 줄 번호·생성 시각 밖의 값은 코드가 그대로면 같다(시험이 대조).
//   응답 본문·비밀 값은 없다(scanSecrets 메시지는 이미 가린 값).
export function scanSnapshot(scan, extra = {}) {
  const status = new Map(scan.comparison.known.map((f) => [f.key, f.baseline]));
  const items = scan.findings.map((f) => {
    const b = status.get(f.key);
    const noLine = (t) => String(t || "").replace(/(\.(?:[cm]?jsx?|astro|json)):\d+/g, "$1"); // 다른 파일을 고칠 때마다 줄 번호로 바뀌지 않게
    return { key: f.key, rule: f.rule, severity: f.severity, file: f.file, message: noLine(f.message), fix: noLine(f.fix), status: b ? b.status : "new", reason: b?.reason || "" };
  });
  const count = (fn) => items.filter(fn).length;
  return {
    about: "npm run security:scan이 만든 코드 검사 요약 — 손으로 고치지 말 것",
    counts: {
      total: items.length, open: count((i) => i.status === "open"), accepted: count((i) => i.status === "accepted"), fresh: count((i) => i.status === "new"), stale: scan.comparison.stale.length,
      bySeverity: Object.fromEntries(SEVERITY_ORDER.map((s) => [s, count((i) => i.severity === s && i.status !== "accepted")])),
    },
    items,
    stale: scan.comparison.stale.map((e) => e.key),
    routes: (scan.routes || []).length,
    ...extra,
  };
}

export function baselineWithNew(baseline, fresh, since) {
  const entries = [...baseline.entries];
  for (const f of fresh) entries.push({ key: f.key, status: "open", reason: "", since, severity: f.severity });
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return { ...baseline, entries };
}

// ── 보고서(마크다운) ──
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderReport({ title, generatedAt, findings, comparison, sections = [], notes = [] }) {
  const lines = [`# ${title}`, "", `만든 때: ${generatedAt}`, ""];
  const count = (sev, list) => list.filter((f) => f.severity === sev).length;
  const open = comparison.known.filter((f) => f.baseline.status === "open");
  const accepted = comparison.known.filter((f) => f.baseline.status === "accepted");
  lines.push("## 요약", "");
  lines.push("| 구분 | 높음 | 중간 | 낮음 | 참고 |", "|---|---|---|---|---|");
  for (const [label, list] of [["새로 찾음(기준선에 없음)", comparison.fresh], ["확인 필요(open)", open], ["검토 끝(accepted)", accepted]]) {
    lines.push(`| ${label} | ${SEVERITY_ORDER.map((s) => count(s, list)).join(" | ")} |`);
  }
  lines.push("");
  if (comparison.stale.length) lines.push(`⚠ 기준선에는 있는데 이제 나오지 않는 항목 ${comparison.stale.length}건 — 고쳤다면 security/baseline.json에서 지운다.`, "");
  for (const n of notes) lines.push(`- ${n}`);
  if (notes.length) lines.push("");

  const table = (list, withReason) => {
    if (!list.length) return ["(없음)", ""];
    const out = [withReason ? "| 위험도 | 규칙 | 위치 | 내용 | 검토 메모 |" : "| 위험도 | 규칙 | 위치 | 내용 | 고치는 방향 |", "|---|---|---|---|---|"];
    const sorted = [...list].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);
    for (const f of sorted) {
      const where = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
      out.push(`| ${SEVERITY_LABEL[f.severity]} | ${f.rule} | ${where} | ${esc(f.message)} | ${esc(withReason ? f.baseline?.reason || "" : f.fix)} |`);
    }
    out.push("");
    return out;
  };
  lines.push("## 새로 찾음", "", ...table(comparison.fresh, false));
  lines.push("## 확인 필요(open)", "", ...table(open, false));
  lines.push("## 검토 끝(accepted)", "", ...table(accepted, true));
  if (comparison.stale.length) {
    lines.push("## 이제 나오지 않는 기준선 항목", "");
    for (const e of comparison.stale) lines.push(`- \`${esc(e.key)}\``);
    lines.push("");
  }
  for (const s of sections) lines.push(`## ${s.title}`, "", ...s.lines, "");
  void findings;
  return lines.join("\n");
}

// ── 공용 규칙: 비밀값 ──
// 저장소에 들어간 진짜 비밀값 모양. 파이어베이스 웹 설정 apiKey(AIza…)는 공개돼도 되는 값이라 "확인 필요"로만 둔다.
const SECRET_PATTERNS = [
  { id: "anthropic-key", re: /sk-ant-[A-Za-z0-9_-]{20,}/g, severity: "high", label: "Anthropic API 키" },
  { id: "openai-key", re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g, severity: "high", label: "OpenAI API 키" },
  { id: "github-token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{40,}/g, severity: "high", label: "GitHub 토큰" },
  { id: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, severity: "high", label: "Slack 토큰" },
  { id: "aws-key", re: /\bAKIA[0-9A-Z]{16}\b/g, severity: "high", label: "AWS 접근 키" },
  { id: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g, severity: "high", label: "개인 키(PEM)" },
  { id: "toss-secret", re: /\b(?:live|test)_(?:sk|gsk)_[A-Za-z0-9]{16,}/g, severity: "high", label: "토스페이먼츠 비밀 키" },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, severity: "medium", label: "Google API 키(AIza…) — 파이어베이스 웹 설정이면 공개돼도 됨, 제미나이·지도 서버 키면 비밀" },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: "medium", label: "JWT 토큰" },
];

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return payload.role || null;
  } catch {
    return null;
  }
}

const TEXT_EXTS = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json", ".md", ".html", ".astro", ".css", ".yml", ".yaml", ".py", ".sh", ".sql", ".txt", ".env", ".toml", ".xml", ".svg", ".rules", ""]);

export function scanSecrets(root, files, { skip = [] } = {}) {
  const out = [];
  for (const rel of files) {
    if (!TEXT_EXTS.has(path.extname(rel))) continue;
    if (/package-lock\.json$|\.lock$/.test(rel)) continue;
    if (skip.some((p) => (p instanceof RegExp ? p.test(rel) : p === rel))) continue;
    let text;
    try { text = readText(root, rel); } catch { continue; }
    if (text.length > 6_000_000) continue;
    for (const p of SECRET_PATTERNS) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(text))) {
        let severity = p.severity;
        let label = p.label;
        if (p.id === "jwt") {
          const role = jwtRole(m[0]);
          if (role === "service_role") { severity = "high"; label = "Supabase service_role 키(JWT) — DB 전체 권한"; }
          else if (role === "anon") { severity = "low"; label = "Supabase anon 키(JWT) — 공개 키지만 RLS가 막는지 확인"; }
        }
        const line = text.slice(0, m.index).split("\n").length;
        // 값 자체는 보고서·key에 싣지 않는다(앞 6글자 + 길이만)
        const masked = `${m[0].slice(0, 6)}…(${m[0].length}자)`;
        out.push(makeFinding({
          rule: `secret/${p.id}`, severity, file: rel, line,
          message: `${label}로 보이는 글자: ${masked}`,
          anchor: masked + "@" + crypto8(m[0]),
          fix: "값을 환경변수로 옮기고, 이미 올라간 키는 업체 화면에서 새로 발급(폐기)",
        }));
      }
    }
  }
  return out;
}

// 값이 같은지만 가려 쓰는 짧은 지문(값은 남기지 않음)
function crypto8(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ── 공용 규칙: vercel.json 보안 헤더 ──
// 모든 쪽("/(.*)" 같은 넓은 source)에 걸린 헤더만 센다.
export function checkVercelHeaders(root, { file = "vercel.json", wantCsp = true, wantHsts = true } = {}) {
  const out = [];
  if (!fs.existsSync(path.join(root, file))) return out;
  const cfg = JSON.parse(readText(root, file));
  const broad = (cfg.headers || []).filter((h) => /^\/\(\.\*\)$|^\/:path\*$|^\/\(\(\?!/.test(h.source || ""));
  const names = new Map();
  for (const h of broad) for (const kv of h.headers || []) names.set(String(kv.key).toLowerCase(), String(kv.value));
  const need = [
    ["x-content-type-options", "medium", "파일 형식 추측 막기(nosniff)"],
    ["referrer-policy", "low", "다른 사이트로 넘어갈 때 주소 전체를 보내지 않기"],
  ];
  if (wantHsts) need.push(["strict-transport-security", "low", "늘 https로만(HSTS) — vercel.app 주소는 Vercel이 붙여 주지만 직접 도메인을 쓰면 필요"]);
  for (const [name, severity, why] of need) {
    if (!names.has(name)) out.push(makeFinding({ rule: "headers/missing", severity, file, message: `보안 헤더 ${name} 없음 — ${why}`, anchor: name, fix: `vercel.json headers의 "/(.*)"에 ${name} 추가` }));
  }
  const csp = names.get("content-security-policy");
  const cspRo = names.get("content-security-policy-report-only");
  if (!names.has("x-frame-options") && !/frame-ancestors/.test(csp || "")) {
    out.push(makeFinding({ rule: "headers/missing", severity: "medium", file, message: "다른 사이트가 이 쪽을 틀(iframe)에 넣어 속이는 것 막기(X-Frame-Options 또는 CSP frame-ancestors) 없음", anchor: "x-frame-options", fix: "X-Frame-Options: SAMEORIGIN" }));
  }
  if (wantCsp && !csp) {
    out.push(makeFinding({
      rule: "headers/csp", severity: cspRo ? "low" : "medium", file,
      message: cspRo ? "CSP가 아직 보고 전용(Report-Only) — 막지는 않음" : "CSP(화면에서 실행할 수 있는 스크립트 출처 제한) 없음",
      anchor: cspRo ? "report-only" : "missing",
      fix: cspRo ? "위반 보고를 본 뒤 헤더 이름을 Content-Security-Policy로 바꿔 차단" : "허용 출처 목록으로 CSP를 먼저 Report-Only로 걸고 위반 보고를 본 뒤 차단",
    }));
  }
  if (csp && /'unsafe-inline'[^;]*/.test(csp.match(/script-src[^;]*/)?.[0] || "")) {
    out.push(makeFinding({ rule: "headers/csp", severity: "low", file, message: "CSP script-src에 'unsafe-inline' — 인라인 스크립트 주입을 막지 못함", anchor: "unsafe-inline", fix: "인라인 스크립트를 파일로 옮기거나 해시·nonce" }));
  }
  return out;
}

// ── 의존성 취약점(npm audit — 보고서 전용, 시험엔 넣지 않음: 새 취약점 공개만으로 코드 변경 없이 실패하므로) ──
export async function npmAudit(root) {
  const { execFileSync } = await import("node:child_process");
  let raw;
  try {
    raw = execFileSync("npm", ["audit", "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
  } catch (e) {
    raw = e.stdout || "";
  }
  try {
    const data = JSON.parse(raw);
    const vulns = Object.values(data.vulnerabilities || {}).map((v) => ({
      name: v.name, severity: v.severity, direct: !!v.isDirect, range: v.range,
      fix: v.fixAvailable === true ? "npm audit fix" : v.fixAvailable ? `${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? "(메이저)" : ""}` : "수정판 없음",
      via: (v.via || []).map((x) => (typeof x === "string" ? x : x.title)).filter(Boolean).slice(0, 3),
    }));
    return { ok: true, vulns };
  } catch {
    return { ok: false, vulns: [], error: "npm audit 결과를 읽지 못함(인터넷 연결·레지스트리 확인)" };
  }
}

export function auditSection(audit, accepted = {}) {
  if (!audit.ok) return { title: "의존성 취약점(npm audit)", lines: [`- ${audit.error}`] };
  const order = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
  const list = [...audit.vulns].sort((a, b) => order[a.severity] - order[b.severity] || a.name.localeCompare(b.name));
  if (!list.length) return { title: "의존성 취약점(npm audit)", lines: ["- 알려진 취약점 없음"] };
  const lines = ["| 위험도 | 패키지 | 직접 의존 | 내용 | 고칠 판 | 메모 |", "|---|---|---|---|---|---|"];
  for (const v of list) lines.push(`| ${v.severity} | ${v.name} | ${v.direct ? "예" : "아니오"} | ${esc(v.via.join(" / "))} | ${esc(v.fix)} | ${esc(accepted[v.name] || "")} |`);
  return { title: "의존성 취약점(npm audit)", lines };
}

// ── 운영 사이트 확인(GET만) — ./probe.mjs(코드 읽기 없이 서버 함수도 쓰는 가벼운 파일)로 옮김 ──
export { probeGet, judgeLiveHeaders, EXPOSED_FILE_CHECKS } from "./probe.mjs";

export function nowKstText() {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().replace("T", " ").slice(0, 16) + " (한국 시각)";
}

// ════════════════════════════════════════════════════════════════════════════
// 서버 요청 분기 권한 지도(저장소마다 spec으로 문지기·위험한 일을 정함)
//   spec = {
//     entryFiles: ["api/x.js", …],          진입 파일(default export handler)
//     resolvePrefixes: ["api/"],             import를 따라갈 폴더(순수 로직 폴더는 빼서 빠르게)
//     guardCall(name, call) → 이름표|null    이름으로 부르는 함수 중 문지기(checkAuth 등)
//     guardIf(ifNode, code) → [이름표]       "아니면 돌려보냄" if(if (!req.isAdmin) return 403 등)
//     sinkCall(call, mod) → { kind, what }|null   위험한 일(AI·메시지·쓰기…) — 이름 호출·메서드 호출 모두 여기로
//     isSinkName(name) → bool                이 이름은 따라 들어가지 않음(위험한 일 자체)
//   }
// ════════════════════════════════════════════════════════════════════════════
export function stmtsOf(n) {
  return n.type === "BlockStatement" ? n.body : [n];
}
function hasReturn(stmts) {
  let found = false;
  for (const s of stmts) traverse(s, (n) => { if (isFunctionNode(n)) return false; if (n.type === "ReturnStatement") found = true; });
  return found;
}
// 블록 안 return이 모두 "그냥 돌아감"(return; / return res.status(…)…)이면 문지기 블록
export function onlyRejectReturns(stmts) {
  let ok = true;
  for (const s of stmts) traverse(s, (n) => {
    if (isFunctionNode(n)) return false;
    if (n.type !== "ReturnStatement" || !n.argument) return;
    let root = n.argument;
    while (isCall(root) && (root.callee.type === "MemberExpression" || root.callee.type === "OptionalMemberExpression")) root = root.callee.object;
    if (!(root.type === "Identifier" && root.name === "res")) ok = false;
  });
  return ok;
}
// if (조건) return …; 꼴(else 없음, 끝이 return·throw)
export function isEarlyReturnIf(ifNode) {
  if (ifNode.alternate) return false;
  const c = ifNode.consequent;
  return c.type === "ReturnStatement" || c.type === "ThrowStatement" ||
    (c.type === "BlockStatement" && c.body.length > 0 && ["ReturnStatement", "ThrowStatement"].includes(c.body[c.body.length - 1].type));
}
// 같은 모듈 안에서 이름 → 가장 가까운 앞 선언의 초기값(글자 주소 풀기용)
function declInitBefore(mod, name, pos) {
  let best = null;
  for (const d of mod.decls.get(name) || []) if (d.start < pos && (!best || d.start > best.start)) best = d;
  return best?.init || null;
}
// 주소 글자 풀기: 템플릿·+ 이어 붙이기·같은 모듈 상수까지(모르는 칸은 ${…})
export function stringText(expr, mod, depth = 0) {
  if (!expr || depth > 4) return "${…}";
  if (expr.type === "StringLiteral") return expr.value;
  if (expr.type === "TemplateLiteral") return expr.quasis.map((q, i) => (q.value.cooked ?? q.value.raw) + (expr.expressions[i] ? stringText(expr.expressions[i], mod, depth + 1) : "")).join("");
  if (expr.type === "BinaryExpression" && expr.operator === "+") return stringText(expr.left, mod, depth + 1) + stringText(expr.right, mod, depth + 1);
  if (expr.type === "Identifier" && mod) {
    const init = declInitBefore(mod, expr.name, expr.start);
    if (init) return stringText(init, mod, depth + 1);
  }
  return "${…}";
}

export class ModuleIndex {
  constructor(root, spec) {
    this.root = root;
    this.spec = spec;
    this.mods = new Map();
    this.memo = new Map();
  }
  mod(rel) {
    if (this.mods.has(rel)) return this.mods.get(rel);
    let m = null;
    try {
      const code = readText(this.root, rel);
      const ast = parseCode(code, rel);
      if (ast) {
        const fns = collectFunctions(ast);
        // export default withX(handler) 모양 — default는 handler로
        for (const st of ast.program.body) {
          if (st.type === "ExportDefaultDeclaration") {
            if (isFunctionNode(st.declaration)) fns.set("default", st.declaration);
            else if (fns.has("handler")) fns.set("default", fns.get("handler"));
          }
        }
        const decls = new Map();
        traverse(ast, (n) => {
          if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init) {
            if (!decls.has(n.id.name)) decls.set(n.id.name, []);
            decls.get(n.id.name).push({ init: n.init, start: n.start });
          }
        });
        m = { rel, code, ast, fns, decls, imports: collectImports(ast) };
      }
    } catch { m = null; }
    this.mods.set(rel, m);
    return m;
  }
  resolve(rel, name) {
    const m = this.mod(rel);
    if (!m) return null;
    if (m.fns.has(name)) return { rel, name };
    const imp = m.imports.get(name);
    if (!imp || !imp.source.startsWith(".")) return null;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), imp.source));
    if (!(this.spec.resolvePrefixes || []).some((p) => target.startsWith(p))) return null;
    const tm = this.mod(target);
    if (!tm || !tm.fns.has(imp.imported)) return null;
    return { rel: target, name: imp.imported };
  }
  guardsIn(node) {
    const out = new Set();
    traverse(node, (n) => {
      if (n.type === "IfStatement") for (const g of this.spec.guardIf?.(n) || []) out.add(g);
      // 이름 호출(checkAuth(…))과 메서드 호출(getAuth().verifyIdToken(…)) 모두
      if (isCall(n) && calleeName(n)) {
        const g = this.spec.guardCall?.(calleeName(n), n);
        if (g) out.add(g);
      }
    });
    return out;
  }
  // 노드(함수 몸통이나 문장들) 하나의 직접 요약
  direct(rel, nodes) {
    const guards = new Set();
    const sinks = new Map(); // 종류 → 첫 위치 설명
    const calls = [];
    const m = this.mod(rel);
    for (const node of nodes) {
      for (const g of this.guardsIn(node)) guards.add(g);
      traverse(node, (n) => {
        if (!isCall(n)) return;
        const s = this.spec.sinkCall?.(n, m);
        if (s && !sinks.has(s.kind)) sinks.set(s.kind, `${s.what} ${rel}:${lineOf(n)}`);
        if (n.callee.type === "Identifier" && n.callee.name !== "fetch") calls.push(n.callee.name);
      });
    }
    return { guards, sinks, calls };
  }
  skipName(name) {
    return !!(this.spec.guardCall?.(name, null) || this.spec.isSinkName?.(name));
  }
  // 함수 하나를 따라간 요약(부르는 함수까지, 다른 파일 포함)
  summary(rel, name, depth = 0, stack = new Set()) {
    const id = `${rel}#${name}`;
    if (this.memo.has(id)) return this.memo.get(id);
    if (stack.has(id) || depth > 12) return { guards: new Set(), sinks: new Map() };
    stack.add(id);
    const fn = this.mod(rel).fns.get(name);
    const d = this.direct(rel, [fn.body]);
    const out = { guards: new Set(d.guards), sinks: new Map(d.sinks) };
    for (const c of new Set(d.calls)) {
      if (this.skipName(c)) continue;
      const r = this.resolve(rel, c);
      if (!r) continue;
      const s = this.summary(r.rel, r.name, depth + 1, stack);
      for (const g of s.guards) out.guards.add(g);
      for (const [k, v] of s.sinks) if (!out.sinks.has(k)) out.sinks.set(k, v);
    }
    stack.delete(id);
    this.memo.set(id, out);
    return out;
  }
  // 문장 묶음 요약(분기 몸통)
  summarizeNodes(rel, nodes) {
    const d = this.direct(rel, nodes);
    const out = { guards: new Set(d.guards), sinks: new Map(d.sinks), targets: [] };
    for (const c of new Set(d.calls)) {
      if (this.skipName(c)) continue;
      const r = this.resolve(rel, c);
      if (!r) continue;
      out.targets.push(r);
      const s = this.summary(r.rel, r.name);
      for (const g of s.guards) out.guards.add(g);
      for (const [k, v] of s.sinks) if (!out.sinks.has(k)) out.sinks.set(k, v);
    }
    return out;
  }
  // 문장 하나가 문지기인지(if (!(await checkAuth(req, res))) return; / const ok = await checkAuth(…) / if (!req.isAdmin) return 403)
  guardOfStatement(st) {
    if (st.type === "IfStatement") {
      const g = new Set(this.spec.guardIf?.(st) || []);
      if (isEarlyReturnIf(st) && onlyRejectReturns(stmtsOf(st.consequent))) {
        traverse(st.test, (n) => { if (isCall(n) && calleeName(n)) { const x = this.spec.guardCall?.(calleeName(n), n); if (x) g.add(x); } });
      }
      return g;
    }
    const g = new Set();
    if (st.type === "ExpressionStatement" || st.type === "VariableDeclaration") {
      traverse(st, (n) => { if (isFunctionNode(n)) return false; if (isCall(n) && calleeName(n)) { const x = this.spec.guardCall?.(calleeName(n), n); if (x) g.add(x); } });
    }
    return g;
  }
  // 분기 함수의 맨 앞 문장들 안에 문지기가 있는지 — 운영 GET 확인은 이런 분기만 부른다(일하기 전에 막히는 게 코드로 보이는 곳)
  guardFirstIn(target) {
    if (!target) return false;
    const fn = this.mod(target.rel)?.fns.get(target.name);
    for (const st of fn?.body?.body || []) {
      if (this.guardOfStatement(st).size) return true;
      if (st.type === "IfStatement" && isEarlyReturnIf(st) && onlyRejectReturns(stmtsOf(st.consequent))) continue; // if (method !== "GET") return 405
      if (st.type === "ExpressionStatement" && isCall(st.expression) && /^(setHeader|header)$/.test(calleeName(st.expression) || "")) continue; // res.setHeader(…)
      return false;
    }
    return false;
  }
}

// handler 안의 분기를 위에서 아래로 읽는다 — 앞에서 지난 문지기(guardsSoFar)는 뒤 분기에 모두 걸린다.
function readRoutes(idx, rel, stmts, guardsSoFar, prefix, routes, leftovers) {
  const guards = new Set(guardsSoFar);
  const containsRouteIf = (list) => list.some((s) => s.type === "IfStatement" && hasReturn(stmtsOf(s.consequent)) && !idx.guardOfStatement(s).size);
  for (const st of stmts) {
    const stGuards = idx.guardOfStatement(st);
    if (stGuards.size) { for (const g of stGuards) guards.add(g); continue; }
    if (st.type !== "IfStatement") { leftovers.push({ nodes: [st], guards: new Set(guards), line: lineOf(st) }); continue; }
    const cons = stmtsOf(st.consequent);
    const label = (prefix ? prefix + " → " : "") + nodeText(idx.mod(rel).code, st.test, 90);
    if (st.alternate) {
      // if (체험) { checkTrial } else { checkAuth } — 양쪽이 모두 문지기(돌려보내기만 하는 return)면 "둘 중 하나"
      const a = idx.summarizeNodes(rel, cons);
      const b = idx.summarizeNodes(rel, stmtsOf(st.alternate));
      if (onlyRejectReturns(cons) && onlyRejectReturns(stmtsOf(st.alternate)) && a.guards.size && b.guards.size) {
        guards.add([...a.guards].join("·") + " 또는 " + [...b.guards].join("·"));
        continue;
      }
      leftovers.push({ nodes: [st], guards: new Set(guards), line: lineOf(st) });
      continue;
    }
    if (containsRouteIf(cons)) { readRoutes(idx, rel, cons, guards, label, routes, leftovers); continue; }
    if (!hasReturn(cons)) { leftovers.push({ nodes: [st], guards: new Set(guards), line: lineOf(st) }); continue; }
    const s = idx.summarizeNodes(rel, cons);
    if (!s.targets.length && !s.sinks.size && !s.guards.size) continue; // return res.status(405) 같은 거절
    routes.push({ file: rel, label, line: lineOf(st), guards: new Set([...guards, ...s.guards]), before: new Set(guards), sinks: s.sinks, targets: s.targets.map((t) => t.name), guardFirst: idx.guardFirstIn(s.targets[0]) });
  }
}

export function buildRouteMap(root, spec) {
  const idx = new ModuleIndex(root, spec);
  const routes = [];
  for (const rel of spec.entryFiles) {
    const m = idx.mod(rel);
    if (!m) { routes.push({ file: rel, label: "(코드를 읽지 못함)", line: 0, guards: new Set(), before: new Set(), sinks: new Map(), targets: [], unreadable: true }); continue; }
    const handler = m.fns.get("default") || m.fns.get("handler");
    if (!handler || handler.body?.type !== "BlockStatement") continue;
    const leftovers = [];
    readRoutes(idx, rel, handler.body.body, new Set(), "", routes, leftovers);
    // 분기 밖 기본 흐름(handler 끝에서 바로 처리) — 문지기 묶음마다 하나
    const byGuard = new Map();
    for (const lo of leftovers) {
      const k = [...lo.guards].sort().join("+");
      if (!byGuard.has(k)) byGuard.set(k, { guards: lo.guards, nodes: [], line: lo.line });
      byGuard.get(k).nodes.push(...lo.nodes);
    }
    for (const g of byGuard.values()) {
      const s = idx.summarizeNodes(rel, g.nodes);
      if (!s.sinks.size && !s.targets.length) continue;
      routes.push({ file: rel, label: "(분기 밖 기본 흐름)", line: g.line, guards: new Set([...g.guards, ...s.guards]), before: new Set(g.guards), sinks: s.sinks, targets: s.targets.map((t) => t.name), guardFirst: idx.guardFirstIn(s.targets[0]) });
    }
  }
  return routes;
}

// 검사 없이 위험한 일에 닿는 분기 → 찾은 것. sinkInfo = { 종류: { label, severity } }
export function routeFindings(routes, sinkInfo, { fix = "의도한 공개 경로면 기준선에 이유를 적고, 아니면 로그인·관리자 검사를 앞에" } = {}) {
  const out = [];
  for (const r of routes) {
    if (r.unreadable) {
      out.push(makeFinding({ rule: "auth/unreadable", severity: "medium", file: r.file, message: "서버 파일을 읽지 못해 권한 검사를 못 함", anchor: "parse", fix: "문법 오류 확인" }));
      continue;
    }
    if (r.guards.size || !r.sinks.size) continue;
    const kinds = [...r.sinks.keys()];
    const severity = SEVERITY_ORDER.find((s) => kinds.some((k) => (sinkInfo[k]?.severity || "medium") === s));
    const what = kinds.map((k) => `${sinkInfo[k]?.label || k}(${r.sinks.get(k)})`).join(", ");
    out.push(makeFinding({
      rule: "auth/unguarded-route", severity, file: r.file, line: r.line,
      message: `로그인·관리자 검사 없이 닿는 분기 [${r.label}] → ${what}`,
      anchor: r.label, fix,
    }));
  }
  return out;
}

export function routeMapSection(routes, sinkInfo, intro) {
  const lines = [
    intro,
    "\"검사 없음\" + 하는 일이 있으면 auth/unguarded-route로 나온다. 검사가 분기 함수 **안**에만 있으면(앞에서 지난 것 없음) 하는 일보다 뒤에 있는지는 이 표가 가리지 못한다.",
    "",
    "| 파일 | 분기 | 앞에서 지난 검사 | 전체 검사 | 하는 일 |",
    "|---|---|---|---|---|",
  ];
  for (const r of routes) {
    const g = [...r.guards].join(", ") || "**검사 없음**";
    const b = [...r.before].join(", ") || "—";
    const s = [...r.sinks.keys()].map((k) => sinkInfo[k]?.label || k).join(", ") || "—";
    lines.push(`| ${r.file}:${r.line} | \`${String(r.label).replace(/\|/g, "\\|").replace(/`/g, "'")}\` | ${b} | ${g} | ${s} |`);
  }
  return { title: "서버 요청 분기 권한 지도", lines };
}

// ════════════════════════════════════════════════════════════════════════════
// 함수 안 요청 값 추적(가벼운 것)
//   req.query/req.body/req.headers/req.cookies에서 나온 이름(같은 함수 안 선언·구조 분해만). 다른 함수로 넘긴 값은 따라가지 않는다.
//   값은 글자 다루기(trim·slice·String…)로만 이어진다고 본다 — 그 밖의 함수 호출(sanitize…·Number…)을 거치면 검사했다고 보고 끊는다
//   (거짓 경보를 줄이는 쪽 — 검사 함수가 실제로 거르는지는 보지 않는다).
// ════════════════════════════════════════════════════════════════════════════
const TAINT_ROOTS = /^req\.(query|body|headers|cookies)(\.|$)/;
const STRING_METHODS = new Set(["trim", "trimStart", "trimEnd", "toLowerCase", "toUpperCase", "slice", "substring", "substr", "replace", "replaceAll", "split", "join", "toString", "concat", "padStart", "padEnd", "at", "normalize"]);
export function taintedNames(fn) {
  const names = new Set();
  const isTainted = (expr) => {
    if (!expr) return false;
    switch (expr.type) {
      case "Identifier": return names.has(expr.name);
      case "MemberExpression": case "OptionalMemberExpression": {
        const p = memberPath(expr);
        if (p && TAINT_ROOTS.test(p)) return true;
        if (p === "req.query" || p === "req.body") return true;
        return isTainted(expr.object);
      }
      case "TemplateLiteral": return expr.expressions.some(isTainted);
      case "BinaryExpression": return expr.operator === "+" && (isTainted(expr.left) || isTainted(expr.right));
      case "ConditionalExpression": return isTainted(expr.consequent) || isTainted(expr.alternate);
      case "LogicalExpression": return isTainted(expr.left) || isTainted(expr.right);
      case "AwaitExpression": case "TSAsExpression": case "TSNonNullExpression": case "ParenthesizedExpression": return isTainted(expr.argument ?? expr.expression);
      case "ArrayExpression": return expr.elements.some((e) => e && isTainted(e.type === "SpreadElement" ? e.argument : e));
      case "CallExpression": case "OptionalCallExpression": {
        const c = expr.callee;
        if (c.type === "Identifier" && ["String", "decodeURIComponent", "decodeURI"].includes(c.name)) return isTainted(expr.arguments[0]);
        if ((c.type === "MemberExpression" || c.type === "OptionalMemberExpression") && !c.computed && STRING_METHODS.has(c.property.name)) return isTainted(c.object);
        return false;
      }
      default: return false;
    }
  };
  // 두 번 돌아 순서 상관없이 이어 받기(const a = req.body.x; const b = a.trim()) — 안쪽 함수의 선언은 그 함수에서 따로 본다
  for (let pass = 0; pass < 2; pass++) {
    traverse(fn.body, (n) => {
      if (isFunctionNode(n) && n !== fn) return false;
      if (n.type !== "VariableDeclarator" || !n.init) return;
      if (!isTainted(n.init)) return;
      traverse(n.id, (x) => { if (x.type === "Identifier") names.add(x.name); });
    });
  }
  return { names, isTainted };
}

// 이 감싸개를 거친 값은 안전하다고 본다
export const SAFE_WRAPPERS = new Set(["encodeURIComponent", "Number", "parseInt", "parseFloat", "Boolean"]);
export function exprUnsafe(expr, isTainted, safeWrappers = SAFE_WRAPPERS) {
  if (isCall(expr) && safeWrappers.has(calleeName(expr))) return false;
  return isTainted(expr);
}
export function eachFunction(ast, cb) {
  traverse(ast, (n) => { if (isFunctionNode(n) && n.body?.type === "BlockStatement") cb(n); });
}
export function usesReq(fn) {
  return fn.params.some((p) => p.type === "Identifier" && p.name === "req");
}
// 문자열 조각(템플릿·+ 이어 붙이기)을 순서대로 평평하게
export function flattenString(node) {
  if (node.type === "TemplateLiteral") {
    const parts = [];
    node.quasis.forEach((q, i) => {
      parts.push({ text: q.value.cooked ?? q.value.raw });
      if (node.expressions[i]) parts.push({ expr: node.expressions[i] });
    });
    return parts;
  }
  if (node.type === "BinaryExpression" && node.operator === "+") return [...flattenString(node.left), ...flattenString(node.right)];
  if (node.type === "StringLiteral") return [{ text: node.value }];
  return [{ expr: node }];
}

// 서버가 요청 값으로 정해지는 주소(호스트 자리)를 부르는 곳(SSRF)
//   주소 맨 앞(호스트를 정하는 자리)이 요청 값일 때만 — 고정 주소 뒤 경로·쿼리에 붙는 값은 SSRF가 아니다.
//   const url = `https://고정/${값}`; fetch(url)처럼 이름에 담은 주소는 그 선언(함수 안 → 파일 맨 위 순)을 따라가 본다.
function hostOf(expr, ctx, depth = 0) {
  if (!expr || depth > 4) return "unknown";
  const parts = flattenString(expr).filter((p) => p.expr || p.text);
  let i = 0;
  if (parts[0]?.text && /^https?:\/\/$/i.test(parts[0].text)) i = 1;
  const head = parts[i];
  if (!head) return "unknown";
  if (head.text != null) return /^(https?:)?\/\/[^/]|^\//i.test(head.text) || i === 1 ? "fixed" : "unknown";
  // 이름이면 그 선언의 주소 모양을 먼저 본다(선언 안에 요청 값이 섞여도 호스트가 고정이면 괜찮다)
  if (head.expr.type === "Identifier") {
    const init = ctx.declBefore(head.expr.name, head.expr.start);
    if (init && !(init.type === "MemberExpression" || init.type === "OptionalMemberExpression")) return hostOf(init, ctx, depth + 1);
  }
  return exprUnsafe(head.expr, ctx.isTainted, ctx.safeWrappers) ? "tainted" : "unknown";
}
export function ruleSsrf(root, { dirs = ["api"], exts = [".js"], safeWrappers = SAFE_WRAPPERS } = {}) {
  const out = [];
  for (const rel of walkFiles(root, { dirs, exts })) {
    const code = readText(root, rel);
    const ast = parseCode(code, rel);
    if (!ast) continue;
    const decls = new Map();
    traverse(ast, (n) => {
      if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init) {
        if (!decls.has(n.id.name)) decls.set(n.id.name, []);
        decls.get(n.id.name).push({ init: n.init, start: n.start });
      }
    });
    const declBefore = (name, pos) => (decls.get(name) || []).filter((d) => d.start < pos).sort((a, b) => b.start - a.start)[0]?.init || null;
    eachFunction(ast, (fn) => {
      if (!usesReq(fn)) return;
      const { isTainted } = taintedNames(fn);
      const ctx = { isTainted, safeWrappers, declBefore };
      traverse(fn.body, (n) => {
        if (!(isCall(n) && n.callee.type === "Identifier" && n.callee.name === "fetch" && n.arguments[0])) return;
        if (hostOf(n.arguments[0], ctx) !== "tainted") return;
        out.push(makeFinding({
          rule: "inject/ssrf", severity: "high", file: rel, line: lineOf(n),
          message: `서버가 요청 값으로 정해지는 주소를 부름: fetch(${nodeText(code, n.arguments[0], 60)})`,
          anchor: nodeText(code, n.arguments[0], 120),
          fix: "허용 호스트 목록과 대조한 뒤에만 부르기",
        }));
      });
    });
  }
  return out;
}

// 잡은 예외의 .message를 그대로 싣는 응답. statuses = [최소, 최대] 상태 코드(5xx를 거르는 감싸개가 있으면 [400, 499]).
//   e.userFacing ? e.message : "고정 문구"처럼 사람에게 보이려고 만든 예외만 싣는 것은 괜찮다.
export function ruleErrorLeak(root, { dirs = ["api"], exts = [".js"], statuses = [400, 599], severity = "low", note = "" } = {}) {
  const out = [];
  for (const rel of walkFiles(root, { dirs, exts })) {
    const code = readText(root, rel);
    const ast = parseCode(code, rel);
    if (!ast) continue;
    const names = new Map([...collectFunctions(ast)].map(([k, v]) => [v, k]));
    eachFunction(ast, (fn) => {
      const fnName = names.get(fn) || fn.id?.name || "(이름 없는 함수)";
      traverse(fn.body, (n) => {
        if (isFunctionNode(n) && n !== fn) return false;
        if (n.type !== "CatchClause" || !n.param || n.param.type !== "Identifier") return;
        const errName = n.param.name;
        const leaks = (x) => {
          if (!x) return false;
          if (x.type === "ConditionalExpression") {
            const userFacing = /userFacing/.test(nodeText(code, x.test, 200));
            return (!userFacing && leaks(x.consequent)) || leaks(x.alternate) || (!userFacing && leaks(x.test));
          }
          if ((x.type === "MemberExpression" || x.type === "OptionalMemberExpression") && memberPath(x) === `${errName}.message`) return true;
          if (x.type === "Identifier") return x.name === errName;
          for (const k of Object.keys(x)) {
            if (k === "loc" || k === "start" || k === "end") continue;
            const v = x[k];
            if (Array.isArray(v)) { if (v.some((y) => y && typeof y.type === "string" && leaks(y))) return true; }
            else if (v && typeof v.type === "string" && !(x.type === "ObjectProperty" && k === "key") && leaks(v)) return true;
          }
          return false;
        };
        traverse(n.body, (c) => {
          if (!isCall(c) || calleeName(c) !== "json") return;
          const st = c.callee.object;
          if (!isCall(st) || calleeName(st) !== "status") return;
          const code0 = st.arguments[0];
          if (code0?.type !== "NumericLiteral" || code0.value < statuses[0] || code0.value > statuses[1]) return;
          if (!leaks(c.arguments[0])) return;
          out.push(makeFinding({
            rule: "leak/error-message", severity, file: rel, line: lineOf(c),
            message: `${fnName}: ${code0.value} 응답에 예외 원문(${errName}.message)${note}`,
            anchor: fnName + ":" + nodeText(code, c, 100),
            fix: "고정 문구로, 원문은 서버 로그(console.error)에만",
          }));
        });
      });
    });
  }
  return out;
}

// 비밀값을 ===로 비교·Math.random()으로 토큰·eval·브라우저 번들에 비밀 같은 VITE_ 환경변수
export function ruleSecretHandling(root, { dirs = ["api", "src"], exts = [".js", ".mjs", ".jsx"], clientDirs = ["src/"] } = {}) {
  const out = [];
  for (const rel of walkFiles(root, { dirs, exts })) {
    const code = readText(root, rel);
    const ast = parseCode(code, rel);
    if (!ast) continue;
    traverse(ast, (n) => {
      if (n.type === "BinaryExpression" && ["===", "==", "!==", "!="].includes(n.operator)) {
        for (const side of [n.left, n.right]) {
          const p = side.type === "MemberExpression" ? memberPath(side) : null;
          if (p && /^process\.env\.[A-Z0-9_]*(SECRET|TOKEN|CODE|PIN|PASSWORD|KEY)[A-Z0-9_]*$/.test(p)) {
            const other = side === n.left ? n.right : n.left;
            if (other.type === "StringLiteral" || other.type === "NullLiteral" || (other.type === "Identifier" && other.name === "undefined")) continue;
            out.push(makeFinding({
              rule: "secret/timing-compare", severity: "medium", file: rel, line: lineOf(n),
              message: `비밀값을 ===로 비교: ${nodeText(code, n, 80)} — 글자를 앞에서부터 비교해 걸리는 시간으로 짐작될 수 있음`,
              anchor: nodeText(code, n, 120), fix: "crypto.timingSafeEqual(시간 일정 비교)",
            }));
          }
        }
      }
      if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && /token|secret|nonce|salt|password|otp|pin(?!g)/i.test(n.id.name) && n.init) {
        let rnd = false;
        traverse(n.init, (x) => { if (isCall(x) && x.callee.type === "MemberExpression" && memberPath(x.callee) === "Math.random") rnd = true; });
        if (rnd) {
          out.push(makeFinding({
            rule: "secret/weak-random", severity: "medium", file: rel, line: lineOf(n),
            message: `${n.id.name}을 Math.random()으로 만듦 — 예측할 수 있는 난수`,
            anchor: n.id.name + ":" + nodeText(code, n.init, 80), fix: "crypto.randomBytes / crypto.getRandomValues",
          }));
        }
      }
      if (isCall(n) && n.callee.type === "Identifier" && n.callee.name === "eval") {
        out.push(makeFinding({ rule: "code/eval", severity: "high", file: rel, line: lineOf(n), message: "eval() 사용", anchor: nodeText(code, n, 100), fix: "eval 없이" }));
      }
      if (n.type === "NewExpression" && n.callee.type === "Identifier" && n.callee.name === "Function") {
        out.push(makeFinding({ rule: "code/eval", severity: "high", file: rel, line: lineOf(n), message: "new Function() 사용", anchor: nodeText(code, n, 100), fix: "new Function 없이" }));
      }
    });
    if (clientDirs.some((d) => rel.startsWith(d))) {
      for (const m of code.matchAll(/import\.meta\.env\.((?:VITE_|PUBLIC_)[A-Z0-9_]*(SECRET|SERVICE|PRIVATE|ADMIN|PASSWORD)[A-Z0-9_]*)/g)) {
        out.push(makeFinding({
          rule: "secret/client-env", severity: "high", file: rel, line: code.slice(0, m.index).split("\n").length,
          message: `화면 코드가 ${m[1]}를 읽음 — 이 값은 빌드 때 누구나 받는 JS에 박힘`, anchor: m[1], fix: "서버에서만 쓰기",
        }));
      }
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// 화면 HTML 주입 — dangerouslySetInnerHTML·srcDoc·innerHTML·insertAdjacentHTML·document.write
//   안전으로 보는 값: 글자 그대로·정화 함수(sanitizers) 호출·그 결과를 담은 변수(useState 포함)·대문자 상수 목록의 칸·
//   allow-scripts 없는 sandbox 틀(srcDoc).
// ════════════════════════════════════════════════════════════════════════════
function htmlExprSafe(expr, scope, sanitizers) {
  if (!expr) return true;
  if (expr.type === "StringLiteral" || expr.type === "NumericLiteral") return true;
  if (expr.type === "TemplateLiteral") return expr.expressions.every((e) => htmlExprSafe(e, scope, sanitizers));
  if (isCall(expr)) {
    const name = calleeName(expr);
    const full = expr.callee.type === "MemberExpression" ? memberPath(expr.callee) : name;
    if (sanitizers.has(name) || sanitizers.has(full)) return true;
    if (name === "useMemo" && isFunctionNode(expr.arguments[0])) {
      const body = expr.arguments[0].body;
      if (body.type !== "BlockStatement") return htmlExprSafe(body, scope, sanitizers);
      const ret = body.body.find((s) => s.type === "ReturnStatement");
      return ret ? htmlExprSafe(ret.argument, scope, sanitizers) : false;
    }
  }
  if (expr.type === "ConditionalExpression") return htmlExprSafe(expr.consequent, scope, sanitizers) && htmlExprSafe(expr.alternate, scope, sanitizers);
  if (expr.type === "LogicalExpression") return htmlExprSafe(expr.left, scope, sanitizers) && htmlExprSafe(expr.right, scope, sanitizers);
  if (expr.type === "BinaryExpression" && expr.operator === "+") return htmlExprSafe(expr.left, scope, sanitizers) && htmlExprSafe(expr.right, scope, sanitizers);
  // 코드에 적힌 상수 목록(대문자 이름)을 .map으로 그리는 칸 — NOTES.map((n) => … n.html)
  if ((expr.type === "MemberExpression" || expr.type === "OptionalMemberExpression") && expr.object.type === "Identifier") {
    if ((scope.constParams || []).some((c) => c.name === expr.object.name && c.start <= expr.start && expr.end <= c.end)) return true;
  }
  if (expr.type === "Identifier" && scope.has(expr.name)) {
    // 같은 이름 선언이 여럿이면 쓰는 자리보다 앞에서 가장 가까운 것
    const decl = scope.get(expr.name).filter((d) => d.start < expr.start).sort((a, b) => b.start - a.start)[0];
    if (!decl) return false;
    const rest = new Map([...scope].filter(([k]) => k !== expr.name));
    rest.constParams = scope.constParams;
    // const [html, setHtml] = useState(처음 값) — 처음 값과 setHtml(…)에 넣는 값이 모두 안전해야
    if (decl.state) return decl.state.values.every((v) => htmlExprSafe(v, rest, sanitizers));
    return htmlExprSafe(decl.init, rest, sanitizers);
  }
  return false;
}

function collectHtmlScope(ast) {
  const scope = new Map();
  const setters = new Map();
  const add = (name, d) => { if (!scope.has(name)) scope.set(name, []); scope.get(name).push(d); };
  traverse(ast, (n) => {
    if (n.type !== "VariableDeclarator" || !n.init) return;
    if (n.id.type === "Identifier") add(n.id.name, { init: n.init, start: n.start });
    if (n.id.type === "ArrayPattern" && isCall(n.init) && calleeName(n.init) === "useState" && n.id.elements[0]?.type === "Identifier") {
      const state = { values: [n.init.arguments[0] || { type: "StringLiteral", value: "" }] };
      add(n.id.elements[0].name, { state, start: n.start });
      if (n.id.elements[1]?.type === "Identifier") setters.set(n.id.elements[1].name, state);
    }
  });
  traverse(ast, (n) => {
    if (isCall(n) && n.callee.type === "Identifier" && setters.has(n.callee.name) && n.arguments[0]) {
      const arg = n.arguments[0];
      // setX(prev => …)는 따라가지 않고 안전하지 않다고 본다
      setters.get(n.callee.name).values.push(isFunctionNode(arg) ? { type: "Unknown" } : arg);
    }
  });
  for (const st of setters.values()) st.values = st.values.map((v) => (v.type === "NullLiteral" ? { type: "StringLiteral", value: "" } : v));
  // UPPER_CASE.map((x) => …)·UPPER_CASE.filter(…).map((x) => …)의 x
  scope.constParams = [];
  traverse(ast, (n) => {
    if (!isCall(n) || calleeName(n) !== "map" || !isFunctionNode(n.arguments[0])) return;
    const p = n.arguments[0].params[0];
    if (p?.type !== "Identifier") return;
    let root = n.callee.object;
    while (root && isCall(root) && (root.callee.type === "MemberExpression" || root.callee.type === "OptionalMemberExpression")) root = root.callee.object;
    if (root?.type === "Identifier" && /^[A-Z][A-Z0-9_]{2,}$/.test(root.name)) scope.constParams.push({ name: p.name, start: n.arguments[0].start, end: n.arguments[0].end });
  });
  return scope;
}

// <iframe sandbox="…"> 에 allow-scripts가 없으면 그 안의 스크립트는 돌지 않는다
function sandboxedWithoutScripts(parent) {
  const attrs = parent?.type === "JSXOpeningElement" ? parent.attributes : [];
  const sb = attrs.find((a) => a.type === "JSXAttribute" && a.name?.name === "sandbox");
  if (!sb) return false;
  if (!sb.value) return true;
  if (sb.value.type === "StringLiteral") return !/allow-scripts/.test(sb.value.value);
  return false;
}

// 코드 조각 하나(파일 전체 또는 .astro의 <script> 하나)에서 HTML 넣는 곳 찾기
export function htmlSinksInCode(code, rel, { sanitizers, lineOffset = 0, fix } = {}) {
  const out = [];
  const ast = parseCode(code, rel);
  if (!ast) return out;
  const scope = collectHtmlScope(ast);
  const report = (node, what, expr) => {
    if (htmlExprSafe(expr, scope, sanitizers)) return;
    out.push(makeFinding({
      rule: "xss/html-sink", severity: "medium", file: rel, line: lineOf(node) + lineOffset,
      message: `${what}에 거르지 않은 값: ${nodeText(code, expr, 70)}`,
      anchor: what + ":" + nodeText(code, expr, 100),
      fix,
    }));
  };
  traverse(ast, (n, parent) => {
    if (n.type === "JSXAttribute" && ["dangerouslySetInnerHTML", "srcDoc"].includes(n.name?.name)) {
      const v = n.value?.expression;
      if (n.name.name === "srcDoc") { if (!sandboxedWithoutScripts(parent)) report(n, "srcDoc", v); return; }
      const prop = v?.type === "ObjectExpression" ? v.properties.find((p) => (p.key?.name ?? p.key?.value) === "__html") : null;
      report(n, "dangerouslySetInnerHTML", prop ? prop.value : v);
    }
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && ["innerHTML", "outerHTML"].includes(n.left.property?.name)) {
      report(n, n.left.property.name, n.right);
    }
    if (isCall(n) && calleeName(n) === "insertAdjacentHTML") report(n, "insertAdjacentHTML", n.arguments[1]);
    if (isCall(n) && n.callee.type === "MemberExpression" && memberPath(n.callee) === "document.write") report(n, "document.write", n.arguments[0]);
  });
  return out;
}

export function ruleHtmlSinks(root, { dirs = ["src"], exts = [".js", ".jsx"], sanitizers = new Set(["sanitize", "DOMPurify.sanitize", "esc", "escapeHtml"]), fix = "정화 함수(DOMPurify 등)를 거치거나, 코드가 만든 고정 HTML이면 기준선에 이유를 적기" } = {}) {
  const out = [];
  for (const rel of walkFiles(root, { dirs, exts })) {
    const code = readText(root, rel);
    if (!/dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write|srcDoc/.test(code)) continue;
    out.push(...htmlSinksInCode(code, rel, { sanitizers, fix }));
  }
  return out;
}
