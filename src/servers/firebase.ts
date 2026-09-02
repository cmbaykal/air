import fs from "node:fs";
import os from "node:os";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { npxBin, runInstall, runInteractive } from "../platform.ts";
import { confirm } from "../prompt.ts";
import type { McpAdapter } from "../types.ts";

function projectDir(): string {
  const dir = getEnv("FIREBASE_PROJECT_DIR").trim();
  return dir || os.homedir();
}

async function loginList(): Promise<{ ok: boolean; output: string }> {
  return runInstall([npxBin(), "-y", "firebase-tools@latest", "login:list"]);
}

function looksLoggedIn(output: string): boolean {
  if (/No authorized accounts|not logged in|not authenticated/i.test(output)) return false;
  return /@/.test(output) || /Logged in/i.test(output);
}

export const firebase: McpAdapter = {
  id: "firebase",
  title: "Firebase",
  port: 0,
  url: "",
  requiredEnv: [
    {
      key: "FIREBASE_PROJECT_DIR",
      label: "Firebase proje klasörü (firebase.json olan dizin)",
    },
  ],

  async validateEnv() {
    const dir = projectDir();
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return { ok: false, message: "Firebase proje klasörü yok." };
    }
    const listed = await loginList();
    if (looksLoggedIn(listed.output)) return { ok: true };
    console.log("Firebase CLI oturumu yok. Tarayıcıda Google ile giriş gerekir.");
    if (!(await confirm("Şimdi firebase login çalıştırayım mı?", true))) {
      return { ok: false, message: "Firebase girişi yapılmadı. Sonra: npx firebase-tools login" };
    }
    const code = await runInteractive(npxBin(), ["-y", "firebase-tools@latest", "login"]);
    if (code !== 0) return { ok: false, message: "Firebase login başarısız." };
    const again = await loginList();
    if (!looksLoggedIn(again.output)) return { ok: false, message: "Firebase hâlâ oturum açmamış." };
    return { ok: true };
  },

  async start() {
    const dir = projectDir();
    await startGateway(
      "firebase",
      `npx -y firebase-tools@latest mcp --dir ${JSON.stringify(dir)}`,
      {},
      this.port,
      { timeoutMs: 45_000, extraArgs: ["--stateful"] },
    );
  },

  async stop() {
    await stopGateway("firebase", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
