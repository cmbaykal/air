import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";
import { isHealthy } from "./gateway.ts";
import { applyListenPort } from "./ports.ts";
import type { McpAdapter } from "./types.ts";

test("isHealthy is true when the port accepts a connection", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    assert.equal(await isHealthy(port), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("applyListenPort sets localhost mcp url", () => {
  const adapter = { port: 0, url: "" } as McpAdapter;
  applyListenPort(adapter, 3101);
  assert.equal(adapter.port, 3101);
  assert.equal(adapter.url, "http://127.0.0.1:3101/mcp");
});
