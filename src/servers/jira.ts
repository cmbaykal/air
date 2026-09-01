import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { startNpx, stopProcess } from "../process.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3101;

export function jiraHost(): string {
  let raw = getEnv("ATLASSIAN_SITE_NAME").trim();
  if (!raw) return "";
  raw = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    return new URL(raw).hostname;
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  }
}

function siteUrl(): string {
  const host = jiraHost();
  if (!host) return "";
  if (host.includes(".")) return `https://${host}`;
  return `https://${host}.atlassian.net`;
}

function siteNameForPackage(): string {
  return jiraHost().replace(/\.atlassian\.net$/i, "");
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
    const base = siteUrl();
    if (!base) return { ok: false, message: "Jira site boş." };
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };
    const paths = ["/rest/api/3/myself", "/rest/api/2/myself"];
    try {
      for (const path of paths) {
        const url = `${base}${path}`;
        const res = await fetch(url, { headers });
        if (res.ok) return { ok: true };
        if (res.status !== 404) {
          const hint =
            res.status === 401 || res.status === 403
              ? "E-posta veya API token hatalı."
              : "Token/site/e-posta kontrol edin.";
          return { ok: false, message: `Jira doğrulama başarısız (${res.status}) ${url}\n${hint}` };
        }
      }
      return {
        ok: false,
        message:
          `Jira doğrulama başarısız (404) ${base}\n` +
          "Site adını yalnızca şunun gibi girin: sirket veya sirket.atlassian.net",
      };
    } catch (error) {
      return { ok: false, message: `Jira'ya ulaşılamadı (${base}): ${String(error)}` };
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
        String(this.port),
        "--host",
        "127.0.0.1",
        "--outputTransport",
        "streamableHttp",
      ],
      {
        ATLASSIAN_SITE_NAME: siteNameForPackage(),
        ATLASSIAN_USER_EMAIL: getEnv("ATLASSIAN_USER_EMAIL"),
        ATLASSIAN_API_TOKEN: getEnv("ATLASSIAN_API_TOKEN"),
      },
    );
    if (!(await pollPort(this.port, 30_000))) {
      throw new Error("Jira MCP ayağa kalkmadı. .run/jira.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("jira", this.port);
  },

  async health() {
    return pollPort(this.port, 500, 100);
  },
};
