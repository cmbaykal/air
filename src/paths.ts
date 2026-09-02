import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_PATH = path.join(ROOT, "config", "servers.json");
export const USER_DIR = path.join(ROOT, ".air");
export const USER_PATH = path.join(USER_DIR, "user.json");
export const ENV_PATH = path.join(ROOT, ".env");
export const RUN_DIR = path.join(ROOT, ".run");

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function backupTarget(target: string): void {
  if (!fs.existsSync(target)) return;
  fs.cpSync(target, `${target}.bak`, { recursive: true });
}
