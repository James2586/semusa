import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAll, checkCalculators, checkBannedWords, parseJsonFile } from "../scripts/validate-data.mjs";

test("저장소의 자료 파일은 검사를 통과한다", () => {
  assert.deepEqual(validateAll(), []);
});

test("JSON이 깨지면 줄 번호를 알려 준다", () => {
  const { error } = parseJsonFile("calculators.json", '{\n  "groups": [\n    { "id": "a", }\n  ]\n}');
  assert.match(error, /calculators\.json 3번째 줄 근처/);
});

test("계산기 칸이 비거나 slug가 겹치면 알려 준다", () => {
  const text = JSON.stringify({
    groups: [{ id: "g", name: "묶음" }],
    calculators: [
      { slug: "a", group: "g", name: "A", short: "a", url: "https://a.example" },
      { slug: "a", group: "x", name: "", short: "b", url: "http://b.example" },
    ],
  }, null, 2);
  const errs = checkCalculators(text).join("\n");
  assert.match(errs, /name가 비었습니다/);
  assert.match(errs, /slug "a"가 두 번/);
  assert.match(errs, /group "x"는 groups에 없습니다/);
  assert.match(errs, /https:\/\/로 시작/);
});

test('"세무사" 명칭을 막는다 (운영자 결정 2026-10-24)', () => {
  assert.equal(checkBannedWords("x", "세무전문가 성광호").length, 0);
  assert.equal(checkBannedWords("x", "전담 세무사").length, 1);
});

test("직접 만든 도구(tools.json): 글은 운영자 영상 글 줄 그대로만", async () => {
  const { checkTools } = await import("../scripts/validate-data.mjs");
  const { readFileSync } = await import("node:fs");
  const videos = readFileSync(new URL("../src/data/videos.json", import.meta.url), "utf8");
  const tools = JSON.parse(readFileSync(new URL("../src/data/tools.json", import.meta.url), "utf8"));
  assert.deepEqual(checkTools(JSON.stringify(tools), videos), []);
  const made = structuredClone(tools);
  made.taxSearch.features.push("세금을 30% 줄여 준다");
  assert.equal(checkTools(JSON.stringify(made), videos).length, 1);
  const p = structuredClone(tools);
  p.principles[0] = "원칙 1 · AI는 숫자를 만들지 않습니다";
  assert.equal(checkTools(JSON.stringify(p), videos).length, 1);
});

test("불복 절차 표(appeal.json): 숫자는 고른 원문에만 — 지어 쓴 숫자는 막힌다", async () => {
  const { checkAppeal } = await import("../scripts/validate-data.mjs");
  const { readFileSync } = await import("node:fs");
  const src = JSON.parse(readFileSync(new URL("../docs/faq-sources.json", import.meta.url), "utf8")).items;
  const A = JSON.parse(readFileSync(new URL("../src/data/appeal.json", import.meta.url), "utf8"));
  assert.deepEqual(checkAppeal(JSON.stringify(A), src), []);
  const bad = structuredClone(A); bad.rows[0].decide = "청구를 받은 날부터 45일 이내";
  assert.equal(checkAppeal(JSON.stringify(bad), src).length, 1);
  const bad2 = structuredClone(A); bad2.flow[0].say = "통지 뒤 7일 안에 준비하세요";
  assert.equal(checkAppeal(JSON.stringify(bad2), src).length, 1);
  const bad3 = structuredClone(A); bad3.flow[1].edge = "통지 받은 날부터 60일 이내";
  assert.equal(checkAppeal(JSON.stringify(bad3), src).length, 1);
});
