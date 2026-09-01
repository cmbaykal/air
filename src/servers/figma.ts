import { findFigmaApp, openApp } from "../platform.ts";
import { pollPort, portOpen } from "../health.ts";
import { installApp } from "../install.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3845;

export const figma: McpAdapter = {
  id: "figma",
  title: "Figma",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  fixedPort: true,
  requiredEnv: [],

  async detect() {
    if (await portOpen(PORT)) return { ok: true, message: "Dev Mode MCP açık" };
    const app = findFigmaApp();
    if (app) return { ok: true, message: `Figma bulundu: ${app}` };
    return { ok: false, message: "Figma Desktop yüklü değil" };
  },

  async install() {
    const ok = await installApp(
      "Figma Desktop",
      ["install", "--cask", "figma"],
      "Figma.Figma",
      "https://www.figma.com/downloads/",
    );
    return ok ? { ok: true } : { ok: false, message: "Figma kurulmadı" };
  },

  async start() {
    if (await portOpen(PORT)) return;
    if (!findFigmaApp()) {
      const installed = await this.install();
      if (!installed.ok) {
        throw new Error("Figma Desktop gerekli.");
      }
    }
    console.log("Figma açılıyor...");
    await openApp("Figma");
    const ready = await pollPort(PORT, 25_000);
    if (!ready) {
      throw new Error(
        "Figma açık ama Dev Mode MCP yok (127.0.0.1:3845).\n" +
          "Figma → Preferences → Enable Dev Mode MCP Server seçeneğini açın, sonra tekrar deneyin.",
      );
    }
  },

  async stop() {
    // Figma Desktop kullanıcı uygulaması; Air kapatmaz.
  },

  async health() {
    return portOpen(PORT);
  },
};
