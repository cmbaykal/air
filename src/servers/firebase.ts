import fs from "node:fs";
import os from "node:os";
import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { npxBin, runInstall, runInteractive } from "../platform.ts";
import { startNpx, stopProcess } from "../process.ts";
import { confirm } from "../prompt.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3107;

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
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [
    {
      key: "FIREBASE_PROJECT_DIR",
      label: "Firebase proje klasörü (firebase.json olan dizin)",
    },
  ],

  async detect() {
    return { ok: true, message: "Local Firebase MCP (firebase-tools + Google hesabı)" };
  },

  async install() {
    return { ok: true };
  },

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
    await startNpx("firebase", [
      "supergateway",
      "--stdio",
      `npx -y firebase-tools@latest mcp --dir ${JSON.stringify(dir)}`,
      "--port",
      String(PORT),
      "--host",
      "127.0.0.1",
      "--outputTransport",
      "streamableHttp",
    ]);
    if (!(await pollPort(PORT, 45_000))) {
      throw new Error("Firebase MCP ayağa kalkmadı. .run/firebase.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("firebase", PORT);
  },

  async health() {
    return pollPort(PORT, 500, 100);
  },
};
