// 자주 묻는 질문의 근거 원문 고르기(2026-10-25 6차 D). 질문 머리말 src: "inherit47 ① ③; income88 1." —
// 근거 이름(docs/faq-sources.json) 뒤에 고를 항(①…, 그 항의 호·목까지 함께)이나 호(1. — 그 줄만)를 적고, 근거끼리는 ;로 나눈다.
export function parseSrc(src) {
  return String(src || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [id, ...marks] = s.split(/\s+/);
    return { id, marks };
  });
}

export function pickLines(lines, marks) {
  const paras = marks.filter((m) => /^[①-⑳]$/.test(m)), items = marks.filter((m) => !paras.includes(m));
  const isItem = (t) => items.some((m) => t.startsWith(m + " ") || t === m);
  const out = [];
  let on = !marks.length;
  for (const l of lines) {
    const t = l.t.trim();
    const isPara = /^[①-⑳]/.test(t);
    if (isPara) on = !marks.length || paras.some((m) => t.startsWith(m));
    // 항만 고르면 그 항 전체(호·목까지), 항과 호를 같이 고르면 그 항의 첫 줄과 고른 호만, 호만 고르면 그 호 줄만
    const keep = !marks.length ? true
      : paras.length ? on && (!items.length || isPara || isItem(t))
      : isItem(t);
    if (keep) out.push(l);
  }
  return out;
}

// 고른 원문 — [{ id, src(조문 정보), lines }]. 없는 근거·고른 줄이 없으면 lines가 빈 배열.
export function faqQuotes(srcText, items) {
  return parseSrc(srcText).map(({ id, marks }) => ({ id, src: items[id] || null, lines: items[id] ? pickLines(items[id].lines, marks) : [] }));
}

// 답에 든 숫자(금액·기간·날짜) — 고른 원문 줄과 그 판의 법률 번호·시행일에 있어야 한다(용어 풀이와 같은 방식)
export function faqNumberGaps(body, quotes) {
  const ymd = (s) => (s ? `${Number(s.slice(0, 4))}. ${Number(s.slice(4, 6))}. ${Number(s.slice(6, 8))}.` : "");
  const hay = quotes.flatMap((q) => [...q.lines.map((l) => l.t), q.src?.promulgationNo ? `제${q.src.promulgationNo}호` : "", ymd(q.src?.promulgationDate), ymd(q.src?.effectiveDate)]).join(" ");
  const text = String(body).replace(/\]\([^)]*\)/g, "]"); // 링크 주소 속 숫자는 빼고
  // 숫자는 단위까지 함께 대조(「3개월」이 「3년」으로 통과하지 않게)
  return [...new Set(text.match(/\d[\d,]*(?:억|천만|만)?(?:원|년|개월|일|월|호|조|항|명)?/g) || [])].filter((n) => !hay.includes(n));
}
