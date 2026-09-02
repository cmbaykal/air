import { getEnv } from "../env.ts";
import { isHealthy } from "../gateway.ts";
import { pollPort } from "../health.ts";
import { startNpx, stopProcess } from "../process.ts";
import type { McpAdapter } from "../types.ts";

export const notion: McpAdapter = {
  id: "notion",
  title: "Notion",
  port: 0,
  url: "",
  requiredEnv: [
    {
      key: "NOTION_TOKEN",
      label: "Notion integration token (ntn_...)",
      secret: true,
      helpUrl: "https://www.notion.so/my-integrations",
    },
  ],

  async validateEnv() {
    const token = getEnv("NOTION_TOKEN");
    try {
      const res = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      });
      if (!res.ok) return { ok: false, message: `Notion doğrulama başarısız (${res.status}). Token'ı kontrol edin.` };
      return { ok: true };
    } catch (error) {
      return { ok: false, message: `Notion'a ulaşılamadı: ${String(error)}` };
    }
  },

  async start() {
    await startNpx(
      "notion",
      [
        "@notionhq/notion-mcp-server",
        "--transport",
        "http",
        "--port",
        String(this.port),
        "--host",
        "127.0.0.1",
        "--unsafe-disable-auth",
      ],
      { NOTION_TOKEN: getEnv("NOTION_TOKEN") },
    );
    if (!(await pollPort(this.port, 30_000))) {
      throw new Error("notion MCP ayağa kalkmadı. .run/notion.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("notion", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
