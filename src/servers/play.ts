import fs from "node:fs";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { detectUvx, ensureUvx } from "../uvx.ts";
import type { McpAdapter } from "../types.ts";

export const play: McpAdapter = {
  id: "play",
  title: "Google Play",
  port: 0,
  url: "",
  requiredEnv: [
    {
      key: "GOOGLE_APPLICATION_CREDENTIALS",
      label: "Play service account JSON yolu",
      helpUrl: "https://play.google.com/console/developers",
    },
  ],

  async detect() {
    return detectUvx("Play MCP");
  },

  async install() {
    return ensureUvx();
  },

  async validateEnv() {
    const keyPath = getEnv("GOOGLE_APPLICATION_CREDENTIALS");
    if (!keyPath) return { ok: false, message: "Service account JSON yolu boş." };
    if (!fs.existsSync(keyPath) || !fs.statSync(keyPath).isFile()) {
      return { ok: false, message: `JSON dosyası yok: ${keyPath}` };
    }
    return { ok: true };
  },

  async start() {
    await startGateway(
      "play",
      "uvx google-play-mcp",
      { GOOGLE_APPLICATION_CREDENTIALS: getEnv("GOOGLE_APPLICATION_CREDENTIALS") },
      this.port,
      { timeoutMs: 45_000 },
    );
  },

  async stop() {
    await stopGateway("play", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
