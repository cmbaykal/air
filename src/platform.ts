import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const isWin = process.platform === "win32";
export const isMac = process.platform === "darwin";

export function commandExists(name: string): Promise<boolean> {
  const cmd = isWin ? "where" : "which";
  return execFileAsync(cmd, [name])
    .then(() => true)
    .catch(() => false);
}

export function openUrl(url: string): void {
  if (isWin) {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
}

export function npxBin(): string {
  return isWin ? "npx.cmd" : "npx";
}

export function findFigmaApp(): string | null {
  if (process.env.FIGMA_PATH && fs.existsSync(process.env.FIGMA_PATH)) {
    return process.env.FIGMA_PATH;
  }
  if (isMac) {
    const app = "/Applications/Figma.app";
    return fs.existsSync(app) ? app : null;
  }
  if (isWin) {
    const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    const direct = path.join(local, "Figma", "Figma.exe");
    if (fs.existsSync(direct)) return direct;
    const parent = path.join(local, "Figma");
    if (fs.existsSync(parent)) {
      const match = fs
        .readdirSync(parent)
        .filter((name) => name.startsWith("app-"))
        .map((name) => path.join(parent, name, "Figma.exe"))
        .find((file) => fs.existsSync(file));
      if (match) return match;
    }
  }
  return null;
}

export function findObsidianApp(): string | null {
  if (isMac) {
    const app = "/Applications/Obsidian.app";
    return fs.existsSync(app) ? app : null;
  }
  if (isWin) {
    const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    const exe = path.join(local, "Obsidian", "Obsidian.exe");
    return fs.existsSync(exe) ? exe : null;
  }
  return null;
}

export async function openApp(name: "Figma" | "Obsidian"): Promise<void> {
  if (isMac) {
    await execFileAsync("open", ["-a", name]);
    return;
  }
  if (name === "Figma") {
    const exe = findFigmaApp();
    if (exe) {
      spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
      return;
    }
    spawn("cmd", ["/c", "start", "", "Figma"], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  const exe = findObsidianApp();
  if (exe) {
    spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("cmd", ["/c", "start", "", "Obsidian"], { detached: true, stdio: "ignore" }).unref();
}

export async function killTree(pid: number): Promise<void> {
  if (isWin) {
    await execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"]).catch(() => undefined);
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

export async function runInstall(args: string[]): Promise<{ ok: boolean; output: string }> {
  const bin = args[0];
  const rest = args.slice(1);
  try {
    const { stdout, stderr } = await execFileAsync(bin, rest, {
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, output: `${stdout}\n${stderr}`.trim() };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: (err.stderr || err.stdout || err.message || String(error)).trim() };
  }
}
