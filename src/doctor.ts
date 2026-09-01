import { getAdapter } from "./registry.ts";
import type { DetectResult } from "./types.ts";

export function nodeOk(): DetectResult {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) {
    return { ok: false, message: `Node 20+ gerekli (şu an ${process.versions.node}).` };
  }
  return { ok: true, message: `Node ${process.versions.node}` };
}

export async function doctorServer(id: string): Promise<DetectResult> {
  return getAdapter(id).detect();
}
