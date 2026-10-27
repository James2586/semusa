// 🛡 보안 점검 — 운영 사이트 GET 확인(2026-10-27). tax-search·stock-valuation·semusa 세 저장소에 **같은 파일**로 둔다.
//   코드 읽기(@babel/parser)를 쓰지 않아 서버 함수(tax-search api/_securityProbe.js — 관리자 버튼·밤 9시 점검)도 불러 쓴다 — 여기에 무거운 import를 더하지 말 것.
//   GET만 보내고 응답 본문은 저장하지 않는다(상태 코드·형식·길이와 넘겨받은 판정 함수의 참/거짓만).
//   사이트마다 "점검 계획"(plan)을 주면 runSitePlan이 검사 줄(checks)을 돌려준다 — 판정: ok·bad(확인 필요)·warn(서버 오류)·known(기준선에서 이유와 함께 받아들임)·skip·error(연결 실패).

export async function probeGet(url, { timeoutMs = 20_000, headers = {}, look = null, redirect = "manual", fetchImpl = fetch } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { method: "GET", headers: { "user-agent": "security-probe (GET only)", ...headers }, redirect, signal: ctrl.signal });
    const text = await r.text();
    const hdr = {};
    r.headers.forEach((v, k) => { hdr[k] = v; });
    return { ok: true, status: r.status, type: hdr["content-type"] || "", bytes: text.length, headers: hdr, looked: look ? !!look(text, r.status, hdr) : null };
  } catch (e) {
    return { ok: false, status: 0, error: e?.name === "AbortError" ? "시간 초과" : "연결 실패" };
  } finally {
    clearTimeout(t);
  }
}

