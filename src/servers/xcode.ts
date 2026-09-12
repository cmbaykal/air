import fs from "node:fs";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { ensureHomebrew, formatBrewCommand } from "../install.ts";
import { brewExecutable, commandExists, isMac, runInteractive } from "../platform.ts";
import { confirm } from "../prompt.ts";
import type { McpAdapter } from "../types.ts";

const XCODE_MAS_ID = "497799835";

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
    console.log("Xcode App Store uygulamasıdır. Homebrew ile mas (Mac App Store CLI) üzerinden kurulur.");
    if (!(await confirm("Xcode yüklü değil. Homebrew (mas) ile kurayım mı?", true))) {
      console.log("Manuel kurulum:");
      console.log(`  ${formatBrewCommand(["install", "mas"])}`);
      console.log(`  mas install ${XCODE_MAS_ID}`);
      return { ok: false, message: "Xcode kurulmadı" };
    }
    if (!(await commandExists("mas"))) {
      if (!(await ensureHomebrew(true))) {
        return { ok: false, message: "Homebrew yok; Xcode kurulmadı" };
      }
      console.log("mas Homebrew ile kuruluyor...");
      const brewBin = brewExecutable() ?? "brew";
      const masCode = await runInteractive(brewBin, ["install", "mas"]);
      if (masCode !== 0 && !(await commandExists("mas"))) {
        return { ok: false, message: "mas kurulmadı. App Store'da oturum açıp Xcode'u yükleyin." };
      }
    }
    console.log("Xcode App Store'dan indiriliyor (uzun sürebilir)...");
    const code = await runInteractive("mas", ["install", XCODE_MAS_ID]);
    if (code !== 0) {
      console.log("mas ile kurulum olmadı. App Store'da oturum açık olmalı.");
      if (await confirm("App Store uygulamasını açayım mı?", false)) {
        await runInteractive("open", ["-a", "App Store"]);
      }
      return { ok: false, message: `Xcode kurulmadı. Oturum açıkken: mas install ${XCODE_MAS_ID}` };
    }
    return { ok: true, message: "Xcode kuruldu. İlk açılışta lisans onayı gerekebilir." };
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
