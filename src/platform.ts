import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { wait } from "./health.ts";
import { BIN_DIR } from "./paths.ts";

const execFileAsync = promisify(execFile);

export const isWin = process.platform === "win32";
export const isMac = process.platform === "darwin";
export const isLinux = process.platform === "linux";

function firstExisting(paths: string[]): string | null {
  return paths.find((p) => p && fs.existsSync(p)) ?? null;
}

export function brewBinDirs(): string[] {
  return [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/home/linuxbrew/.linuxbrew/bin",
    "/home/linuxbrew/.linuxbrew/sbin",
    path.join(os.homedir(), ".linuxbrew", "bin"),
  ];
}

export function extraBinDirs(): string[] {
  return [
    ...brewBinDirs(),
    path.join(os.homedir(), ".local", "bin"),
    path.join(os.homedir(), ".maestro", "bin"),
    path.join(os.homedir(), ".cargo", "bin"),
    BIN_DIR,
    ...(isMac ? ["/Applications/Docker.app/Contents/Resources/bin"] : []),
  ];
}

export function brewExecutable(): string | null {
  return firstExisting(brewBinDirs().map((dir) => path.join(dir, "brew")));
}

export function prependToPath(dir: string): void {
  if (!dir || !fs.existsSync(dir)) return;
  const current = process.env.PATH ?? "";
  const parts = current.split(path.delimiter).filter(Boolean);
  if (parts.includes(dir)) return;
  process.env.PATH = `${dir}${path.delimiter}${current}`;
}

export function applyKnownBinsToPath(): void {
  for (const dir of extraBinDirs()) prependToPath(dir);
}

export async function commandExists(name: string): Promise<boolean> {
  applyKnownBinsToPath();
  const cmd = isWin ? "where" : "which";
  try {
    await execFileAsync(cmd, [name]);
    return true;
  } catch {
    const exe = isWin ? `${name}.exe` : name;
    return extraBinDirs().some((dir) => fs.existsSync(path.join(dir, exe)));
  }
}

export function openUrl(url: string): void {
  if (isWin) {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (isMac) {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

export function npxBin(): string {
  return isWin ? "npx.cmd" : "npx";
}

export function findDesktopApp(paths: { mac?: string[]; win?: string[]; linux?: string[] }): string | null {
  const list = isMac ? paths.mac : isWin ? paths.win : paths.linux;
  return firstExisting(list ?? []);
}

export function findFigmaApp(): string | null {
  if (process.env.FIGMA_PATH && fs.existsSync(process.env.FIGMA_PATH)) {
    return process.env.FIGMA_PATH;
  }
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const found = findDesktopApp({
    mac: ["/Applications/Figma.app"],
    win: [path.join(local, "Figma", "Figma.exe")],
    linux: [
      "/opt/figma-linux/figma-linux",
      "/usr/bin/figma-linux",
      "/usr/bin/figma",
      "/snap/bin/figma-linux",
      path.join(os.homedir(), ".local", "bin", "figma-linux"),
    ],
  });
  if (found) return found;
  if (isWin) {
    const parent = path.join(local, "Figma");
    if (fs.existsSync(parent)) {
      return (
        fs
          .readdirSync(parent)
          .filter((name) => name.startsWith("app-"))
          .map((name) => path.join(parent, name, "Figma.exe"))
          .find((file) => fs.existsSync(file)) ?? null
      );
    }
  }
  return null;
}

export function findObsidianApp(): string | null {
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  return findDesktopApp({
    mac: ["/Applications/Obsidian.app"],
    win: [path.join(local, "Obsidian", "Obsidian.exe")],
    linux: [
      "/opt/Obsidian/obsidian",
      "/opt/obsidian/obsidian",
      "/usr/bin/obsidian",
      "/usr/bin/Obsidian",
      "/snap/bin/obsidian",
      path.join(os.homedir(), ".local", "bin", "obsidian"),
    ],
  });
}

export async function openApp(name: "Figma" | "Obsidian"): Promise<void> {
  if (isMac) {
    await execFileAsync("open", ["-a", name]);
    return;
  }
  const exe = name === "Figma" ? findFigmaApp() : findObsidianApp();
  if (exe) {
    spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (isWin) {
    spawn("cmd", ["/c", "start", "", name], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  const bin = name === "Figma" ? "figma-linux" : "obsidian";
  spawn(bin, [], { detached: true, stdio: "ignore" }).unref();
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
    } catch {}
  }
  await wait(250);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
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
  } catch {}
  try {
    const { stdout } = await execFileAsync("ss", ["-lptn", `sport = :${port}`]);
    return [...new Set([...stdout.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1])).filter((n) => n > 0))];
  } catch {}
  try {
    const { stdout } = await execFileAsync("fuser", [`${port}/tcp`]);
    return [...new Set(stdout.trim().split(/\s+/).map(Number).filter((n) => n > 0))];
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