// 운영 응답 헤더 판정(probeGet 결과의 headers) — id는 점검 계획의 acceptHeaders(받아들인 항목)와 맞춘다
export function judgeLiveHeaders(url, hdr) {
  const out = [];
  const lower = Object.fromEntries(Object.entries(hdr || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const want = [
    ["strict-transport-security", "hsts", "늘 https로만(HSTS)"],
    ["x-content-type-options", "nosniff", "파일 형식 추측 막기"],
    ["referrer-policy", "referrer", "주소 전체 안 보내기"],
  ];
  for (const [k, id, why] of want) if (!lower[k]) out.push({ ok: false, id, what: `${k} 없음 — ${why}` });
  if (!lower["x-frame-options"] && !/frame-ancestors/.test(lower["content-security-policy"] || "")) out.push({ ok: false, id: "frame", what: "X-Frame-Options·frame-ancestors 없음 — 다른 사이트 틀(iframe)에 넣기 허용" });
  if (!lower["content-security-policy"]) out.push(lower["content-security-policy-report-only"] ? { ok: false, id: "csp-report-only", what: "CSP 보고 전용(차단 안 함)" } : { ok: false, id: "csp", what: "CSP 없음" });
  if (lower["x-powered-by"]) out.push({ ok: false, id: "powered-by", what: `x-powered-by 머리 노출(${lower["x-powered-by"]})` });
  void url;
  return out;
}

// 흔히 실수로 공개되는 파일 — 열리면(200 + 그 파일다운 내용) 문제
export const EXPOSED_FILE_CHECKS = [
  { path: "/.env", look: (t, s) => s === 200 && /^[A-Z_][A-Z0-9_]*=/m.test(t) && !/<html/i.test(t) },
  { path: "/.git/config", look: (t, s) => s === 200 && /\[core\]/.test(t) },
  { path: "/.git/HEAD", look: (t, s) => s === 200 && /^ref: refs\//.test(t) },
  { path: "/package.json", look: (t, s) => s === 200 && /"dependencies"\s*:/.test(t) && !/<html/i.test(t) },
  { path: "/.vercel/project.json", look: (t, s) => s === 200 && /projectId/.test(t) },
  { path: "/vercel.json", look: (t, s) => s === 200 && /"headers"|"rewrites"/.test(t) && !/<html/i.test(t) },
];

// 할 일 목록을 n개씩 나눠 돌리고, 끝 시각(deadline, ms)을 넘기면 남은 일은 { skipped: true }로 둔다
export async function runPool(tasks, n = 6, { deadline = Infinity, now = () => Date.now() } = {}) {
  const out = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      if (now() >= deadline) { out[i] = { skipped: true }; continue; }
      try { out[i] = await tasks[i](); } catch { out[i] = { ok: false, status: 0, error: "확인 실패" }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, worker));
  return out;
}

export const PROBE_KINDS = { deny: "로그인 없이 막혀야 하는 주소", token: "아무 토큰으로 열면 안 열려야 하는 고객 링크", header: "보안 헤더(실제 응답)", file: "실수로 공개되기 쉬운 파일", sourcemap: "소스맵(코드 원문)" };
export const VERDICT_TEXT = { ok: "✅ 정상", bad: "❌ 확인 필요", warn: "⚠ 서버 오류", known: "☑ 알고 있음", skip: "⏭ 건너뜀", error: "… 연결 실패" };
const check = (kind, path, extra) => ({ key: [kind, path, extra.id].filter(Boolean).join("|"), kind, path, ...extra });
const statusText = (res) => (res.ok ? res.status : res.error);

/**
 * 사이트 하나 점검. plan = { site, name, deny: [{ path, expect: [401,403], what?, skip?: "부르지 않는 이유" }],
 *   tokens: [{ path, what }], headers: ["/", …], acceptHeaders: { id: "이유" }, files: true, sourceMaps: true }
 * → { site, name, at, checks: [{ key, kind, path, what, expect, status, verdict, note }] }
 */
export async function runSitePlan(plan, { fetchImpl = fetch, deadline = Infinity, now = () => Date.now(), concurrency = 6, timeoutMs = 15_000 } = {}) {
  const { site } = plan;
  const g = (p, look) => probeGet(site + p, { fetchImpl, timeoutMs, look });
  const tasks = [];
  for (const p of plan.deny || []) {
    if (p.skip) { tasks.push(async () => [check("deny", p.path, { what: p.what || "", expect: p.expect, status: null, verdict: "skip", note: p.skip })]); continue; }
    tasks.push(async () => {
      const res = await g(p.path, (t, s) => s === 200 && /^\s*[{[]/.test(t));
      const verdict = !res.ok ? "error" : p.expect.includes(res.status) ? "ok" : res.status >= 500 ? "warn" : "bad";
      return [check("deny", p.path, { what: p.what || "", expect: p.expect, status: statusText(res), verdict, note: verdict === "bad" && res.looked ? "로그인 없이 자료가 옴" : "" })];
    });
  }
  for (const p of plan.tokens || []) {
    tasks.push(async () => {
      const res = await g(p.path, (t, s) => s === 200 && t.length > 200);
      const verdict = !res.ok ? "error" : res.status >= 500 ? "warn" : res.status === 200 ? "bad" : "ok";
      return [check("token", p.path, { what: p.what || "", expect: [400, 401, 404, 410], status: statusText(res), verdict, note: verdict === "bad" && res.looked ? "내용이 옴" : "" })];
    });
  }
  for (const u of plan.headers || []) {
    tasks.push(async () => {
      const res = await g(u);
      if (!res.ok) return [check("header", u, { what: "", status: res.error, verdict: "error", note: "" })];
      const issues = judgeLiveHeaders(site + u, res.headers);
      if (!issues.length) return [check("header", u, { what: "보안 헤더 있음", status: res.status, verdict: "ok", note: "" })];
      return issues.map((i) => {
        const reason = plan.acceptHeaders?.[i.id];
        return check("header", u, { id: i.id, what: i.what, status: res.status, verdict: reason ? "known" : "bad", note: reason || "" });
      });
    });
  }
  if (plan.files !== false) {
    for (const c of EXPOSED_FILE_CHECKS) {
      tasks.push(async () => {
        const res = await g(c.path, c.look);
        const verdict = !res.ok ? "error" : res.looked ? "bad" : "ok";
        return [check("file", c.path, { what: "", status: statusText(res), verdict, note: verdict === "bad" ? "열림" : res.ok && res.status === 200 ? "그 파일이 아니라 첫 화면이 옴" : "" })];
      });
    }
  }
  if (plan.sourceMaps !== false) {
    tasks.push(async () => {
      let scripts = [];
      const home = await g("/", (t) => { scripts = [...t.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]).slice(0, 3); return true; });
      if (!home.ok) return [check("sourcemap", "/", { what: "첫 화면", status: home.error, verdict: "error", note: "" })];
      if (!scripts.length) return [check("sourcemap", "/", { what: "첫 화면에 스크립트 없음", status: home.status, verdict: "ok", note: "" })];
      const out = [];
      for (const s of scripts) {
        const url = new URL(s + ".map", site + "/");
        const p = url.origin === new URL(site).origin ? url.pathname : url.href;
        const res = await probeGet(url.href, { fetchImpl, timeoutMs, look: (t, st) => st === 200 && /"sources"\s*:/.test(t) });
        const verdict = !res.ok ? "error" : res.looked ? "bad" : "ok";
        out.push(check("sourcemap", p, { what: "", status: statusText(res), verdict, note: verdict === "bad" ? "코드 원문 노출" : "" }));
      }
      return out;
    });
  }
  const results = await runPool(tasks, concurrency, { deadline, now });
  const checks = [];
  results.forEach((r) => {
    if (Array.isArray(r)) checks.push(...r);
    else checks.push({ key: "time|deadline", kind: "time", path: "", what: "", status: null, verdict: "skip", note: r?.skipped ? "시간이 모자라 건너뜀" : "확인 실패" });
  });
  return { site, name: plan.name || site, at: new Date(now()).toISOString(), checks };
}

export function countVerdicts(checks) {
  const c = { ok: 0, bad: 0, warn: 0, known: 0, skip: 0, error: 0 };
  for (const x of checks || []) c[x.verdict] = (c[x.verdict] || 0) + 1;
  return c;
}

// 앞 점검에서 bad가 아니었는데 이번에 bad가 된 줄(사이트 + key) — 알림은 이것만
export function newBadChecks(prevSites, sites) {
  const prev = new Set();
  for (const s of prevSites || []) for (const c of s.checks || []) if (c.verdict === "bad") prev.add(`${s.site}|${c.key}`);
  const out = [];
  for (const s of sites || []) for (const c of s.checks || []) if (c.verdict === "bad" && !prev.has(`${s.site}|${c.key}`)) out.push({ site: s.site, name: s.name, ...c });
  return out;
}

// 보고서(security/report.md) 구역 — runSitePlan 결과 하나
export function siteProbeSection(result, { footer = [] } = {}) {
  const n = countVerdicts(result.checks);
  const bad = result.checks.filter((c) => c.verdict === "bad");
  const lines = [bad.length ? `**확인 필요 ${bad.length}건**: ${bad.map((c) => c.path + (c.id ? ` (${c.id})` : "")).join(", ")}` : "확인 필요 없음",
    "", `정상 ${n.ok} · 확인 필요 ${n.bad} · 서버 오류 ${n.warn} · 알고 있음 ${n.known} · 건너뜀 ${n.skip} · 연결 실패 ${n.error}`];
  for (const [kind, title] of Object.entries(PROBE_KINDS)) {
    const rows = result.checks.filter((c) => c.kind === kind);
    if (!rows.length) continue;
    lines.push("", `### ${title}`, "", "| 주소 | 기대 | 실제 | 판정 |", "|---|---|---|---|");
    for (const c of rows) lines.push(`| ${c.path}${c.what ? ` (${c.what})` : ""} | ${c.expect ? c.expect.join("·") : "—"} | ${c.status ?? "—"} | ${VERDICT_TEXT[c.verdict]}${c.note ? ` — ${c.note}` : ""} |`);
  }
  if (footer.length) lines.push("", ...footer);
  return { title: `운영 사이트 확인(${result.site}, GET만)`, lines };
}
