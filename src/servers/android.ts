import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { commandExists } from "../platform.ts";
import { installApp } from "../install.ts";
import type { McpAdapter } from "../types.ts";

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
  port: 0,
  url: "",
  requiredEnv: [],

  async detect() {
    const sdk = androidHome();
    const adb = sdk ? path.join(sdk, "platform-tools", "adb") : "";
    if (sdk && (fs.existsSync(adb) || (await commandExists("adb")))) {
      return { ok: true, message: `SDK: ${sdk}` };
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
    await startGateway("android", "npx -y @asjackson/androidbuild-mcp", env, this.port, { timeoutMs: 45_000 });
  },

  async stop() {
    await stopGateway("android", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
