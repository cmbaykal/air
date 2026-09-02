import fs from "node:fs";
import path from "node:path";
import {
  CONTENT_CLIENTS,
  skillInstallDir,
  type ContentClientId,
} from "./clients.ts";
import { confirm } from "./prompt.ts";
import { backupTarget, ensureDir } from "./paths.ts";
import { fetchSkillSources, slugify, type FetchedFile } from "./remote.ts";
import { listAssets, removeAsset, upsertAsset } from "./registry.ts";
import type { AssetRef } from "./types.ts";

export function parseSkillMd(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("SKILL.md frontmatter yok (name, description).");
  const fm = match[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  let description = "";
  const folded = fm.match(/^description:\s*[>|]-?\s*\n((?:[ \t]+.*\n?)*)/m);
  if (folded) {
    description = folded[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
  } else {
    description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  }
  if (!name || !description) throw new Error("SKILL.md içinde name ve description gerekli.");
  return { name: slugify(name), description };
}

function skillFile(files: FetchedFile[]): FetchedFile {
  const found = files.find((f) => /(^|\/)SKILL\.md$/i.test(f.relativePath));
  if (!found) throw new Error("SKILL.md bulunamadı.");
  return found;
}

function writeSkillDir(dest: string, files: FetchedFile[]): void {
  backupTarget(dest);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  ensureDir(dest);
  for (const file of files) {
    const target = path.join(dest, file.relativePath);
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, file.content, "utf8");
  }
}

export function listSkills(): AssetRef[] {
  return listAssets("skills");
}

export function removeSkill(id: string, project: string | null, clients: ContentClientId[]): string[] {
  const asset = removeAsset("skills", id);
  if (!asset) throw new Error(`Skill yok: ${id}`);
  const removed: string[] = [];
  for (const client of clients) {
    const dest = skillInstallDir(client, asset.name, project);
    if (!fs.existsSync(dest)) continue;
    backupTarget(dest);
    fs.rmSync(dest, { recursive: true, force: true });
    removed.push(dest);
  }
  return removed;
}

export async function addSkill(
  url: string,
  clientIds: ContentClientId[],
  opts: { project: string | null; write: boolean; print: boolean },
): Promise<AssetRef> {
  const files = await fetchSkillSources(url);
  const meta = parseSkillMd(skillFile(files).content);
  const asset: AssetRef = { id: meta.name, url, name: meta.name };
  if (opts.print) {
    console.log(`skill ${asset.id} → ${asset.name}\n${files.map((f) => f.relativePath).join("\n")}`);
    return asset;
  }
  for (const client of clientIds) {
    const dest = skillInstallDir(client, asset.name, opts.project);
    const title = CONTENT_CLIENTS.find((c) => c.id === client)?.title ?? client;
    console.log(`\n=== ${title} ===\n${dest}`);
    const shouldWrite = opts.write || (await confirm(`${dest} dizinine yazayım mı?`, true));
    if (!shouldWrite) continue;
    writeSkillDir(dest, files);
    console.log(`Yazıldı: ${dest}`);
  }
  upsertAsset("skills", asset);
  return asset;
}
