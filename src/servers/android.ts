import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { commandExists } from "../platform.ts";
import { startNpx, stopProcess } from "../process.ts";
import { installApp } from "../install.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3110;

function androidHome(): string {
  const fromEnv = (getEnv("ANDROID_HOME") || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "").trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    path.join(os.homedir(), "Library", "Android", "sdk"),
    path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
  ];
  return candidates.find((dir) => dir && fs.existsSync(dir)) ?? "";
}

export const android: McpAdapter = {
  id: "android",
  title: "Android",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [],

  async detect() {
    const sdk = androidHome();
    const adb = sdk ? path.join(sdk, "platform-tools", "adb") : "";
    if (sdk && (fs.existsSync(adb) || (await commandExists("adb")))) {
      return { ok: true, message: `Local AndroidBuild MCP (SDK: ${sdk})` };
    }
    return { ok: false, message: "Android SDK yok (ANDROID_HOME / Android Studio)" };
  },

  async install() {
    const ok = await installApp(
      "Android Studio",
      ["install", "--cask", "android-studio"],
      "Google.AndroidStudio",
      "https://developer.android.com/studio",
    );
    return ok
      ? { ok: true, message: "Android Studio kuruldu. SDK Manager'dan Platform-Tools yükleyin." }
      : { ok: false, message: "Android SDK kurulmadı" };
  },

  async start() {
    const sdk = androidHome();
    const env: Record<string, string> = {};
    if (sdk) {
      env.ANDROID_HOME = sdk;
      env.ANDROID_SDK_ROOT = sdk;
    }
    await startNpx(
      "android",
      [
        "supergateway",
        "--stdio",
        "npx -y @asjackson/androidbuild-mcp",
        "--port",
        String(PORT),
        "--host",
        "127.0.0.1",
        "--outputTransport",
        "streamableHttp",
      ],
      env,
    );
    if (!(await pollPort(PORT, 45_000))) {
      throw new Error("Android MCP ayağa kalkmadı. .run/android.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("android", PORT);
  },

  async health() {
    return pollPort(PORT, 500, 100);
  },
};
