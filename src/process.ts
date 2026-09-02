import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { RUN_DIR, ensureDir } from "./paths.ts";
import { isWin, killPort, killTree, npxBin } from "./platform.ts";
import { portOpen, wait } from "./health.ts";

function pidPath(id: string): string {
  return path.join(RUN_DIR, `${id}.pid`);
}

function logPath(id: string): string {
  return path.join(RUN_DIR, `${id}.log`);
}

export function readPid(id: string): number | null {
  const file = pidPath(id);
  if (!fs.existsSync(file)) return null;
  const pid = Number(fs.readFileSync(file, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function isRunning(id: string, port: number): Promise<boolean> {
  if (await portOpen(port)) return true;
  const pid = readPid(id);
  return pid !== null && isPidAlive(pid);
}

export async function startDetached(
  id: string,
  bin: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  ensureDir(RUN_DIR);
  const log = fs.openSync(logPath(id), "a");
  const child = spawn(bin, args, {
    detached: !isWin,
    stdio: ["ignore", log, log],
    env: { ...process.env, ...env },
    shell: isWin,
  });
  if (!child.pid) {
    fs.closeSync(log);
    throw new Error(`${id} süreci başlatılamadı.`);
  }
  fs.writeFileSync(pidPath(id), String(child.pid), "utf8");
  child.unref();
}

export async function startNpx(
  id: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  await startDetached(id, npxBin(), ["-y", ...args], env);
}

export async function stopProcess(id: string, port: number): Promise<boolean> {
  const pid = readPid(id);
  if (pid && isPidAlive(pid)) {
    await killTree(pid);
  }
  await wait(200);
  if (await portOpen(port)) {
    await killPort(port);
    await wait(200);
  }
  const file = pidPath(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return !(await portOpen(port));
}
