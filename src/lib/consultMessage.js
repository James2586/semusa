// 상담 요청 글(2026-10-24 4차 C1): 화면에서 고른 것(상황·날짜·기한·챙긴 서류)을 카카오톡에 붙일 글 한 묶음으로.
// 이 기기 안에서만 만들고 어디로도 보내지 않는다. 이름·연락처·금액 칸은 두지 않는다. 기한은 화면 계산값 그대로(참고용 표시).
export function buildConsultMessage({ siteName, situation, who, dateLabel, dateText, deadlineName, deadlineText, prepared = [], notYet = [], url } = {}) {
  const lines = [`안녕하세요. ${siteName || "홈페이지"}를 보고 문의드립니다.`, ""];
  if (situation) lines.push(`· 상황: ${situation}${who ? ` (${who})` : ""}`);
  if (dateText) lines.push(`· ${dateLabel || "날짜"}: ${dateText}`);
  if (deadlineName && deadlineText) lines.push(`· 기한: ${deadlineName} — ${deadlineText}까지 (홈페이지 계산, 참고용)`);
  if (prepared.length) lines.push(`· 준비된 것: ${prepared.join(", ")}`);
  if (notYet.length) lines.push(`· 아직 없는 것: ${notYet.join(", ")}`);
  lines.push("· 궁금한 점: ");
  if (url) lines.push("", `(보던 화면: ${url})`);
  return lines.join("\n");
}

// 쪽 → ConsultNote: 마지막 선택을 window에도 남겨, 스크립트 실행 순서와 관계없이 처음 선택을 놓치지 않게
export function sendConsult(detail) {
  globalThis.__consultLast = detail;
  globalThis.dispatchEvent?.(new CustomEvent("consult:update", { detail }));
}
