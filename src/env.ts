import fs from "node:fs";
import { ENV_PATH } from "./paths.ts";
import { confirm, ask } from "./prompt.ts";
import { openUrl } from "./platform.ts";
import type { EnvField } from "./types.ts";

export function loadEnvFile(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
    if (!(key in process.env)) process.env[key] = value;
  }
  return out;
}

export function getEnv(key: string): string {
  loadEnvFile();
  return (process.env[key] ?? "").trim();
}

export function setEnv(key: string, value: string): void {
  const current = loadEnvFile();
  current[key] = value;
  process.env[key] = value;
  const lines = Object.entries(current).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, `${lines.join("\n")}\n`, "utf8");
}

export function clearEnv(keys: string[]): void {
  const current = loadEnvFile();
  for (const key of keys) {
    delete current[key];
    delete process.env[key];
  }
  const lines = Object.entries(current).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.length ? `${lines.join("\n")}\n` : "", "utf8");
}

export async function ensureFields(fields: EnvField[], force = false): Promise<void> {
  if (fields.length === 0) return;
  loadEnvFile();
  for (const field of fields) {
    const existing = getEnv(field.key);
    if (existing && !force) continue;
    if (field.helpUrl && (!existing || force)) {
      console.log(`${field.label} gerekli.`);
      if (await confirm("Oluşturma sayfasını tarayıcıda açayım mı?", !existing)) {
        openUrl(field.helpUrl);
      }
    }
    const hint = existing ? (field.secret ? "kayıtlı, Enter=aynı" : existing) : "";
    let value = "";
    while (!value) {
      value = (await ask(field.label, hint)).trim();
      if (value === "kayıtlı, Enter=aynı" || (hint && value === hint && field.secret)) {
        value = existing;
      }
      if (existing && !value) value = existing;
      if (!value) console.log("Boş bırakılamaz, tekrar girin.");
    }
    setEnv(field.key, value);
  }
}
