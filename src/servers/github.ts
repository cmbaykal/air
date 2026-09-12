import fs from "node:fs";
import path from "node:path";
import { getEnv } from "../env.ts";
import { isHealthy, startGateway, stopGateway } from "../gateway.ts";
import { installApp } from "../install.ts";
import { BIN_DIR, ensureDir } from "../paths.ts";
import { commandExists, isLinux, isMac, isWin, runInteractive } from "../platform.ts";
import { USER_AGENT } from "../remote.ts";
import type { McpAdapter } from "../types.ts";

const BIN_NAME = isWin ? "github-mcp-server.exe" : "github-mcp-server";

function localBinPath(): string {
  return path.join(BIN_DIR, BIN_NAME);
}

function releaseAsset(): string {
  const arm = process.arch === "arm64";
  if (isMac) return arm ? "github-mcp-server_Darwin_arm64.tar.gz" : "github-mcp-server_Darwin_x86_64.tar.gz";
  if (isWin) return arm ? "github-mcp-server_Windows_arm64.zip" : "github-mcp-server_Windows_x86_64.zip";
  if (arm) return "github-mcp-server_Linux_arm64.tar.gz";
  if (process.arch === "ia32") return "github-mcp-server_Linux_i386.tar.gz";
  return "github-mcp-server_Linux_x86_64.tar.gz";
}

function findDownloadedBin(dir: string): string | null {
  const direct = path.join(dir, BIN_NAME);
  if (fs.existsSync(direct)) return direct;
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      const nested = path.join(full, BIN_NAME);
      if (fs.existsSync(nested)) return nested;
    }
    if (name === "github-mcp-server" || name === "github-mcp-server.exe") return full;
  }
  return null;
}

async function downloadOfficialBinary(): Promise<boolean> {
  const asset = releaseAsset();
  const url = `https://github.com/github/github-mcp-server/releases/latest/download/${asset}`;
  console.log(`Resmi yerel binary indiriliyor: ${asset}`);
  ensureDir(BIN_DIR);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
  } catch (error) {
    console.log(`İndirilemedi: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
  if (!res.ok) {
    console.log(`İndirilemedi (${res.status}): ${url}`);
    return false;
  }
  const archive = path.join(BIN_DIR, asset);
  fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  const code = await runInteractive("tar", ["-xf", archive, "-C", BIN_DIR]);
  fs.rmSync(archive, { force: true });
  if (code !== 0) return false;
  const found = findDownloadedBin(BIN_DIR);
  if (!found) return false;
  if (found !== localBinPath()) fs.copyFileSync(found, localBinPath());
  if (!isWin) fs.chmodSync(localBinPath(), 0o755);
  return fs.existsSync(localBinPath());
}

async function hasLocalServer(): Promise<boolean> {
  if (await commandExists("github-mcp-server")) return true;
  return fs.existsSync(localBinPath());
}

function serverCommand(): string {
  if (fs.existsSync(localBinPath())) return `${JSON.stringify(localBinPath())} stdio`;
  return "github-mcp-server stdio";
}

export const github: McpAdapter = {
  id: "github",
  title: "GitHub",
  port: 0,
  url: "",
  requiredEnv: [
    {
      key: "GITHUB_PERSONAL_ACCESS_TOKEN",
      label: "GitHub personal access token (ghp_... veya github_pat_...)",
      secret: true,
      helpUrl: "https://github.com/settings/tokens",
    },
  ],

  async detect() {
    if (await hasLocalServer()) return { ok: true, message: "yerel github-mcp-server" };
    return { ok: false, message: "github-mcp-server yok (yerel binary; Docker/remote kullanılmaz)" };
  },

  async install() {
    if (isMac || isLinux) {
      await installApp("GitHub MCP (yerel)", ["install", "github-mcp-server"], "");
      if (await hasLocalServer()) return { ok: true, message: "yerel binary" };
    }
    if (await downloadOfficialBinary()) return { ok: true, message: "resmi GitHub release binary" };
    return { ok: false, message: "github-mcp-server kurulamadı. brew install github-mcp-server" };
  },

  async validateEnv() {
    const token = getEnv("GITHUB_PERSONAL_ACCESS_TOKEN");
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": USER_AGENT,
        },
      });
      if (res.ok) return { ok: true };
      const hint = res.status === 401 || res.status === 403 ? "Token hatalı veya yetkisiz." : "Token kontrol edin.";
      return { ok: false, message: `GitHub doğrulama başarısız (${res.status}). ${hint}` };
    } catch (error) {
      return { ok: false, message: `GitHub'a ulaşılamadı: ${String(error)}` };
    }
  },

  async start() {
    const token = getEnv("GITHUB_PERSONAL_ACCESS_TOKEN");
    await startGateway("github", serverCommand(), { GITHUB_PERSONAL_ACCESS_TOKEN: token }, this.port);
  },

  async stop() {
    await stopGateway("github", this.port);
  },

  async health() {
    return isHealthy(this.port);
  },
};
