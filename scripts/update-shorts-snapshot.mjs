// 「부기와 1분 세금」 저장본 만들기 — 유튜브 피드를 읽을 수 있을 때 돌린다(2026-10-25).
// 빌드가 피드를 못 읽으면 이 저장본을 쓴다. 손으로 고치지 말 것. 받아 둔 피드로: SHORTS_FEED_FILE=파일 node scripts/update-shorts-snapshot.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { readShortsFeed, parseShortsEntries } from "../src/lib/shortsFeed.js";

const cfg = JSON.parse(readFileSync(new URL("../src/data/shorts.json", import.meta.url), "utf8"));
const xml = await readShortsFeed(cfg.channelId);
if (!xml) { console.error("유튜브 피드를 읽지 못했습니다 — 저장본을 그대로 둡니다."); process.exit(1); }
const entries = parseShortsEntries(xml);
if (!entries.length) { console.error("피드에 Shorts가 없습니다 — 저장본을 그대로 둡니다."); process.exit(1); }
const feedUpdated = /<feed[\s\S]*?<published>([^<]+)<\/published>/.exec(xml)?.[1] || "";
const out = {
  _note: "「부기와 1분 세금」 저장본 — 빌드 때 유튜브 피드를 못 읽으면 이것을 쓴다. scripts/update-shorts-snapshot.mjs로만 만든다(손으로 고치지 말 것). entries는 피드의 Shorts 전부(「세무사」 든 제목 제외) — 세금 주제 고르기는 빌드 때 shorts.json include로.",
  savedAt: new Date().toISOString().slice(0, 10),
  latest: entries[0]?.date || feedUpdated.slice(0, 10),
  entries,
};
writeFileSync(new URL("../src/data/shorts-snapshot.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`저장본 ${entries.length}개(가장 최근 ${out.latest})`);
