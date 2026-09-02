import fs from "node:fs";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import type { McpAdapter } from "../types.ts";

export const asc: McpAdapter = {
  id: "asc",
  title: "App Store Connect",
  port: 0,
  url: "",
  requiredEnv: [
    { key: "ASC_KEY_ID", label: "App Store Connect Key ID (10 karakter)" },
    { key: "ASC_ISSUER_ID", label: "App Store Connect Issuer ID (UUID)" },
    {
      key: "ASC_PRIVATE_KEY_PATH",
      label: "App Store Connect .p8 dosya yolu",
      helpUrl: "https://appstoreconnect.apple.com/access/integrations/api",
    },
  ],

  async validateEnv() {
    const keyPath = getEnv("ASC_PRIVATE_KEY_PATH");
    if (!keyPath) return { ok: false, message: ".p8 yolu boş." };
    if (!fs.existsSync(keyPath) || !fs.statSync(keyPath).isFile()) {
      return { ok: false, message: `.p8 dosyası yok: ${keyPath}` };
    }
    if (!getEnv("ASC_KEY_ID") || !getEnv("ASC_ISSUER_ID")) {
      return { ok: false, message: "Key ID veya Issuer ID boş." };
    }
    return { ok: true };
  },

  async start() {
    await startGateway(
      "asc",
      "npx -y appstore-api-mcp",
      {
        ASC_KEY_ID: getEnv("ASC_KEY_ID"),
        ASC_ISSUER_ID: getEnv("ASC_ISSUER_ID"),
        ASC_PRIVATE_KEY_PATH: getEnv("ASC_PRIVATE_KEY_PATH"),
      },
      this.port,
      { timeoutMs: 45_000 },
    );
  },

  async stop() {
    await stopGateway("asc", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
