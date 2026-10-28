// 🛡 보안 점검(2026-10-27) — tax-search·stock-valuation·semusa 세 저장소에 **같은 파일**로 둔다(저장소별 규칙은 scripts/security/rules.mjs).
//   npm run security:scan            코드 검사 → security/report.md, 기준선에 없는 새 항목·지워야 할 기준선 항목이 있으면 실패(exit 1)
//   npm run security:scan -- --audit 의존성 취약점(npm audit — 인터넷 필요)도 보고서에
//   npm run security:probe           위 + 운영 사이트 GET 확인(응답 본문 저장 안 함, AI·결제·크론 경로는 부르지 않음)
//   --update-baseline                새 항목을 기준선에 "open"(확인 필요)으로 더하고, 이제 안 나오는 항목은 지운다 — 사람이 보고 나서만
//   시험(npm test)은 코드 검사만 돈다 — 운영 확인·npm audit은 코드가 그대로여도 결과가 바뀌어 시험에 넣지 않는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeFindings, loadBaseline, compareBaseline, baselineWithNew, renderReport, npmAudit, auditSection, nowKstText, scanSnapshot, auditSnapshot, SEVERITY_LABEL } from "./security/core.mjs";
import * as rules from "./security/rules.mjs";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_FILE = path.join(ROOT, "security", "baseline.json");
export const REPORT_FILE = path.join(ROOT, "security", "report.md");
export const SNAPSHOT_FILE = path.join(ROOT, "security", "scan.json"); // 관리자 화면·서버 점검용 요약(규칙 파일에 probePlan이 있으면 점검 계획도)
export const AUDIT_FILE = path.join(ROOT, "security", "audit.json"); // --audit·--probe 때만 다시 만듦(인터넷 필요 — 시험과 대조하지 않음)

// security/scan.json 내용(생성 시각 제외) — 시험이 지금 코드로 만든 값과 대조한다
export function snapshotOf(scan) {
  return scanSnapshot(scan, typeof rules.probePlan === "function" ? { probePlan: rules.probePlan(scan.routes || []) } : {});
}

export function runScan(root = ROOT) {
  const { findings, sections = [], ...extra } = rules.runRules(root);
  const list = finalizeFindings(findings);
  const baseline = loadBaseline(path.join(root, "security", "baseline.json"));
  return { ...extra, findings: list, sections, baseline, comparison: compareBaseline(list, baseline) };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const scan = runScan();
  const sections = [...scan.sections];
  const notes = [];
  if (args.has("--audit") || args.has("--probe")) {
    const audit = await npmAudit(ROOT);
    sections.push(auditSection(audit, rules.AUDIT_NOTES || {}));
    // 못 읽었으면 예전 파일을 덮지 않는다(인터넷이 끊긴 세션에서 돌려도 패널이 비지 않게)
    if (audit.ok) fs.writeFileSync(AUDIT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), ...auditSnapshot(audit, rules.AUDIT_NOTES || {}) }, null, 1) + "\n");
    else notes.push(`npm audit 실패 — ${path.relative(ROOT, AUDIT_FILE)}는 그대로 둠`);
  }
  if (args.has("--probe")) {
    if (typeof rules.runProbes !== "function") notes.push("이 저장소엔 운영 확인 규칙이 없음");
    else sections.push(...(await rules.runProbes(scan)));
  }
  if (rules.LIMITS?.length) sections.push({ title: "이 도구가 못 보는 것", lines: rules.LIMITS.map((s) => `- ${s}`) });
  const md = renderReport({ title: rules.TITLE || "보안 점검 보고서", generatedAt: nowKstText(), findings: scan.findings, comparison: scan.comparison, sections, notes });
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, md + "\n");
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), ...snapshotOf(scan) }, null, 1) + "\n");

  const { fresh, known, stale } = scan.comparison;
  console.log(`보안 점검: 찾은 것 ${scan.findings.length}건(기준선에 있음 ${known.length}, 새로 찾음 ${fresh.length}, 지울 기준선 ${stale.length}) → ${path.relative(ROOT, REPORT_FILE)}`);
  for (const f of fresh) console.log(`  [새로·${SEVERITY_LABEL[f.severity]}] ${f.file}:${f.line} ${f.rule} — ${f.message}`);
  for (const e of stale) console.log(`  [지울 기준선] ${e.key}`);

  if (args.has("--update-baseline")) {
    const kept = { ...scan.baseline, entries: scan.baseline.entries.filter((e) => !stale.some((s) => s.key === e.key)) };
    const next = baselineWithNew(kept, fresh, new Date().toISOString().slice(0, 10));
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(next, null, 2) + "\n");
    console.log(`기준선 갱신: +${fresh.length} / -${stale.length} → ${path.relative(ROOT, BASELINE_FILE)}`);
    return;
  }
  if (fresh.length || stale.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
