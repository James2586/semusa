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
