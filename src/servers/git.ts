import fs from "node:fs";
import path from "node:path";
import { getEnv } from "../env.ts";
import { pollPort } from "../health.ts";
import { commandExists } from "../platform.ts";
import { startNpx, stopProcess } from "../process.ts";
import { installApp } from "../install.ts";
import type { McpAdapter } from "../types.ts";

const PORT = 3106;

function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

export const git: McpAdapter = {
  id: "git",
  title: "Git",
  port: PORT,
  url: `http://127.0.0.1:${PORT}/mcp`,
  requiredEnv: [{ key: "GIT_REPO_PATH", label: "Git repo klasör yolu (içinde .git olan dizin)" }],

  async detect() {
    if (!(await commandExists("git"))) {
      return { ok: false, message: "git komutu yok" };
    }
    if (!(await commandExists("uvx"))) {
      return { ok: false, message: "uv (uvx) yok — Git MCP için gerekli" };
    }
    return { ok: true, message: "Local Git MCP (repo yolu)" };
  },

  async install() {
    if (!(await commandExists("git"))) {
      const ok = await installApp("Git", ["install", "git"], "Git.Git", "https://git-scm.com/downloads", "git");
      if (!ok) return { ok: false, message: "Git kurulmadı" };
    }
    if (!(await commandExists("uvx"))) {
      const ok = await installApp("uv", ["install", "uv"], "astral-sh.uv", "https://docs.astral.sh/uv/getting-started/installation/");
      if (!ok) return { ok: false, message: "uv kurulmadı" };
    }
    return { ok: true };
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
    await startNpx("git", [
      "supergateway",
      "--stdio",
      `uvx mcp-server-git --repository ${JSON.stringify(repo)}`,
      "--port",
      String(this.port),
      "--host",
      "127.0.0.1",
      "--outputTransport",
      "streamableHttp",
    ]);
    if (!(await pollPort(this.port, 45_000))) {
      throw new Error("Git MCP ayağa kalkmadı. .run/git.log dosyasına bakın.");
    }
  },

  async stop() {
    await stopProcess("git", this.port);
  },

  async health() {
    return pollPort(this.port, 500, 100);
  },
};
