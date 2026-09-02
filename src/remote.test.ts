import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify, toRawUrl } from "./remote.ts";

test("slugify lowercases and trims", () => {
  assert.equal(slugify(" Hello World "), "hello-world");
});

test("toRawUrl converts github blob links", () => {
  assert.equal(
    toRawUrl("https://github.com/org/repo/blob/main/SKILL.md"),
    "https://raw.githubusercontent.com/org/repo/main/SKILL.md",
  );
});

test("toRawUrl leaves raw urls", () => {
  const url = "https://raw.githubusercontent.com/org/repo/main/SKILL.md";
  assert.equal(toRawUrl(url), url);
});
