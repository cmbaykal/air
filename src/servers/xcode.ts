import fs from "node:fs";
import { pollPort } from "../health.ts";
import { commandExists, isMac, openUrl } from "../platform.ts";
import { startNpx, stopProcess } from "../process.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3109;

export const xcode: McpAdapter = {
  id: "xcode",
  title: "Xcode",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [],

  async detect() {
    if (!isMac) return { ok: false, message: "Xcode MCP yalnızca macOS'ta çalışır" };
    if (await commandExists("xcodebuild") || fs.existsSync("/Applications/Xcode.app")) {
      return { ok: true, message: "Local XcodeBuildMCP (Xcode + simülatör)" };
    }
    return { ok: false, message: "Xcode yüklü değil" };
  },

  async install() {
    if (!isMac) return { ok: false, message: "Xcode MCP yalnızca macOS'ta çalışır" };
    openUrl("https://apps.apple.com/app/xcode/id497799835");
    return { ok: false, message: "Xcode App Store'dan kurulmalı. Kurunca tekrar: npx air setup" };
  },

  async start() {
    if (!isMac) throw new Error("Xcode MCP yalnızca macOS'ta çalışır.");
    await startNpx("xcode", [
      "supergateway",
      "--stdio",
      "npx -y xcodebuildmcp@latest mcp",
      "--port",
      String(PORT),
      "--host",
      "127.0.0.1",
      "--outputTransport",
      "streamableHttp",
    ]);
    if (!(await pollPort(PORT, 45_000))) {
      throw new Error("Xcode MCP ayağa kalkmadı. .run/xcode.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("xcode", PORT);
  },

  async health() {
    return pollPort(PORT, 500, 100);
  },
};
