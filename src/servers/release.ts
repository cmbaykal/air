import fs from "node:fs";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import type { McpAdapter } from "../types.ts";

export const release: McpAdapter = {
  id: "release",
  title: "Mobile Release",
  port: 0,
  url: "",
  requiredEnv: [
    { key: "STOREPILOT_CONFIG_PATH", label: "storepilot.yaml dosya yolu (proje kökü)" },
  ],

  async validateEnv() {
    const config = getEnv("STOREPILOT_CONFIG_PATH");
    if (!config) return { ok: false, message: "storepilot.yaml yolu boş." };
    if (!fs.existsSync(config) || !fs.statSync(config).isFile()) {
      return { ok: false, message: `Dosya yok: ${config}` };
    }
    return { ok: true };
  },

  async start() {
    await startGateway(
      "release",
      "npx -y mobile-release-mcp",
      {
        STOREPILOT_CONFIG_PATH: getEnv("STOREPILOT_CONFIG_PATH"),
        MCP_TOOLSET: "release",
        MCP_TRANSPORT: "stdio",
        APPLE_KEY_ID: getEnv("ASC_KEY_ID"),
        APPLE_ISSUER_ID: getEnv("ASC_ISSUER_ID"),
        APPLE_PRIVATE_KEY_PATH: getEnv("ASC_PRIVATE_KEY_PATH"),
        GOOGLE_SERVICE_ACCOUNT_KEY_PATH: getEnv("GOOGLE_APPLICATION_CREDENTIALS"),
      },
      this.port,
      { timeoutMs: 45_000 },
    );
  },

  async stop() {
    await stopGateway("release", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
