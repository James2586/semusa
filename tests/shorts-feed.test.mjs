// 첫 화면 「부기와 1분 세금」 목록 고르기(2026-10-25 6차 C)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShorts } from "../src/lib/shortsFeed.js";

const entry = (title, href, pub = "2026-10-24T01:00:00+00:00") => `<entry><title>${title}</title><link rel="alternate" href="${href}"/><published>${pub}</published></entry>`;

test("Shorts만 · 세금 낱말이 든 제목만 · 「세무사」 든 제목은 빼고 · 제목 그대로 · 한국 날짜", () => {
  const xml = `<feed>${[
    entry("세무사가 알려 주는 증여", "https://www.youtube.com/shorts/abcdefg"),
    entry("증여세 &amp; 상속", "https://www.youtube.com/shorts/hijklmn", "2026-10-24T20:00:00+00:00"),
    entry("토요일 와인 한잔", "https://www.youtube.com/shorts/opqrstu"),
    entry("증여 긴 영상", "https://www.youtube.com/watch?v=vwxyz12"),
    entry("주택정책 수단 세 가지", "https://www.youtube.com/shorts/aaaaaaa"),
  ].join("")}</feed>`;
  assert.deepEqual(parseShorts(xml, { include: ["증여", "상속"], count: 6 }), [{ title: "증여세 & 상속", link: "https://www.youtube.com/shorts/hijklmn", date: "2026-10-25" }]);
});

test("count개까지, 읽을 것이 없으면 빈 목록", () => {
  const xml = `<feed>${Array.from({ length: 9 }, (_, i) => entry(`상속 ${i}`, `https://www.youtube.com/shorts/id${i}xxxx`)).join("")}</feed>`;
  assert.equal(parseShorts(xml, { include: ["상속"], count: 6 }).length, 6);
  assert.deepEqual(parseShorts("", { include: ["상속"] }), []);
});

test("피드를 못 읽으면 저장본에서 같은 규칙으로 고른다 — 읽으면 새 목록", async () => {
  const { fetchShorts } = await import("../src/lib/shortsFeed.js");
  const saved = { entries: [
    { title: "증여 저장본", link: "https://www.youtube.com/shorts/savedaa", date: "2026-10-24" },
    { title: "토요일 와인", link: "https://www.youtube.com/shorts/savedbb", date: "2026-10-23" },
  ] };
  const cfg = { channelId: "x", include: ["증여"], count: 6 };
  assert.deepEqual(await fetchShorts(cfg, { read: async () => null, saved }), [saved.entries[0]]);
  const xml = `<feed>${entry("증여 새 영상", "https://www.youtube.com/shorts/freshaa")}</feed>`;
  assert.equal((await fetchShorts(cfg, { read: async () => xml, saved }))[0].title, "증여 새 영상");
  assert.deepEqual(await fetchShorts(cfg, { read: async () => null }), []);
});

test("저장본 파일: 「세무사」 든 제목 없음 · Shorts 주소만 · 지금 설정으로 고를 것이 있음", async () => {
  const { readFileSync } = await import("node:fs");
  const { pickShorts } = await import("../src/lib/shortsFeed.js");
  const snap = JSON.parse(readFileSync(new URL("../src/data/shorts-snapshot.json", import.meta.url), "utf8"));
  const cfg = JSON.parse(readFileSync(new URL("../src/data/shorts.json", import.meta.url), "utf8"));
  assert.ok(snap.entries.length > 0);
  for (const v of snap.entries) {
    assert.ok(!v.title.includes("세무사"), v.title);
    assert.match(v.link, /^https:\/\/www\.youtube\.com\/shorts\/[\w-]{6,}$/);
  }
  assert.ok(pickShorts(snap.entries, cfg).length >= 4);
});
