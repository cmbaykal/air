import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { commandExists, isMac, openUrl } from "../platform.ts";
import { installApp } from "../install.ts";
import type { McpAdapter } from "../types.ts";

const MAESTRO_DOCS = "https://docs.maestro.dev/getting-started/installing-maestro";

export const maestro: McpAdapter = {
  id: "maestro",
  title: "Maestro",
  port: 0,
  url: "",
  requiredEnv: [],

  async detect() {
    if (!(await commandExists("java"))) {
      return { ok: false, message: "Java 17+ yok (JAVA_HOME)" };
    }
    if (!(await commandExists("maestro"))) {
      return { ok: false, message: "Maestro CLI yok" };
    }
    return { ok: true };
  },

  async install() {
    if (!(await commandExists("java"))) {
      const ok = await installApp(
        "Java 17",
        ["install", "openjdk@17"],
        "Microsoft.OpenJDK.17",
        "https://adoptium.net/",
        {
          apt: "openjdk-17-jdk",
          dnf: "java-17-openjdk-devel",
          pacman: "jdk17-openjdk",
          zypper: "java-17-openjdk-devel",
        },
      );
      if (!ok) return { ok: false, message: "Java kurulmadı" };
    }
    if (!(await commandExists("maestro"))) {
      if (isMac) {
        const ok = await installApp(
          "Maestro CLI",
          ["install", "maestro"],
          "",
          MAESTRO_DOCS,
        );
        if (ok && (await commandExists("maestro"))) return { ok: true };
      }
      openUrl(MAESTRO_DOCS);
      return { ok: false, message: `Maestro CLI kurulmalı: ${MAESTRO_DOCS}` };
    }
    return { ok: true };
  },

  async start() {
    await startGateway("maestro", "maestro mcp", {}, this.port, { timeoutMs: 45_000 });
  },

  async stop() {
    await stopGateway("maestro", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
