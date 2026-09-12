import fs from "node:fs";
import path from "node:path";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { commandExists } from "../platform.ts";
import { installApp } from "../install.ts";
import { detectUvx, ensureUvx } from "../uvx.ts";
import type { McpAdapter } from "../types.ts";

function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

export const git: McpAdapter = {
  id: "git",
  title: "Git",
  port: 0,
  url: "",
  requiredEnv: [{ key: "GIT_REPO_PATH", label: "Git repo klasör yolu (içinde .git olan dizin)" }],

  async detect() {
    if (!(await commandExists("git"))) {
      return { ok: false, message: "git komutu yok" };
    }
    return detectUvx("Git MCP");
  },

  async install() {
    if (!(await commandExists("git"))) {
      const ok = await installApp("Git", ["install", "git"], "Git.Git", {
        downloadUrl: "https://git-scm.com/downloads",
        linuxPkg: "git",
      });
      if (!ok) return { ok: false, message: "Git kurulmadı" };
    }
    return ensureUvx();
  },

  async validateEnv() {
    const repo = getEnv("GIT_REPO_PATH");
    if (!repo) return { ok: false, message: "Repo yolu boş." };
    if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) {
      return { ok: false, message: "Bu yol bir klasör değil." };
    }
    if (!isGitRepo(repo)) {
      return { ok: false, message: `${repo} bir git repo değil (.git yok).` };
    }
    return { ok: true };
  },

  async start() {
    const repo = getEnv("GIT_REPO_PATH");
    await startGateway(
      "git",
      `uvx mcp-server-git --repository ${JSON.stringify(repo)}`,
      {},
      this.port,
      { timeoutMs: 45_000 },
    );
  },

  async stop() {
    await stopGateway("git", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
