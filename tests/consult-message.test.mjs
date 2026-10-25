// 상담 요청 글(2026-10-24 4차 C1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConsultMessage } from "../src/lib/consultMessage.js";

test("고른 것만 줄로 · 기한은 참고용 표시 · 궁금한 점 칸은 늘 마지막", () => {
  const t = buildConsultMessage({ siteName: "하나 더", situation: "가족이 돌아가셨어요", who: "가족 일을 대신 알아봐요", dateLabel: "돌아가신 날", dateText: "2026. 9. 15.",
    deadlineName: "상속세 신고·납부", deadlineText: "2027. 3. 31.(수)", prepared: ["가족관계를 알 수 있는 서류"], notYet: ["재산 목록"], url: "https://semusatax.vercel.app/guide?s=inherit" });
  assert.equal(t.split("\n")[0], "안녕하세요. 하나 더를 보고 문의드립니다.");
  assert.match(t, /· 상황: 가족이 돌아가셨어요 \(가족 일을 대신 알아봐요\)/);
  assert.match(t, /· 돌아가신 날: 2026\. 9\. 15\./);
  assert.match(t, /· 기한: 상속세 신고·납부 — 2027\. 3\. 31\.\(수\)까지 \(홈페이지 계산, 참고용\)/);
  assert.match(t, /· 준비된 것: 가족관계를 알 수 있는 서류\n· 아직 없는 것: 재산 목록\n· 궁금한 점: /);
  assert.match(t, /\(보던 화면: https:\/\/semusatax\.vercel\.app\/guide\?s=inherit\)$/);
});
test("비어 있는 것은 줄을 만들지 않는다 · 기한은 날짜가 있을 때만", () => {
  const t = buildConsultMessage({ siteName: "하나 더", situation: "집을 여러 채 가지고 있어요", deadlineName: "종합부동산세" });
  assert.doesNotMatch(t, /기한:|준비된 것|아직 없는 것|보던 화면/);
  assert.match(t, /· 궁금한 점: $/);
});

test("참고 줄(해외 기한 까닭 등)은 자료 글 그대로 · 준비 줄 앞에", () => {
  const t = buildConsultMessage({ situation: "상속", deadlineName: "상속세 신고·납부", deadlineText: "2027. 6. 30.(수)", notes: ["돌아가신 분이나 상속인이 외국에 주소를 둠"], prepared: ["재산 목록"] });
  assert.match(t, /· 기한: [^\n]+\n· 참고: 돌아가신 분이나 상속인이 외국에 주소를 둠\n· 준비된 것: 재산 목록/);
});
