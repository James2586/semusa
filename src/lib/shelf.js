// 책장 그림(2026-10-24): 가는 책등이 높이·색을 달리해 꽂힌 모습. 홈 "33권 전체 보기" 표지와 칼럼·책 "책 33권" 표지가 같이 쓴다.
// 대표 저서 두 권(src/data/home.json 색)이 섞여 들어간다. 매번 같은 그림이 나오게 정해진 순서로 만든다(빌드 때만).
const CLOTH = ["#1E3A2A", "#2C5040", "#6B4E2E", "#3A4A5C", "#5B2333", "#806020", "#2F2A24", "#4E5B4F", "#7A2E2A", "#33466B"];
// 그린 표지의 글자색: 먹색·크림색 중 표지색과 대비가 더 큰 쪽(WCAG 대비 — 빨간 표지 #FF0000에 크림색은 3.7:1이라 먹색, 먹색도 #151915는 4.44:1이라 더 진하게)
const lum = (hex) => {
  const n = parseInt(String(hex).slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export function inkFor(hex) {
  return contrast(hex, "#0A0C0A") > contrast(hex, "#FFF6E4") ? "#0A0C0A" : "#FFF6E4";
}
export function shelfSpines(featured = [], n = 14) {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const at = new Map(featured.map((c, i) => [Math.floor(((i + 1) * n) / (featured.length + 1)), c]));
  return Array.from({ length: n }, (_, i) => {
    const f = at.get(i);
    return { c: f || CLOTH[Math.floor(rnd() * CLOTH.length)], w: f ? 1.35 : 0.8 + rnd() * 0.5, h: f ? 0.96 : 0.68 + rnd() * 0.26, featured: !!f };
  });
}

// 책 지은이 줄: 대표 + 공저자(home.json books coauthors — 표지에 적힌 이름 그대로)
export function bookAuthors(rep, book) {
  return [rep, ...((book && book.coauthors) || [])].join(" · ");
}
