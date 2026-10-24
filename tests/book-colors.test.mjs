// 책 표지색(home.json books color)은 책등·그린 표지에 글자를 얹는다 — 고른 글자색(inkFor)과 4.5:1 이상(2026-10-25 6차, 가업승계 책등 4.4:1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inkFor, contrast } from "../src/lib/shelf.js";

test("책 표지색마다 글자색 대비 4.5:1 이상", () => {
  const home = JSON.parse(readFileSync(new URL("../src/data/home.json", import.meta.url), "utf8"));
  for (const b of home.books) assert.ok(contrast(b.color, inkFor(b.color)) >= 4.5, `${b.title} ${b.color} ${contrast(b.color, inkFor(b.color)).toFixed(2)}`);
});
