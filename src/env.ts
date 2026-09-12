import fs from "node:fs";
import { ENV_PATH } from "./paths.ts";
import { confirm, ask } from "./prompt.ts";
import { openUrl } from "./platform.ts";
import type { EnvField, McpAdapter } from "./types.ts";

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

export function applyEnvUpdate(existing: string, key: string, value: string): string {
  const lines = existing.length ? existing.split(/\r?\n/) : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  let found = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    if (trimmed.split("=")[0].trim() !== key) return line;
    found = true;
    return `${key}=${value}`;
  });
  if (!found) next.push(`${key}=${value}`);
  return `${next.join("\n")}\n`;
}

export function setEnv(key: string, value: string): void {
  process.env[key] = value;
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  fs.writeFileSync(ENV_PATH, applyEnvUpdate(existing, key, value), "utf8");
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

export async function fillAndValidateEnv(adapter: McpAdapter, force = false): Promise<boolean> {
  if (!adapter.requiredEnv.length) return true;
  for (;;) {
    await ensureFields(adapter.requiredEnv, force);
    if (!adapter.validateEnv) return true;
    const valid = await adapter.validateEnv();
    if (valid.ok) return true;
    console.log(valid.message ?? `${adapter.title} doğrulanamadı.`);
    if (!(await confirm("Bilgileri tekrar gireyim mi?", true))) return false;
    force = true;
  }
}
