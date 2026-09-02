import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { commandExists, openUrl } from "../platform.ts";
import { USER_AGENT } from "../remote.ts";
import type { McpAdapter } from "../types.ts";

export const github: McpAdapter = {
  id: "github",
  title: "GitHub",
  port: 0,
  url: "",
  requiredEnv: [
    {
      key: "GITHUB_PERSONAL_ACCESS_TOKEN",
      label: "GitHub personal access token (ghp_... veya github_pat_...)",
      secret: true,
      helpUrl: "https://github.com/settings/tokens",
    },
  ],

  async detect() {
    if (await commandExists("docker")) return { ok: true };
    return { ok: false, message: "Docker yok — GitHub MCP için gerekli" };
  },

  async install() {
    openUrl("https://docs.docker.com/get-docker/");
    return { ok: false, message: "Docker kurulmalı: https://docs.docker.com/get-docker/" };
  },

  async validateEnv() {
    const token = getEnv("GITHUB_PERSONAL_ACCESS_TOKEN");
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": USER_AGENT,
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
    const token = getEnv("GITHUB_PERSONAL_ACCESS_TOKEN");
    await startGateway(
      "github",
      "docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server",
      { GITHUB_PERSONAL_ACCESS_TOKEN: token },
      this.port,
    );
  },

  async stop() {
    await stopGateway("github", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
