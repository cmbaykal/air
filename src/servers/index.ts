import { figma } from "./figma.ts";
import { jira } from "./jira.ts";
import { notion } from "./notion.ts";
import { obsidian } from "./obsidian.ts";
import type { McpAdapter } from "../types.ts";

export const adapters: Record<string, McpAdapter> = {
  figma,
  jira,
  notion,
  obsidian,
};
