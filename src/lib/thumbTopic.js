// 칼럼·책 카드 표지 주제: 글 제목의 낱말로만 고른다(순서대로 먼저 맞는 것). 표지 색·그림만 바꾸고 글 내용은 건드리지 않는다.
export const TOPICS = [
  { id: "audit", label: "세무조사·불복", re: /세무조사|불복|심판|경정청구|가산세|이의신청|소명/ },
  { id: "inherit", label: "상속·증여", re: /상속|증여|유산|유류분|자녀에게|부모님/ },
  { id: "estate", label: "부동산", re: /양도|부동산|주택|아파트|취득세|종부세|종합부동산|재건축|재개발|분양|입주권|임대|토지|전세|오피스텔/ },
  { id: "corp", label: "법인", re: /법인|대표|가수금|배당|주식|퇴직|급여|창업|사업자|가업/ },
  { id: "column", label: "칼럼", re: /칼럼|이코노미조선/ },
];
export const DEFAULT_TOPIC = { id: "tax", label: "세금" };

export function topicOf(title = "") {
  return TOPICS.find((t) => t.re.test(title)) || DEFAULT_TOPIC;
}
