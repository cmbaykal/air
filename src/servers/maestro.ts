import { pollPort } from "../health.ts";
import { commandExists, isMac, openUrl } from "../platform.ts";
import { startNpx, stopProcess } from "../process.ts";
import { installApp } from "../install.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3111;

export const maestro: McpAdapter = {
  id: "maestro",
  title: "Maestro",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [],

  async detect() {
    if (!(await commandExists("java"))) {
      return { ok: false, message: "Java 17+ yok (JAVA_HOME)" };
    }
    if (!(await commandExists("maestro"))) {
      return { ok: false, message: "Maestro CLI yok" };
    }
    return { ok: true, message: "Local Maestro MCP (UI test)" };
  },

  async install() {
    if (!(await commandExists("java"))) {
      const ok = await installApp(
        "Java 17",
        ["install", "openjdk@17"],
        "Microsoft.OpenJDK.17",
        "https://adoptium.net/",
      );
      if (!ok) return { ok: false, message: "Java kurulmadı" };
    }
    if (!(await commandExists("maestro"))) {
      if (isMac) {
        const ok = await installApp(
          "Maestro CLI",
          ["install", "maestro"],
          "maestro",
          "https://docs.maestro.dev/getting-started/installing-maestro",
        );
        if (ok && (await commandExists("maestro"))) return { ok: true };
      }
      openUrl("https://docs.maestro.dev/getting-started/installing-maestro");
      return { ok: false, message: "Maestro CLI kurulmalı: curl -fsSL https://get.maestro.mobile.dev | bash" };
    }
    return { ok: true };
  },

  async start() {
    await startNpx("maestro", [
      "supergateway",
      "--stdio",
      "maestro mcp",
      "--port",
      String(PORT),
      "--host",
      "127.0.0.1",
      "--outputTransport",
      "streamableHttp",
    ]);
    if (!(await pollPort(PORT, 45_000))) {
      throw new Error("Maestro MCP ayağa kalkmadı. .run/maestro.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("maestro", PORT);
  },

  async health() {
    return pollPort(PORT, 500, 100);
  },
};
