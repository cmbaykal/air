import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { startNpx, stopProcess } from "../process.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3101;

function siteUrl(): string {
  const site = getEnv("ATLASSIAN_SITE_NAME").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (site.includes(".")) return `https://${site}`;
  return `https://${site}.atlassian.net`;
}

export const jira: McpAdapter = {
  id: "jira",
  title: "Jira",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [
    { key: "ATLASSIAN_SITE_NAME", label: "Jira site (ör. sirket veya sirket.atlassian.net)" },
    { key: "ATLASSIAN_USER_EMAIL", label: "Atlassian e-posta" },
    {
      key: "ATLASSIAN_API_TOKEN",
      label: "Jira API token",
      secret: true,
      helpUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    },
  ],

  async detect() {
    return { ok: true, message: "Local Jira MCP (API token)" };
  },

  async install() {
    return { ok: true };
  },

  async validateEnv() {
    const email = getEnv("ATLASSIAN_USER_EMAIL");
    const token = getEnv("ATLASSIAN_API_TOKEN");
    const url = `${siteUrl()}/rest/api/3/myself`;
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
      if (!res.ok) return { ok: false, message: `Jira doğrulama başarısız (${res.status}). Token/site/e-posta kontrol edin.` };
      return { ok: true };
    } catch (error) {
      return { ok: false, message: `Jira'ya ulaşılamadı: ${String(error)}` };
    }
  },

  async start() {
    await startNpx(
      "jira",
      [
        "supergateway",
        "--stdio",
        "npx -y @aashari/mcp-server-atlassian-jira",
        "--port",
        String(PORT),
        "--host",
        "127.0.0.1",
        "--outputTransport",
        "streamableHttp",
      ],
      {
        ATLASSIAN_SITE_NAME: getEnv("ATLASSIAN_SITE_NAME"),
        ATLASSIAN_USER_EMAIL: getEnv("ATLASSIAN_USER_EMAIL"),
        ATLASSIAN_API_TOKEN: getEnv("ATLASSIAN_API_TOKEN"),
      },
    );
    if (!(await pollPort(PORT, 30_000))) {
      throw new Error("Jira MCP ayağa kalkmadı. .run/jira.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("jira");
  },

  async health() {
    return pollPort(PORT, 500, 100);
  },
};
