import fs from "node:fs";
import path from "node:path";
import {
  CONTENT_CLIENTS,
  skillInstallDir,
  type ContentClientId,
} from "./clients.ts";
import { confirmWrite } from "./prompt.ts";
import { backupTarget, ensureDir } from "./paths.ts";
import { getPack, loadPacks, type PackSkill } from "./packs.ts";
import { fetchSkillSources, slugify, type FetchedFile, type SkillFetchOpts } from "./remote.ts";
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

function fetchOpts(skill?: PackSkill): SkillFetchOpts | undefined {
  if (!skill) return undefined;
  return { entry: skill.entry, name: skill.name, description: skill.description };
}

export async function addSkill(
  url: string,
  clientIds: ContentClientId[],
  opts: { project: string | null; write: boolean; print: boolean; skipConfirm?: boolean; source?: PackSkill },
): Promise<AssetRef> {
  const files = await fetchSkillSources(url, fetchOpts(opts.source));
  const meta = parseSkillMd(skillFile(files).content);
  const asset: AssetRef = { id: meta.name, url, name: meta.name };
  if (opts.print) {
    console.log(`skill ${asset.id} → ${asset.name}\n${files.map((f) => f.relativePath).join("\n")}`);
    return asset;
  }
  const auto = Boolean(opts.write || opts.skipConfirm);
  for (const client of clientIds) {
    const dest = skillInstallDir(client, asset.name, opts.project);
    const title = CONTENT_CLIENTS.find((c) => c.id === client)?.title ?? client;
    if (!(await confirmWrite(title, dest, auto, "dizin"))) continue;
    writeSkillDir(dest, files);
    console.log(`Yazıldı: ${dest}`);
  }
  upsertAsset("skills", asset);
  return asset;
}

export async function addSkillPack(
  packId: string,
  clientIds: ContentClientId[],
  opts: { project: string | null; write: boolean; print: boolean },
): Promise<AssetRef[]> {
  const pack = getPack(packId);
  if (!pack) throw new Error(`Bilinmeyen paket: ${packId}. Mevcut: ${loadPacks().map((p) => p.id).join(", ")}`);
  const written: AssetRef[] = [];
  if (opts.print) {
    for (const skill of pack.skills) {
      written.push(await addSkill(skill.url, clientIds, { ...opts, source: skill }));
    }
    return written;
  }
  for (const client of clientIds) {
    const title = CONTENT_CLIENTS.find((c) => c.id === client)?.title ?? client;
    const label = `${title} ← paket ${pack.id} (${pack.skills.length} skill)`;
    if (!(await confirmWrite(label, skillInstallDir(client, pack.id, opts.project), opts.write, "dizin"))) {
      continue;
    }
    for (const skill of pack.skills) {
      written.push(
        await addSkill(skill.url, [client], { ...opts, write: true, skipConfirm: true, source: skill }),
      );
    }
  }
  return written;
}

export function isPackId(id: string): boolean {
  return Boolean(getPack(id));
}
