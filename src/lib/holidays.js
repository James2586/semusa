// 공휴일 목록 — 빌드할 때 통합검색 22(택스 서치)의 공개 자료(한국천문연구원 특일 정보로 채운 표)를 한 번 읽는다.
// 못 읽으면 빈 목록: 계산은 토·일요일·노동절만 넘기고 화면에 "공휴일 자료 없음"을 적는다(조용히 틀리지 않게). 빌드는 멈추지 않는다.
let cached = null;
export function fetchHolidayRows(url = "https://tax-search-rho.vercel.app/api/faq?resource=holidays") {
  if (!cached) {
    cached = (async () => {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) return [];
        const j = await r.json();
        return (Array.isArray(j?.years) ? j.years : [])
          .filter((y) => /^\d{4}$/.test(String(y.year)) && Array.isArray(y.days))
          .map((y) => ({ year: String(y.year), days: y.days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d?.date)).map((d) => ({ date: d.date, name: String(d.name || "공휴일").slice(0, 20) })) }));
      } catch {
        return [];
      }
    })();
  }
  return cached;
}
