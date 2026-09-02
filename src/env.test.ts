import assert from "node:assert/strict";
import { test } from "node:test";
import { applyEnvUpdate } from "./env.ts";

test("applyEnvUpdate keeps comments and updates a key", () => {
  const existing = "# Jira\nATLASSIAN_SITE_NAME=old\n\n# Notion\nNOTION_TOKEN=keep\n";
  const next = applyEnvUpdate(existing, "ATLASSIAN_SITE_NAME", "acme");
  assert.equal(next, "# Jira\nATLASSIAN_SITE_NAME=acme\n\n# Notion\nNOTION_TOKEN=keep\n");
});

test("applyEnvUpdate appends missing key", () => {
  const next = applyEnvUpdate("# header\nFOO=1\n", "BAR", "2");
  assert.equal(next, "# header\nFOO=1\nBAR=2\n");
});
