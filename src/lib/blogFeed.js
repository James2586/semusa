// 네이버 블로그 RSS(2.0)에서 최신 글 제목·주소·날짜만 읽는다. 빌드 때만 쓰며, 실패하면 빈 목록.
export function parseRss(xml, limit = 6) {
  const items = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const pick = (block, tag) => {
    const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`).exec(block);
    return m ? m[1].trim() : "";
  };
  const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return items.slice(0, limit).map((b) => {
    const link = unescape(pick(b, "link"));
    const d = new Date(pick(b, "pubDate"));
    return {
      title: unescape(pick(b, "title")).replace(/<[^>]+>/g, ""),
      link,
      date: Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10),
    };
  }).filter((p) => p.title && /^https:\/\/(m\.)?blog\.naver\.com\//.test(p.link));
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
