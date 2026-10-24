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
