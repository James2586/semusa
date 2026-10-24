// 책장 그림(2026-10-24): 가는 책등이 높이·색을 달리해 꽂힌 모습. 홈 "33권 전체 보기" 표지와 칼럼·책 "책 33권" 표지가 같이 쓴다.
// 대표 저서 두 권(src/data/home.json 색)이 섞여 들어간다. 매번 같은 그림이 나오게 정해진 순서로 만든다(빌드 때만).
const CLOTH = ["#1E3A2A", "#2C5040", "#6B4E2E", "#3A4A5C", "#5B2333", "#806020", "#2F2A24", "#4E5B4F", "#7A2E2A", "#33466B"];
export function shelfSpines(featured = [], n = 14) {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const at = new Map(featured.map((c, i) => [Math.floor(((i + 1) * n) / (featured.length + 1)), c]));
  return Array.from({ length: n }, (_, i) => {
    const f = at.get(i);
    return { c: f || CLOTH[Math.floor(rnd() * CLOTH.length)], w: f ? 1.35 : 0.8 + rnd() * 0.5, h: f ? 0.96 : 0.68 + rnd() * 0.26, featured: !!f };
  });
}
