import fs from "node:fs";
import { CONFIG_PATH, USER_DIR, USER_PATH, ensureDir } from "./paths.ts";
import { adapters } from "./servers/index.ts";
import type { CatalogEntry, CatalogFile, McpAdapter, UserPrefs } from "./types.ts";

export function loadCatalog(): CatalogEntry[] {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as CatalogFile;
  return raw.servers;
}

function sanitizePorts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0 && value < 65536) {
      out[id] = value;
    }
  }
  return out;
}

export function loadPrefs(): UserPrefs {
  if (!fs.existsSync(USER_PATH)) return { enabled: [], ports: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(USER_PATH, "utf8")) as UserPrefs;
    return {
      enabled: Array.isArray(raw.enabled) ? raw.enabled : [],
      ports: sanitizePorts(raw.ports),
    };
  } catch {
    return { enabled: [], ports: {} };
  }
}

export function savePrefs(prefs: UserPrefs): void {
  ensureDir(USER_DIR);
  fs.writeFileSync(USER_PATH, `${JSON.stringify(prefs, null, 2)}\n`, "utf8");
}

export function enabledIds(): string[] {
  const catalog = new Set(loadCatalog().map((s) => s.id));
  return loadPrefs().enabled.filter((id) => catalog.has(id));
}

export function isEnabled(id: string): boolean {
  return enabledIds().includes(id);
}

export function enable(ids: string[]): string[] {
  const catalog = new Set(loadCatalog().map((s) => s.id));
  const unknown = ids.filter((id) => !catalog.has(id));
  if (unknown.length) throw new Error(`Bilinmeyen sunucu: ${unknown.join(", ")}`);
  const prefs = loadPrefs();
  prefs.enabled = [...new Set([...prefs.enabled, ...ids])];
  savePrefs(prefs);
  return prefs.enabled;
}

export function disable(ids: string[]): string[] {
  const prefs = loadPrefs();
  prefs.enabled = prefs.enabled.filter((id) => !ids.includes(id));
  savePrefs(prefs);
  return prefs.enabled;
}

export function catalogPort(id: string): number {
  const entry = loadCatalog().find((s) => s.id === id);
  if (!entry) throw new Error(`Katalogda yok: ${id}`);
  return entry.port;
}

export function setAssignedPort(id: string, port: number | null): void {
  const prefs = loadPrefs();
  const ports = { ...prefs.ports };
  if (port === null) {
    if (!(id in ports)) return;
    delete ports[id];
  } else if (ports[id] === port) {
    return;
  } else {
    ports[id] = port;
  }
  prefs.ports = ports;
  savePrefs(prefs);
}

export function getAdapter(id: string): McpAdapter {
  const adapter = adapters[id];
  if (!adapter) throw new Error(`Adapter yok: ${id}`);
  const port = loadPrefs().ports[id] ?? catalogPort(id);
  adapter.port = port;
  adapter.url = `http://127.0.0.1:${port}/mcp`;
  return adapter;
}

export function allAdapters(): McpAdapter[] {
  return loadCatalog().map((entry) => getAdapter(entry.id));
}

export function resolveIds(ids: string[]): McpAdapter[] {
  return ids.map((id) => getAdapter(id));
}
