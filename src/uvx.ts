import { installApp } from "./install.ts";
import { commandExists } from "./platform.ts";
import type { DetectResult } from "./types.ts";

export async function detectUvx(need: string): Promise<DetectResult> {
  if (await commandExists("uvx")) return { ok: true };
  return { ok: false, message: `uv (uvx) yok — ${need} için gerekli` };
}

export async function ensureUvx(): Promise<DetectResult> {
  if (await commandExists("uvx")) return { ok: true };
  const ok = await installApp("uv", ["install", "uv"], "astral-sh.uv", {
    downloadUrl: "https://docs.astral.sh/uv/getting-started/installation/",
  });
  if (!ok) return { ok: false, message: "uv kurulmadı" };
  if (!(await commandExists("uvx"))) return { ok: false, message: "uv (uvx) yok" };
  return { ok: true };
}
