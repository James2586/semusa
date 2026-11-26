// 이코노미조선 「성광호의 세무 ABC」 새 연재를 press.json에 더한다(2026-11-26) — .github/workflows/press-watch.yml이 매일 돌리고, 손으로도 돌릴 수 있다.
// 더한 것이 없으면 파일을 건드리지 않는다. 검색을 못 읽으면 실패(종료 코드 1)하고 파일은 그대로.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { readSeries, mergePress } from "../src/lib/pressFeed.js";

const FILE = new URL("../src/data/press.json", import.meta.url);
const press = JSON.parse(readFileSync(FILE, "utf8"));
const found = await readSeries();
if (!found) { console.error("이코노미조선 검색을 읽지 못했습니다 — press.json을 그대로 둡니다."); process.exit(1); }
const { press: next, added, linked } = mergePress(press, found);
const lines = [
  ...added.map((a) => `- 연재 <${a.no}> ${a.date} 「${a.title}」 → 주제 ${a.topic}`),
  ...linked.map((l) => `- 지면 <${l.no}>에 온라인 기사 주소를 이음`),
];
if (!lines.length) { console.log(`새 연재 없음(검색 ${found.length}건 확인)`); process.exit(0); }
writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n");
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 이코노미조선 연재 반영\n${lines.join("\n")}\n`);
