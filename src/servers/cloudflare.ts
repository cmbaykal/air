import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { startNpx, stopProcess } from "../process.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3108;

function cfHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export const cloudflare: McpAdapter = {
  id: "cloudflare",
  title: "Cloudflare",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
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

  async detect() {
    return { ok: true, message: "Local Cloudflare MCP (API token)" };
  },

  async install() {
    return { ok: true };
  },

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
    await startNpx(
      "cloudflare",
      [
        "supergateway",
        "--stdio",
        "npx -y mcp-server-cloudflare",
        "--port",
        String(this.port),
        "--host",
        "127.0.0.1",
        "--outputTransport",
        "streamableHttp",
      ],
      {
        CLOUDFLARE_API_TOKEN: getEnv("CLOUDFLARE_API_TOKEN"),
        CLOUDFLARE_ACCOUNT_ID: getEnv("CLOUDFLARE_ACCOUNT_ID"),
      },
    );
    if (!(await pollPort(this.port, 30_000))) {
      throw new Error("Cloudflare MCP ayağa kalkmadı. .run/cloudflare.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("cloudflare", this.port);
  },

  async health() {
    return pollPort(this.port, 500, 100);
  },
};
