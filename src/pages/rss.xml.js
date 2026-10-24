// 새 글 알림(RSS, 2026-10-24 5차 B1): 지면 칼럼(press.json — 제목·날짜·주소 그대로). 네이버 서치어드바이저에 제출하면 새 글 수집이 빨라진다.
import press from "../data/press.json";
import site from "../data/site.json";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// 날짜만 있는 글은 한국 시각 오전 9시로(요일·시각은 RSS 형식이 요구 — 지면 날짜는 그대로)
const rfc822 = (iso) => new Date(`${iso}T09:00:00+09:00`).toUTCString();

export function GET() {
  const items = [...(press.articles || [])].sort((a, b) => b.date.localeCompare(a.date));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(site.name)} — 칼럼</title>
<link>${site.siteUrl}/columns</link>
<atom:link href="${site.siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
<description>${esc(`${site.repTitle} ${site.rep}의 이코노미조선 「성광호의 세무 ABC」 칼럼`)}</description>
<language>ko</language>
${items.map((a) => `<item>
<title>${esc(a.title)}</title>
<link>${esc(a.url)}</link>
<guid isPermaLink="true">${esc(a.url)}</guid>
<pubDate>${rfc822(a.date)}</pubDate>
<category>${esc(a.topic)}</category>
<description>${esc(`이코노미조선 · ${a.topic}`)}</description>
</item>`).join("\n")}
</channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
