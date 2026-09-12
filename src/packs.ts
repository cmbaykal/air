import fs from "node:fs";
import { PACKS_PATH } from "./paths.ts";

export interface PackSkill {
  url: string;
  entry?: string;
  name?: string;
  description?: string;
}

export interface SkillPack {
  id: string;
  title: string;
  skills: PackSkill[];
}

interface PacksFile {
  packs: SkillPack[];
}

export function loadPacks(): SkillPack[] {
  const raw = JSON.parse(fs.readFileSync(PACKS_PATH, "utf8")) as PacksFile;
  return Array.isArray(raw.packs) ? raw.packs : [];
}

export function getPack(id: string): SkillPack | null {
  return loadPacks().find((pack) => pack.id === id) ?? null;
}
