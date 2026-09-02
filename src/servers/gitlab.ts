import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import type { McpAdapter } from "../types.ts";

function apiUrl(): string {
  let raw = getEnv("GITLAB_API_URL").trim() || "https://gitlab.com";
  raw = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    const base = `${u.protocol}//${u.host}`;
    if (u.pathname.includes("/api/v4")) return `${base}${u.pathname.replace(/\/+$/, "")}`;
    return `${base}/api/v4`;
  } catch {
    return "https://gitlab.com/api/v4";
  }
}

export const gitlab: McpAdapter = {
  id: "gitlab",
  title: "GitLab",
  port: 0,
  url: "",
  requiredEnv: [
    {
      key: "GITLAB_API_URL",
      label: "GitLab adresi (ör. https://gitlab.com veya self-hosted)",
    },
    {
      key: "GITLAB_PERSONAL_ACCESS_TOKEN",
      label: "GitLab personal access token",
      secret: true,
      helpUrl: "https://gitlab.com/-/user_settings/personal_access_tokens",
    },
  ],

  async validateEnv() {
    const token = getEnv("GITLAB_PERSONAL_ACCESS_TOKEN");
    const base = apiUrl();
    try {
      const res = await fetch(`${base}/user`, {
        headers: { "PRIVATE-TOKEN": token },
      });
      if (res.ok) return { ok: true };
      const hint =
        res.status === 401 || res.status === 403
          ? "Token hatalı veya yetkisiz."
          : "Adres veya token kontrol edin. Self-hosted için tam GitLab URL girin.";
      return { ok: false, message: `GitLab doğrulama başarısız (${res.status}) ${base}/user\n${hint}` };
    } catch (error) {
      return { ok: false, message: `GitLab'a ulaşılamadı (${base}): ${String(error)}` };
    }
  },

  async start() {
    await startGateway(
      "gitlab",
      "npx -y @zereight/mcp-gitlab",
      {
        GITLAB_PERSONAL_ACCESS_TOKEN: getEnv("GITLAB_PERSONAL_ACCESS_TOKEN"),
        GITLAB_API_URL: apiUrl(),
      },
      this.port,
    );
  },

  async stop() {
    await stopGateway("gitlab", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
