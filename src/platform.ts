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
  await new Promise((r) => setTimeout(r, 250));
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
}

export async function pidsOnPort(port: number): Promise<number[]> {
  if (isWin) {
    try {
      const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "TCP"]);
      const pids = new Set<number>();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        if (!line.includes(`:${port} `) && !line.includes(`:${port}\t`)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (pid > 0) pids.add(pid);
      }
      return [...pids];
    } catch {
      return [];
    }
  }
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    return [...new Set(stdout.split(/\s+/).map(Number).filter((n) => n > 0))];
  } catch {
    return [];
  }
}

export async function killPort(port: number): Promise<void> {
  const pids = await pidsOnPort(port);
  for (const pid of pids) {
    await killTree(pid);
  }
}

export function runInteractive(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: isWin });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", reject);
  });
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
