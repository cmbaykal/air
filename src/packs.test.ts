import assert from "node:assert/strict";
import { test } from "node:test";
import { getPack, loadPacks } from "./packs.ts";

test("mobile pack is defined with compose and ios skills", () => {
  const pack = getPack("mobile");
  assert.ok(pack);
  assert.equal(pack?.id, "mobile");
  assert.ok((pack?.skills.length ?? 0) >= 3);
  assert.ok(pack?.skills.some((s) => s.url.includes("compose-skill")));
  assert.ok(pack?.skills.some((s) => s.name === "ios-agent-skills"));
  assert.ok(loadPacks().some((p) => p.id === "mobile"));
});
