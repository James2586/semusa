import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRss } from "../src/lib/blogFeed.js";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>블로그</title>
<item><title><![CDATA[증여세 신고 기한 &amp; 공제]]></title><description><![CDATA[<p>증여받은 날이 속한 달의 <b>말일</b>부터 3개월 안에 신고합니다.</p>]]></description><link><![CDATA[https://blog.naver.com/semusatax/224000000001?fromRss=true]]></link><pubDate>Thu, 23 Oct 2026 22:30:00 +0900</pubDate></item>
<item><title>바깥 주소 글</title><link>https://evil.example/x</link><pubDate>Wed, 22 Oct 2026 10:00:00 +0900</pubDate></item>
<item><title>두 번째 글</title><link>https://blog.naver.com/semusatax/224000000002</link><pubDate>bad</pubDate></item>
</channel></rss>`;

test("RSS에서 제목·주소·한국 날짜를 뽑고, 네이버 블로그 주소가 아닌 글은 뺀다", () => {
  const p = parseRss(SAMPLE);
  assert.equal(p.length, 2);
  assert.equal(p[0].title, "증여세 신고 기한 & 공제");
  assert.equal(p[0].date, "2026-10-23");
  assert.equal(p[1].date, "");
  assert.equal(p[0].excerpt, "증여받은 날이 속한 달의 말일부터 3개월 안에 신고합니다.");
  assert.equal(p[1].excerpt, "");
});

test("깨진 RSS는 빈 목록", () => {
  assert.deepEqual(parseRss("<html>not rss</html>"), []);
});

const item = (title, desc, n, date = "Thu, 23 Oct 2026 10:00:00 +0900") => `<item><title><![CDATA[${title}]]></title><description><![CDATA[${desc}]]></description><link>https://blog.naver.com/semusatax/22400000000${n}</link><pubDate>${date}</pubDate></item>`;

test("요약에서 주소 글자는 빼고, 같은 글을 두 번 올린 것만 한 번으로", () => {
  const xml = `<rss><channel>
${item("이번 주 칼럼입니다", "https://economychosun.com/a/1.html", 1)}
${item("이번 주 칼럼입니다", "https://economychosun.com/a/1.html", 2)}
${item("이번 주 칼럼입니다", "https://economychosun.com/a/2.html 지난주와 다른 글", 3)}
</channel></rss>`;
  const p = parseRss(xml);
  assert.equal(p.length, 2, "주소까지 같은 두 번째 글만 빠진다");
  assert.equal(p[0].excerpt, "");
  assert.equal(p[1].excerpt, "지난주와 다른 글");
  assert.ok(!("key" in p[0]));
});

test("대표 사진은 네이버 사진 서버(https pstatic.net) 주소만", () => {
  const xml = `<rss><channel>
${item("사진 글", "<img src='https://blogthumb.pstatic.net/abc/photo.jpg?type=s3'> 본문", 1)}
${item("바깥 사진", '<img src="http://evil.example/x.jpg"> 본문', 2)}
${item("사진 없음", "본문만", 3)}
</channel></rss>`;
  assert.deepEqual(parseRss(xml).map((x) => x.image), ["https://blogthumb.pstatic.net/abc/photo.jpg?type=s3", "", ""]);
});
