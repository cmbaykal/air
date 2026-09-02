import fs from "node:fs";
import path from "node:path";
import {
  CONTENT_CLIENTS,
  agentsMdFile,
  claudeMdFile,
  cursorRuleFile,
  type ContentClientId,
} from "./clients.ts";
import { confirmWrite } from "./prompt.ts";
import { backupTarget, ensureDir } from "./paths.ts";
import { fetchText, slugFromUrl, slugify } from "./remote.ts";
import { listAssets, removeAsset, upsertAsset } from "./registry.ts";
import type { AssetRef } from "./types.ts";

function ruleDescription(body: string, fallback: string): string {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

function stripFrontmatter(md: string): string {
  const match = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? md.slice(match[0].length).replace(/^\r?\n/, "") : md;
}

function toMdc(id: string, body: string): string {
  const text = stripFrontmatter(body).trim();
  const description = ruleDescription(text, id);
  return `---\ndescription: ${description}\nalwaysApply: true\n---\n\n${text}\n`;
}

function wrapBlock(id: string, body: string): string {
  const text = stripFrontmatter(body).trim();
  return `<!-- air:rule:${id} -->\n${text}\n<!-- /air:rule:${id} -->`;
}

function mergeMarked(existing: string, id: string, block: string): string {
  const re = new RegExp(`<!-- air:rule:${id} -->[\\s\\S]*?<!-- /air:rule:${id} -->\\n?`);
  if (re.test(existing)) return existing.replace(re, `${block}\n`);
  const base = existing.trimEnd();
  return `${base ? `${base}\n\n` : ""}${block}\n`;
}

function stripMarked(existing: string, id: string): string {
  return existing.replace(new RegExp(`\\n*<!-- air:rule:${id} -->[\\s\\S]*?<!-- /air:rule:${id} -->\\n*`), "\n").trimStart();
}

function writeFile(file: string, content: string): void {
  backupTarget(file);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

function writeMarkdownBlock(file: string, id: string, body: string): void {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  writeFile(file, mergeMarked(current, id, wrapBlock(id, body)));
}

function ruleTargets(client: ContentClientId, id: string, project: string | null): string {
  if (client === "cursor") return cursorRuleFile(id, project);
  if (client === "claude-code") return claudeMdFile(project);
  return agentsMdFile(project);
}

export function listRules(): AssetRef[] {
  return listAssets("rules");
}

export function removeRule(id: string, project: string | null, clients: ContentClientId[]): string[] {
  const asset = removeAsset("rules", id);
  if (!asset) throw new Error(`Kural yok: ${id}`);
  const removed: string[] = [];
  for (const client of clients) {
    const file = ruleTargets(client, asset.id, project);
    if (!fs.existsSync(file)) continue;
    backupTarget(file);
    if (client === "cursor") {
      fs.unlinkSync(file);
    } else {
      const next = stripMarked(fs.readFileSync(file, "utf8"), asset.id);
      fs.writeFileSync(file, next, "utf8");
    }
    removed.push(file);
  }
  return removed;
}

export async function addRule(
  url: string,
  clientIds: ContentClientId[],
  opts: { project: string | null; write: boolean; print: boolean },
): Promise<AssetRef> {
  const body = await fetchText(url);
  const id = slugify(slugFromUrl(url));
  const asset: AssetRef = { id, url, name: ruleDescription(stripFrontmatter(body), id) };
  if (opts.print) {
    console.log(`rule ${asset.id}\n${asset.name}`);
    return asset;
  }
  for (const client of clientIds) {
    const dest = ruleTargets(client, asset.id, opts.project);
    const title = CONTENT_CLIENTS.find((c) => c.id === client)?.title ?? client;
    if (!(await confirmWrite(title, dest, opts.write, "dosya"))) continue;
    if (client === "cursor") writeFile(dest, toMdc(asset.id, body));
    else writeMarkdownBlock(dest, asset.id, body);
    console.log(`Yazıldı: ${dest}`);
  }
  upsertAsset("rules", asset);
  return asset;
}
