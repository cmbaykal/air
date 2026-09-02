import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import type { McpAdapter } from "../types.ts";

function cfHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export const cloudflare: McpAdapter = {
  id: "cloudflare",
  title: "Cloudflare",
  port: 0,
  url: "",
  requiredEnv: [
    {
      key: "CLOUDFLARE_API_TOKEN",
      label: "Cloudflare API token",
      secret: true,
      helpUrl: "https://dash.cloudflare.com/profile/api-tokens",
    },
    {
      key: "CLOUDFLARE_ACCOUNT_ID",
      label: "Cloudflare Account ID (Workers/R2 için)",
    },
  ],

  async validateEnv() {
    const token = getEnv("CLOUDFLARE_API_TOKEN");
    const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
    try {
      const verify = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        headers: cfHeaders(token),
      });
      if (!verify.ok) {
        const hint = verify.status === 401 || verify.status === 403 ? "Token hatalı veya yetkisiz." : "Token kontrol edin.";
        return { ok: false, message: `Cloudflare doğrulama başarısız (${verify.status}). ${hint}` };
      }
      const accounts = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", {
        headers: cfHeaders(token),
      });
      if (!accounts.ok) return { ok: true };
      const body = (await accounts.json()) as { result?: { id: string }[] };
      const ids = (body.result ?? []).map((a) => a.id);
      if (ids.length && !ids.includes(accountId)) {
        return {
          ok: false,
          message: `Account ID bu token ile eşleşmedi. Örnek id: ${ids.slice(0, 3).join(", ")}`,
        };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, message: `Cloudflare'a ulaşılamadı: ${String(error)}` };
    }
  },

  async start() {
    await startGateway(
      "cloudflare",
      "npx -y mcp-server-cloudflare",
      {
        CLOUDFLARE_API_TOKEN: getEnv("CLOUDFLARE_API_TOKEN"),
        CLOUDFLARE_ACCOUNT_ID: getEnv("CLOUDFLARE_ACCOUNT_ID"),
      },
      this.port,
    );
  },

  async stop() {
    await stopGateway("cloudflare", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
