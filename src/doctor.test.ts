import assert from "node:assert/strict";
import { test } from "node:test";
import { envConfigured, missingEnvKeys, nodeOk } from "./doctor.ts";
import type { McpAdapter } from "./types.ts";

const TEST_KEY = "AIR_TEST_DOCTOR_ENV";

function stub(keys: string[]): McpAdapter {
  return {
    id: "t",
    title: "T",
    port: 1,
    url: "",
    requiredEnv: keys.map((key) => ({ key, label: key })),
    async start() {},
    async stop() {},
    async health() {
      return false;
    },
  };
}

test("nodeOk accepts current runtime", () => {
  const result = nodeOk();
  assert.equal(result.ok, Number(process.versions.node.split(".")[0]) >= 20);
});

test("missingEnvKeys and envConfigured follow process.env", () => {
  const adapter = stub([TEST_KEY]);
  const previous = process.env[TEST_KEY];
  try {
    delete process.env[TEST_KEY];
    assert.deepEqual(missingEnvKeys(adapter), [TEST_KEY]);
    assert.equal(envConfigured(adapter), false);
    process.env[TEST_KEY] = "set";
    assert.deepEqual(missingEnvKeys(adapter), []);
    assert.equal(envConfigured(adapter), true);
  } finally {
    if (previous === undefined) delete process.env[TEST_KEY];
    else process.env[TEST_KEY] = previous;
  }
});
