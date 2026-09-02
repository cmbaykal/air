import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import type { McpAdapter } from "../types.ts";

function jiraHost(): string {
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
  port: 0,
  url: "",
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
    await startGateway(
      "jira",
      "npx -y @aashari/mcp-server-atlassian-jira",
      {
        ATLASSIAN_SITE_NAME: siteNameForPackage(),
        ATLASSIAN_USER_EMAIL: getEnv("ATLASSIAN_USER_EMAIL"),
        ATLASSIAN_API_TOKEN: getEnv("ATLASSIAN_API_TOKEN"),
      },
      this.port,
    );
  },

  async stop() {
    await stopGateway("jira", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
