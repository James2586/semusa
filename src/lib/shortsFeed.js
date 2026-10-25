// 유튜브 공개 영상 목록(Atom 피드)에서 Shorts만 — 첫 화면 「부기와 1분 세금」(2026-10-25 6차 C). 빌드 때만 쓴다.
// 제목은 그대로(고쳐 쓰지 않음). 세금 주제는 제목 낱말(include)로만 고르고, 「세무사」가 든 제목은 뺀다(운영자 명칭 결정).

// 피드의 Shorts 전부(「세무사」 든 제목은 저장본에도 남기지 않음) — 고르기 전
export function parseShortsEntries(xml) {
  const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
  return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
    const e = m[1];
    const title = unescape(/<title>([\s\S]*?)<\/title>/.exec(e)?.[1] || "").trim();
    const link = /<link rel="alternate" href="([^"]+)"/.exec(e)?.[1] || "";
    const pub = /<published>([^<]+)<\/published>/.exec(e)?.[1] || "";
    const d = new Date(pub);
    return { title, link, date: Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10) };
  }).filter((v) => /^https:\/\/www\.youtube\.com\/shorts\/[\w-]{6,}$/.test(v.link) && v.title && !v.title.includes("세무사"));
}

export function pickShorts(entries, { include = [], count = 6 } = {}) {
  return entries.filter((v) => /^https:\/\/www\.youtube\.com\/shorts\/[\w-]{6,}$/.test(v.link) && v.title && !v.title.includes("세무사") && include.some((w) => v.title.includes(w)))
    .slice(0, count);
}

export function parseShorts(xml, opts) {
  return pickShorts(parseShortsEntries(xml), opts);
}

// 피드 글 그대로(실패하면 null)
export async function readShortsFeed(channelId) {
  // 이 환경처럼 바깥에 못 나가는 곳에서 화면을 확인할 때만: 받아 둔 피드 파일(운영 빌드엔 없음)
  if (process.env.SHORTS_FEED_FILE) return (await import("node:fs")).readFileSync(process.env.SHORTS_FEED_FILE, "utf8");
  // 유튜브 피드는 같은 주소도 404·500을 자주 돌려준다(2026-10-25 실측 — 9번 중 9번 실패한 때도 있음) — 몇 번 더 묻는다
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) return await res.text();
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

// 피드를 못 읽으면(또는 읽었는데 고를 것이 없으면) 마지막으로 읽은 저장본(src/data/shorts-snapshot.json)으로
export async function fetchShorts({ channelId, include, count }, { read = readShortsFeed, saved = null } = {}) {
  const xml = await read(channelId);
  const fresh = xml ? parseShorts(xml, { include, count }) : [];
  if (fresh.length) return fresh;
  return pickShorts(saved?.entries || [], { include, count });
}
