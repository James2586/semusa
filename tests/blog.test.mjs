import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRss } from "../src/lib/blogFeed.js";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>블로그</title>
<item><title><![CDATA[증여세 신고 기한 &amp; 공제]]></title><link><![CDATA[https://blog.naver.com/semusatax/224000000001?fromRss=true]]></link><pubDate>Thu, 23 Oct 2026 22:30:00 +0900</pubDate></item>
<item><title>바깥 주소 글</title><link>https://evil.example/x</link><pubDate>Wed, 22 Oct 2026 10:00:00 +0900</pubDate></item>
<item><title>두 번째 글</title><link>https://blog.naver.com/semusatax/224000000002</link><pubDate>bad</pubDate></item>
</channel></rss>`;

test("RSS에서 제목·주소·한국 날짜를 뽑고, 네이버 블로그 주소가 아닌 글은 뺀다", () => {
  const p = parseRss(SAMPLE);
  assert.equal(p.length, 2);
  assert.equal(p[0].title, "증여세 신고 기한 & 공제");
  assert.equal(p[0].date, "2026-10-23");
  assert.equal(p[1].date, "");
});

test("깨진 RSS는 빈 목록", () => {
  assert.deepEqual(parseRss("<html>not rss</html>"), []);
});
