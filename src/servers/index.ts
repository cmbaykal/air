import { android } from "./android.ts";
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
import { xcode } from "./xcode.ts";
import type { McpAdapter } from "../types.ts";

export const adapters: Record<string, McpAdapter> = {
  figma,
  jira,
  notion,
  obsidian,
  github,
  gitlab,
  git,
  firebase,
  cloudflare,
  xcode,
  android,
  maestro,
};
