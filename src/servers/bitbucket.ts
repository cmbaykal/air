import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import type { McpAdapter } from "../types.ts";

function authHeader(): string {
  const email = getEnv("BITBUCKET_EMAIL");
  const token = getEnv("BITBUCKET_API_TOKEN");
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

export const bitbucket: McpAdapter = {
  id: "bitbucket",
  title: "Bitbucket",
  port: 0,
  url: "",
  requiredEnv: [
    { key: "BITBUCKET_EMAIL", label: "Bitbucket / Atlassian e-posta" },
    {
      key: "BITBUCKET_API_TOKEN",
      label: "Bitbucket API token",
      secret: true,
      helpUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    },
  ],

  async validateEnv() {
    const token = getEnv("BITBUCKET_API_TOKEN");
    const email = getEnv("BITBUCKET_EMAIL");
    if (!token || !email) return { ok: false, message: "E-posta veya token boş." };
    try {
      const res = await fetch("https://api.bitbucket.org/2.0/user", {
        headers: { Authorization: authHeader(), Accept: "application/json" },
      });
      if (res.ok) return { ok: true };
      const hint =
        res.status === 401 || res.status === 403
          ? "E-posta veya API token hatalı."
          : "Token ve e-postayı kontrol edin.";
      return { ok: false, message: `Bitbucket doğrulama başarısız (${res.status}). ${hint}` };
    } catch (error) {
      return { ok: false, message: `Bitbucket'a ulaşılamadı: ${String(error)}` };
    }
  },

  async start() {
    await startGateway(
      "bitbucket",
      "npx -y @tugudush/bitbucket-mcp",
      {
        BITBUCKET_API_TOKEN: getEnv("BITBUCKET_API_TOKEN"),
        BITBUCKET_EMAIL: getEnv("BITBUCKET_EMAIL"),
      },
      this.port,
    );
  },

  async stop() {
    await stopGateway("bitbucket", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
