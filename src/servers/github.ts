import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { startNpx, stopProcess } from "../process.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3104;

export const github: McpAdapter = {
  id: "github",
  title: "GitHub",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [
    {
      key: "GITHUB_PERSONAL_ACCESS_TOKEN",
      label: "GitHub personal access token (ghp_... veya github_pat_...)",
      secret: true,
      helpUrl: "https://github.com/settings/tokens",
    },
  ],

  async detect() {
    return { ok: true, message: "Local GitHub MCP (PAT)" };
  },

  async install() {
    return { ok: true };
  },

  async validateEnv() {
    const token = getEnv("GITHUB_PERSONAL_ACCESS_TOKEN");
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "air-mcp",
        },
      });
      if (res.ok) return { ok: true };
      const hint = res.status === 401 || res.status === 403 ? "Token hatalı veya yetkisiz." : "Token kontrol edin.";
      return { ok: false, message: `GitHub doğrulama başarısız (${res.status}). ${hint}` };
    } catch (error) {
      return { ok: false, message: `GitHub'a ulaşılamadı: ${String(error)}` };
    }
  },

  async start() {
    await startNpx(
      "github",
      [
        "supergateway",
        "--stdio",
        "npx -y @modelcontextprotocol/server-github",
        "--port",
        String(PORT),
        "--host",
        "127.0.0.1",
        "--outputTransport",
        "streamableHttp",
      ],
      { GITHUB_PERSONAL_ACCESS_TOKEN: getEnv("GITHUB_PERSONAL_ACCESS_TOKEN") },
    );
    if (!(await pollPort(PORT, 30_000))) {
      throw new Error("GitHub MCP ayağa kalkmadı. .run/github.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("github", PORT);
  },

  async health() {
    return pollPort(PORT, 500, 100);
  },
};
