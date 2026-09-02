import fs from "node:fs";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { commandExists, isMac, openUrl } from "../platform.ts";
import type { McpAdapter } from "../types.ts";

export const xcode: McpAdapter = {
  id: "xcode",
  title: "Xcode",
  port: 0,
  url: "",
  requiredEnv: [],

  async detect() {
    if (!isMac) return { ok: false, message: "Xcode MCP yalnızca macOS'ta çalışır" };
    if ((await commandExists("xcodebuild")) || fs.existsSync("/Applications/Xcode.app")) {
      return { ok: true, message: "Xcode + simülatör" };
    }
    return { ok: false, message: "Xcode yüklü değil" };
  },

  async install() {
    if (!isMac) return { ok: false, message: "Xcode MCP yalnızca macOS'ta çalışır" };
    openUrl("https://apps.apple.com/app/xcode/id497799835");
    return { ok: false, message: "Xcode App Store'dan kurulmalı. Kurunca tekrar: air setup" };
  },

  async start() {
    if (!isMac) throw new Error("Xcode MCP yalnızca macOS'ta çalışır.");
    await startGateway("xcode", "npx -y xcodebuildmcp@latest mcp", {}, this.port, { timeoutMs: 45_000 });
  },

  async stop() {
    await stopGateway("xcode", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
