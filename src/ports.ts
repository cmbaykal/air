import { portOpen } from "./health.ts";
import { isPidAlive, readPid } from "./process.ts";
import { loadCatalog, loadPrefs, setAssignedPort } from "./registry.ts";
import type { McpAdapter } from "./types.ts";

const SCAN_LIMIT = 64;

function reservedByOthers(id: string): Set<number> {
  const reserved = new Set<number>();
  for (const entry of loadCatalog()) {
    if (entry.id !== id) reserved.add(entry.port);
  }
  for (const [other, port] of Object.entries(loadPrefs().ports)) {
    if (other !== id) reserved.add(port);
  }
  return reserved;
}

async function occupancy(id: string, port: number): Promise<"free" | "ours" | "busy"> {
  if (!(await portOpen(port))) return "free";
  const pid = readPid(id);
  if (pid && isPidAlive(pid)) return "ours";
  return "busy";
}

async function usable(id: string, port: number): Promise<boolean> {
  const state = await occupancy(id, port);
  return state === "free" || state === "ours";
}

export function applyListenPort(adapter: McpAdapter, port: number): void {
  adapter.port = port;
  adapter.url = `http://127.0.0.1:${port}/mcp`;
}

export async function resolveListenPort(
  id: string,
  preferred: number,
  fixed: boolean,
): Promise<{ port: number; fallback: boolean }> {
  if (fixed) return { port: preferred, fallback: false };

  const reserved = reservedByOthers(id);
  const sticky = loadPrefs().ports[id];

  if (await usable(id, preferred)) {
    setAssignedPort(id, null);
    return { port: preferred, fallback: false };
  }

  if (sticky && sticky !== preferred && !reserved.has(sticky) && (await usable(id, sticky))) {
    setAssignedPort(id, sticky);
    return { port: sticky, fallback: true };
  }

  let examined = 0;
  for (let port = preferred + 1; examined < SCAN_LIMIT && port <= 65535; port++) {
    if (reserved.has(port)) continue;
    examined++;
    if (await usable(id, port)) {
      setAssignedPort(id, port);
      return { port, fallback: true };
    }
  }

  throw new Error(
    `${id} için boş port yok (${preferred} dolu, sonraki ${SCAN_LIMIT} aday da kullanılamadı).`,
  );
}
