// 법조문 원문의 선 문자 표(┌┬┐│├┼┤└┴┘)를 칸으로 푼다(2026-10-24 5차 A1). 칸 글은 원문 글자 그대로(앞뒤 빈칸만 정리),
// 한 칸이 여러 줄에 걸치면 띄어 이어 붙인다. 열이 없는 상자(계산식 그림 — 원문에서 띄어쓰기가 무너져 있음)는 풀지 않고 { type: "formula" }로 둔다.
// 숫자를 해석하거나 계산하지 않는다.

const stripImg = (s) => s.replace(/<img[^>]*>/g, "").replace(/<\/img>/g, "");

export function parseBox(box) {
  const cols = (box.match(/┌([─┬]+)┐/)?.[1].match(/┬/g) || []).length + 1;
  if (cols < 2) return { type: "formula" };
  const inner = box.replace(/^\s*┌[─┬]+┐/, "").replace(/└[─┴]+┘\s*$/, "");
  const rows = [];
  for (const chunk of inner.split(/├[─┼]+┤/)) {
    const tok = chunk.trim().split("│");
    if ((tok.length - 1) % (cols + 1) !== 0) return { type: "raw", text: box };
    const lines = (tok.length - 1) / (cols + 1);
    const cells = Array.from({ length: cols }, (_, c) => Array.from({ length: lines }, (_, l) => tok[1 + l * (cols + 1) + c].trim()).filter(Boolean).join(" "));
    rows.push(cells);
  }
  return { type: "table", head: rows[0], rows: rows.slice(1) };
}

// 한 줄 원문 → [글, 표, 글, …]
export function splitLawLine(text) {
  const t = stripImg(String(text || ""));
  const out = [];
  let i = 0;
  for (const m of t.matchAll(/┌[\s\S]*?┘/g)) {
    const before = t.slice(i, m.index).trim();
    if (before) out.push({ type: "text", text: before });
    out.push(parseBox(m[0]));
    i = m.index + m[0].length;
  }
  const rest = t.slice(i).trim();
  if (rest) out.push({ type: "text", text: rest });
  return out;
}

// 원문 줄 중 항(①②…) 고르기 — 항 줄과 그 아래 호·목 줄(d > 1)을 함께. 「삭제」 줄은 뺀다.
export function pickParagraphs(lines, marks) {
  const keep = [];
  let on = !marks?.length;
  for (const l of lines) {
    if (l.d === 1) on = !marks?.length || marks.some((m) => l.t.trim().startsWith(m));
    if (on && !/^\s*(\d+\.|[가-하]\.|[①-⑳])?\s*삭제\s*<[\d.]+>\s*$/.test(l.t)) keep.push(l);
  }
  return keep;
}
