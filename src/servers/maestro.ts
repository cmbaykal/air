import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { commandExists } from "../platform.ts";
import { installApp } from "../install.ts";
import type { McpAdapter } from "../types.ts";

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
      const ok = await installApp("Java 17", ["install", "openjdk@17"], "Microsoft.OpenJDK.17", {
        downloadUrl: "https://adoptium.net/",
        brewPathFormula: "openjdk@17",
        linuxPkg: {
          apt: "openjdk-17-jdk",
          dnf: "java-17-openjdk-devel",
          pacman: "jdk17-openjdk",
          zypper: "java-17-openjdk-devel",
        },
      });
      if (!ok || !(await commandExists("java"))) return { ok: false, message: "Java kurulmadı" };
    }
    if (!(await commandExists("maestro"))) {
      const ok = await installApp("Maestro CLI", ["install", "maestro"], "", {
        downloadUrl: "https://docs.maestro.dev/getting-started/installing-maestro",
      });
      if (!ok || !(await commandExists("maestro"))) return { ok: false, message: "Maestro CLI kurulmadı" };
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
