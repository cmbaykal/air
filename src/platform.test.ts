import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSpawnTarget } from "./platform.ts";

test("resolveSpawnTarget keeps argv on non-Windows", () => {
  assert.deepEqual(resolveSpawnTarget("npx", ["-y", "supergateway"], false), {
    command: "npx",
    args: ["-y", "supergateway"],
  });
});

test("resolveSpawnTarget uses cmd.exe without shell:true on Windows", () => {
  const target = resolveSpawnTarget("npx.cmd", ["-y", "supergateway", "--stdio", "npx -y pkg C:\\vault"], true);
  assert.match(target.command, /cmd\.exe$/i);
  assert.equal(target.args[0], "/d");
  assert.equal(target.args[1], "/s");
  assert.equal(target.args[2], "/c");
  assert.equal(target.args[3], "npx.cmd");
  assert.deepEqual(target.args.slice(4), ["-y", "supergateway", "--stdio", "npx -y pkg C:\\vault"]);
});
