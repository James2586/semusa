// 쪽마다 공유 그림(2026-10-24 3차 B3): 카카오톡·문자로 주소를 보낼 때 뜨는 그림을 쪽마다 따로. 글은 자료 파일 그대로(새 문구 없음).
// 그림은 scripts/make-og-pages.mjs가 public/og/<file>.png로 만든다(빌드에 안 씀 — 자료를 고치면 다시 돌린다, tests/og-pages.test.mjs가 빠진 그림을 잡음).
// 기한 달력의 ?e= 같은 주소 값은 정적 쪽이라 그림을 나눌 수 없다 — 쪽 하나에 그림 하나.
export function ogPagesFrom({ services = [], calculators = [], groups = [], booksTotal }) {
  const gname = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  return [
    { path: "/guide", file: "guide", kicker: "상황 길잡이", title: "세 가지만 고르세요", sub: "무슨 일·언제·누구 일 → 기한·서비스·계산기를 한 화면에" },
    { path: "/deadline", file: "deadline", kicker: "기한 달력", title: "기한을 달력으로 봅니다", sub: "센 날과 건너뛴 쉬는 날, 진짜 마감일까지" },
    { path: "/tax-calendar", file: "tax-calendar", kicker: "올해 세금 달력", title: "매년 돌아오는 기한, 12달", sub: "원천세·부가가치세·종합소득세·법인세·종합부동산세" },
    { path: "/services", file: "services", kicker: "서비스", title: "일마다 먼저 볼 기한이 다릅니다", sub: services.map((s) => s.name).join(" · ") },
    { path: "/calculators", file: "calculators", kicker: `세금 계산기 ${calculators.length}종`, title: "직접 만든 계산기로 먼저", sub: "결과는 참고용입니다" },
    { path: "/columns", file: "columns", kicker: "칼럼·책", title: `저서 ${booksTotal}권과 칼럼`, sub: "이코노미조선 「성광호의 세무 ABC」" },
    { path: "/about", file: "about", kicker: "전문가 소개", title: "세무전문가 성광호", sub: `저서 ${booksTotal}권 · 이코노미조선 칼럼리스트` },
    { path: "/faq", file: "faq", kicker: "자주 묻는 질문", title: "자주 묻는 질문", sub: "근거 조문과 함께 답합니다" },
    ...services.map((s) => ({ path: `/services/${s.slug}`, file: `services-${s.slug}`, kicker: "서비스", title: s.name, sub: (s.keyDeadlines || []).map(([l, v]) => `${l} ${v}`).join(" · ") })),
    ...calculators.map((c) => ({ path: `/calculators/${c.slug}`, file: `calc-${c.slug}`, kicker: `세금 계산기 · ${gname[c.group] || ""}`, title: c.name, sub: `${c.short} · 결과는 참고용` })),
  ];
}
