import fs from "node:fs";
import path from "node:path";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { detectUvx, ensureUvx } from "../uvx.ts";
import type { McpAdapter } from "../types.ts";

export const sqlite: McpAdapter = {
  id: "sqlite",
  title: "SQLite",
  port: 0,
  url: "",
  requiredEnv: [{ key: "SQLITE_DB_PATH", label: "SQLite .db dosya yolu" }],

  async detect() {
    return detectUvx("SQLite MCP");
  },

  async install() {
    return ensureUvx();
  },

  async validateEnv() {
    const db = getEnv("SQLITE_DB_PATH");
    if (!db) return { ok: false, message: "DB yolu boş." };
    const parent = path.dirname(db);
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
      return { ok: false, message: `Üst klasör yok: ${parent}` };
    }
    return { ok: true };
  },

  async start() {
    const db = getEnv("SQLITE_DB_PATH");
    await startGateway(
      "sqlite",
      `uvx mcp-server-sqlite --db-path ${JSON.stringify(db)}`,
      {},
      this.port,
      { timeoutMs: 45_000 },
    );
  },

  async stop() {
    await stopGateway("sqlite", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
