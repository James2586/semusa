// 법조문 원문 옮기기 공용(2026-10-24 5차 A3): 쓰기(기본) 또는 --check(지금 docs 파일과 새로 받은 원문을 비교해 바뀐 곳만 알림, 쓰지 않음).
// 비교는 법 이름·조문·제목·법률 번호와 원문 줄 글자 — 받은 날(fetchedAt)만 달라진 것은 바뀜으로 치지 않는다.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";

export const argDir = (fallback) => process.argv.slice(2).find((a) => !a.startsWith("--")) || fallback;
export const isCheck = () => process.argv.includes("--check");
const lineText = (l) => (typeof l === "string" ? l : l.t);

export function diffSources(oldItems, newItems) {
  const out = [];
  for (const id of new Set([...Object.keys(oldItems), ...Object.keys(newItems)])) {
    const a = oldItems[id], b = newItems[id];
    const name = (b || a).law + " " + (b || a).article;
    if (!a) { out.push(`${id} (${name}): 새로 생김`); continue; }
    if (!b) { out.push(`${id} (${name}): 원문에서 사라짐`); continue; }
    for (const k of ["law", "article", "title", "promulgationNo"]) if (a[k] !== b[k]) out.push(`${id} (${name}): ${k} ${a[k]} → ${b[k]}`);
    const la = a.lines.map(lineText), lb = b.lines.map(lineText);
    const changed = Math.max(la.length, lb.length) - la.filter((t, i) => t === lb[i]).length;
    if (changed) out.push(`${id} (${name}): 원문 ${changed}줄 달라짐`);
  }
  return out;
}

export function writeOrCheck(outPath, items, note, label) {
  if (!isCheck()) {
    writeFileSync(outPath, JSON.stringify({ _note: note, items }, null, 1) + "\n");
    console.log(`${label} ${Object.keys(items).length}개 → ${outPath.split("/").slice(-2).join("/")}`);
    return;
  }
  const old = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")).items : {};
  const d = diffSources(old, items);
  const head = `${label}: ${d.length ? `${d.length}곳 바뀜 — 사이트 글을 확인한 뒤 스크립트를 --check 없이 돌려 옮기세요` : "바뀐 곳 없음"}`;
  console.log([head, ...d.map((x) => " - " + x)].join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, [`### ${head}`, ...d.map((x) => `- ${x}`), ""].join("\n"));
  if (d.length) process.exitCode = 1;
}
