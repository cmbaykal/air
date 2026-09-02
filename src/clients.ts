import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isWin } from "./platform.ts";
import { confirm } from "./prompt.ts";
import type { McpAdapter } from "./types.ts";

export type ClientId = "cursor" | "lmstudio" | "claude-desktop" | "claude-code" | "opencode";

export const CLIENTS: { id: ClientId; title: string }[] = [
  { id: "cursor", title: "Cursor" },
  { id: "lmstudio", title: "LM Studio" },
  { id: "claude-desktop", title: "Claude Desktop" },
  { id: "claude-code", title: "Claude Code" },
  { id: "opencode", title: "OpenCode" },
];

export type ContentClientId = "cursor" | "claude-code" | "opencode";

export const CONTENT_CLIENTS: { id: ContentClientId; title: string }[] = [
  { id: "cursor", title: "Cursor" },
  { id: "claude-code", title: "Claude Code" },
  { id: "opencode", title: "OpenCode" },
];

export function isContentClient(id: string): id is ContentClientId {
  return CONTENT_CLIENTS.some((c) => c.id === id);
}

function home(...parts: string[]): string {
  return path.join(os.homedir(), ...parts);
}

export function skillInstallDir(client: ContentClientId, name: string, project: string | null): string {
  if (project) {
    if (client === "cursor") return path.join(project, ".cursor", "skills", name);
    if (client === "claude-code") return path.join(project, ".claude", "skills", name);
    return path.join(project, ".opencode", "skills", name);
  }
  if (client === "cursor") return home(".cursor", "skills", name);
  if (client === "claude-code") return home(".claude", "skills", name);
  return isWin
    ? path.join(process.env.APPDATA ?? home("AppData", "Roaming"), "opencode", "skills", name)
    : home(".config", "opencode", "skills", name);
}

export function cursorRuleFile(id: string, project: string | null): string {
  return project ? path.join(project, ".cursor", "rules", `${id}.mdc`) : home(".cursor", "rules", `${id}.mdc`);
}

export function claudeMdFile(project: string | null): string {
  return project ? path.join(project, "CLAUDE.md") : home(".claude", "CLAUDE.md");
}

export function agentsMdFile(project: string | null): string {
  return project
    ? path.join(project, "AGENTS.md")
    : isWin
      ? path.join(process.env.APPDATA ?? home("AppData", "Roaming"), "opencode", "AGENTS.md")
      : home(".config", "opencode", "AGENTS.md");
}

export function clientConfigPath(id: ClientId): string | null {
  switch (id) {
    case "cursor":
      return home(".cursor", "mcp.json");
    case "lmstudio":
      return home(".lmstudio", "mcp.json");
    case "claude-desktop":
      return isWin
        ? path.join(process.env.APPDATA ?? home("AppData", "Roaming"), "Claude", "claude_desktop_config.json")
        : home("Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "opencode":
      return isWin
        ? path.join(process.env.APPDATA ?? home("AppData", "Roaming"), "opencode", "opencode.json")
        : home(".config", "opencode", "opencode.json");
    case "claude-code":
      return home(".claude.json");
  }
}

function airKey(adapter: McpAdapter): string {
  return `air-${adapter.id}`;
}

export function snippetFor(client: ClientId, adapters: McpAdapter[]): string {
  if (adapters.length === 0) return "{}\n";
  if (client === "claude-code") {
    const mcpServers: Record<string, unknown> = {};
    for (const a of adapters) {
      mcpServers[airKey(a)] = { type: "http", url: a.url };
    }
    return `${JSON.stringify({ mcpServers }, null, 2)}\n`;
  }
  if (client === "opencode") {
    const mcp: Record<string, unknown> = {};
    for (const a of adapters) {
      mcp[airKey(a)] = { type: "remote", url: a.url, enabled: true };
    }
    return `${JSON.stringify({ $schema: "https://opencode.ai/config.json", mcp }, null, 2)}\n`;
  }
  const mcpServers: Record<string, unknown> = {};
  for (const a of adapters) {
    mcpServers[airKey(a)] = { url: a.url };
  }
  return `${JSON.stringify({ mcpServers }, null, 2)}\n`;
}

function backup(file: string): void {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak`);
  }
}

function readJson(file: string): Record<string, unknown> {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Bozuk JSON: ${file}`);
  }
  return parsed as Record<string, unknown>;
}

function writeJson(file: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function mergeClientConfig(client: ClientId, adapters: McpAdapter[]): string {
  const file = clientConfigPath(client);
  if (!file) throw new Error("Bu istemci için config yolu yok.");
  backup(file);
  const data = readJson(file);
  if (client === "opencode") {
    const mcp = (data.mcp && typeof data.mcp === "object" ? data.mcp : {}) as Record<string, unknown>;
    for (const a of adapters) {
      mcp[airKey(a)] = { type: "remote", url: a.url, enabled: true };
    }
    data.mcp = mcp;
    if (!data.$schema) data.$schema = "https://opencode.ai/config.json";
  } else {
    const mcpServers = (
      data.mcpServers && typeof data.mcpServers === "object" ? data.mcpServers : {}
    ) as Record<string, unknown>;
    for (const a of adapters) {
      mcpServers[airKey(a)] =
        client === "claude-code" ? { type: "http", url: a.url } : { url: a.url };
    }
    data.mcpServers = mcpServers;
  }
  writeJson(file, data);
  return file;
}

export async function connectClients(
  clientIds: ClientId[],
  adapters: McpAdapter[],
  opts: { write?: boolean; print?: boolean },
): Promise<void> {
  if (adapters.length === 0) {
    console.log("Ayakta sunucu yok. Önce: air start");
    return;
  }
  for (const client of clientIds) {
    const title = CLIENTS.find((c) => c.id === client)?.title ?? client;
    const text = snippetFor(client, adapters);
    console.log(`\n=== ${title} ===`);
    console.log(text);
    if (opts.print) continue;
    const file = clientConfigPath(client);
    const shouldWrite = opts.write || (await confirm(`${file} dosyasına yazayım mı?`, true));
    if (!shouldWrite) continue;
    const written = mergeClientConfig(client, adapters);
    console.log(`Yazıldı: ${written}`);
    console.log("Uygulamayı yeniden açın veya MCP listesini yenileyin.");
  }
}
