// 네이버 블로그 RSS(2.0)에서 최신 글 제목·주소·날짜·요약·대표 사진만 읽는다. 빌드 때만 쓰며, 실패하면 빈 목록.
// 요약에서 주소 글자는 뺀다(본문이 링크로 시작하는 글은 요약이 주소뿐이었다). 제목·요약(주소 포함)이 같은 글은 한 번만.
export function parseRss(xml, limit = 6) {
  const items = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const pick = (block, tag) => {
    const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`).exec(block);
    return m ? m[1].trim() : "";
  };
  const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const seen = new Set();
  return items.map((b) => {
    const link = unescape(pick(b, "link"));
    const d = new Date(pick(b, "pubDate"));
    const html = unescape(unescape(pick(b, "description")));
    const img = /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1] || "";
    const text = html.replace(/<\/?(p|br|div|li|h\d)[^>]*>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const desc = text.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
    return {
      key: `${pick(b, "title")}|${text}`,
      title: unescape(pick(b, "title")).replace(/<[^>]+>/g, ""),
      excerpt: desc.length > 110 ? desc.slice(0, 110).trim() + "…" : desc,
      link,
      date: Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10),
      // 네이버 사진 서버(https, pstatic.net)만 — 그 밖의 주소는 쓰지 않는다
      image: /^https:\/\/[a-z0-9.-]+\.pstatic\.net\//i.test(img) ? img : "",
    };
  }).filter((p) => {
    if (!p.title || !/^https:\/\/(m\.)?blog\.naver\.com\//.test(p.link)) return false;
    // 같은 글을 두 번 올린 경우(제목·본문 요약이 주소까지 같음)만 한 번으로 — 매주 같은 제목의 다른 글은 남는다
    if (seen.has(p.key)) return false;
    seen.add(p.key);
    return true;
  }).slice(0, limit).map(({ key, ...p }) => p);
}

export async function fetchBlogPosts(url, limit = 6) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    return parseRss(await res.text(), limit);
  } catch {
    return [];
  }
}
