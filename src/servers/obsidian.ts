import fs from "node:fs";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { findObsidianApp } from "../platform.ts";
import { installApp } from "../install.ts";
import { confirm } from "../prompt.ts";
import type { McpAdapter } from "../types.ts";

export const obsidian: McpAdapter = {
  id: "obsidian",
  title: "Obsidian (vault)",
  port: 0,
  url: "",
  requiredEnv: [{ key: "OBSIDIAN_VAULT_PATH", label: "Obsidian vault klasör yolu" }],

  async detect() {
    const vault = getEnv("OBSIDIAN_VAULT_PATH");
    if (vault && fs.existsSync(vault) && fs.statSync(vault).isDirectory()) {
      return { ok: true, message: `Vault (filesystem): ${vault}` };
    }
    return { ok: true, message: "Vault yolu start sırasında sorulur (filesystem MCP)" };
  },

  async install() {
    if (findObsidianApp()) return { ok: true };
    if (!(await confirm("Obsidian uygulaması şart değil. Yine de kurayım mı?", false))) {
      return { ok: true };
    }
    const ok = await installApp("Obsidian", ["install", "--cask", "obsidian"], "Obsidian.Obsidian", {
      downloadUrl: "https://obsidian.md/download",
    });
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
    await startGateway(
      "obsidian",
      `npx -y @modelcontextprotocol/server-filesystem ${JSON.stringify(vault)}`,
      {},
      this.port,
    );
  },

  async stop() {
    await stopGateway("obsidian", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
