import fs from "node:fs";
import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { findObsidianApp } from "../platform.ts";
import { startNpx, stopProcess } from "../process.ts";
import { installApp } from "../install.ts";
import { confirm } from "../prompt.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3103;

export const obsidian: McpAdapter = {
  id: "obsidian",
  title: "Obsidian",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [{ key: "OBSIDIAN_VAULT_PATH", label: "Obsidian vault klasör yolu" }],

  async detect() {
    const vault = getEnv("OBSIDIAN_VAULT_PATH");
    if (vault && fs.existsSync(vault) && fs.statSync(vault).isDirectory()) {
      return { ok: true, message: `Vault: ${vault}` };
    }
    return { ok: true, message: "Vault yolu start sırasında sorulur" };
  },

  async install() {
    if (findObsidianApp()) return { ok: true };
    if (!(await confirm("Obsidian uygulaması şart değil. Yine de kurayım mı?", false))) {
      return { ok: true };
    }
    const ok = await installApp(
      "Obsidian",
      ["install", "--cask", "obsidian"],
      "Obsidian.Obsidian",
      "https://obsidian.md/download",
    );
    return ok ? { ok: true } : { ok: true, message: "Uygulama kurulmadı; vault yeterli" };
  },

  async validateEnv() {
    const vault = getEnv("OBSIDIAN_VAULT_PATH");
    if (!vault) return { ok: false, message: "Vault yolu yok" };
    if (!fs.existsSync(vault)) {
      if (await confirm(`Klasör yok. Oluşturayım mı?\n${vault}`, true)) {
        fs.mkdirSync(vault, { recursive: true });
        return { ok: true };
      }
      return { ok: false, message: "Vault klasörü yok" };
    }
    if (!fs.statSync(vault).isDirectory()) {
      return { ok: false, message: "Vault yolu bir klasör değil" };
    }
    return { ok: true };
  },

  async start() {
    const vault = getEnv("OBSIDIAN_VAULT_PATH");
    await startNpx("obsidian", [
      "supergateway",
      "--stdio",
      `npx -y @modelcontextprotocol/server-filesystem ${JSON.stringify(vault)}`,
      "--port",
      String(PORT),
      "--host",
      "127.0.0.1",
      "--outputTransport",
      "streamableHttp",
    ]);
    if (!(await pollPort(PORT, 30_000))) {
      throw new Error("Obsidian MCP ayağa kalkmadı. .run/obsidian.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("obsidian", PORT);
  },

  async health() {
    return pollPort(PORT, 500, 100);
  },
};
