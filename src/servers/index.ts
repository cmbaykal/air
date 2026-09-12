import { android } from "./android.ts";
import { asc } from "./asc.ts";
import { bitbucket } from "./bitbucket.ts";
import { cloudflare } from "./cloudflare.ts";
import { figma } from "./figma.ts";
import { firebase } from "./firebase.ts";
import { git } from "./git.ts";
import { github } from "./github.ts";
import { gitlab } from "./gitlab.ts";
import { jira } from "./jira.ts";
import { maestro } from "./maestro.ts";
import { notion } from "./notion.ts";
import { obsidian } from "./obsidian.ts";
import { play } from "./play.ts";
import { release } from "./release.ts";
import { sqlite } from "./sqlite.ts";
import { xcode } from "./xcode.ts";
import type { McpAdapter } from "../types.ts";

export const adapters: Record<string, McpAdapter> = {
  figma,
  jira,
  notion,
  obsidian,
  github,
  gitlab,
  bitbucket,
  git,
  firebase,
  cloudflare,
  xcode,
  android,
  maestro,
  asc,
  play,
  release,
  sqlite,
};
