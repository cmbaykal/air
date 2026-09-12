import { fillAndValidateEnv, getEnv, loadEnvFile } from "./env.ts";
import { brewAvailable, ensureHomebrew, installApp } from "./install.ts";
import { commandExists, isLinux, isMac, isWin } from "./platform.ts";
import { isRunning } from "./process.ts";
import { confirm } from "./prompt.ts";
import { enabledIds, loadCatalog, resolveIds } from "./registry.ts";
import type { DetectResult, McpAdapter } from "./types.ts";

export type DoctorKind = "node" | "brew" | "winget" | "detect" | "env" | "health";

export interface DoctorIssue {
  id: string;
  title: string;
  kind: DoctorKind;
  message: string;
  adapter?: McpAdapter;
}

export function nodeOk(): DetectResult {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) {
    return { ok: false, message: `Node 20+ gerekli (şu an ${process.versions.node}).` };
  }
  return { ok: true, message: `Node ${process.versions.node}` };
}

export function missingEnvKeys(adapter: McpAdapter): string[] {
  return adapter.requiredEnv.filter((field) => !getEnv(field.key)).map((field) => field.key);
}

export function envConfigured(adapter: McpAdapter): boolean {
  return adapter.requiredEnv.some((field) => Boolean(getEnv(field.key)));
}

function shouldCheckEnv(adapter: McpAdapter, enabled: Set<string>): boolean {
  if (!adapter.requiredEnv.length) return false;
  return enabled.has(adapter.id) || envConfigured(adapter);
}

function printLine(id: string, ok: boolean, message = ""): void {
  const status = ok ? "ok" : "eksik";
  console.log(`${id}: ${status}${message ? ` ${message}` : ""}`.trim());
}

async function collectAdapterIssues(adapter: McpAdapter, enabled: Set<string>): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];
  if (adapter.detect) {
    const detected = await adapter.detect();
    printLine(adapter.id, detected.ok, detected.message);
    if (!detected.ok) {
      issues.push({
        id: adapter.id,
        title: adapter.title,
        kind: "detect",
        message: detected.message ?? "bağımlılık eksik",
        adapter,
      });
    }
  } else if (!adapter.requiredEnv.length) {
    printLine(adapter.id, true, "bağımlılık kontrolü yok");
  }

  if (shouldCheckEnv(adapter, enabled)) {
    const missing = missingEnvKeys(adapter);
    if (missing.length) {
      const message = `env eksik: ${missing.join(", ")}`;
      if (!adapter.detect) printLine(adapter.id, false, message);
      else console.log(`${adapter.id}: eksik ${message}`);
      issues.push({ id: adapter.id, title: adapter.title, kind: "env", message, adapter });
    } else if (adapter.validateEnv) {
      const valid = await adapter.validateEnv();
      if (!valid.ok) {
        const message = valid.message ?? "doğrulama başarısız";
        if (!adapter.detect) printLine(adapter.id, false, message);
        else console.log(`${adapter.id}: eksik ${message}`);
        issues.push({ id: adapter.id, title: adapter.title, kind: "env", message, adapter });
      } else if (!adapter.detect) {
        printLine(adapter.id, true, valid.message ?? "env ok");
      }
    } else if (!adapter.detect) {
      printLine(adapter.id, true, "env ok");
    }
  } else if (!adapter.detect && adapter.requiredEnv.length) {
    printLine(adapter.id, true, "kapalı (env yok)");
  }

  if (await isRunning(adapter.id, adapter.port)) {
    const healthy = await adapter.health();
    if (!healthy) {
      console.log(`${adapter.id}: eksik ayakta ama yanıt yok`);
      issues.push({
        id: adapter.id,
        title: adapter.title,
        kind: "health",
        message: "ayakta ama yanıt yok",
        adapter,
      });
    }
  }
  return issues;
}

export async function collectDoctorIssues(ids: string[]): Promise<DoctorIssue[]> {
  loadEnvFile();
  const issues: DoctorIssue[] = [];
  const enabled = new Set(enabledIds());

  const node = nodeOk();
  printLine("node", node.ok, node.message);
  if (!node.ok) {
    issues.push({ id: "node", title: "Node.js", kind: "node", message: node.message ?? "Node 20+ yok" });
  }

  if (isMac || isLinux) {
    const brew = await brewAvailable();
    printLine("brew", brew, brew ? "Homebrew" : "Homebrew yok");
    if (!brew) {
      issues.push({ id: "brew", title: "Homebrew", kind: "brew", message: "Homebrew yok" });
    }
  } else if (isWin) {
    const winget = await commandExists("winget");
    printLine("winget", winget, winget ? "winget" : "winget yok");
    if (!winget) {
      issues.push({ id: "winget", title: "winget", kind: "winget", message: "winget yok" });
    }
  }

  const catalogIds = loadCatalog().map((s) => s.id);
  const targets = ids.length ? resolveIds(ids) : resolveIds(catalogIds);
  for (const adapter of targets) {
    issues.push(...(await collectAdapterIssues(adapter, enabled)));
  }
  return issues;
}

async function fixNode(): Promise<boolean> {
  const ok = await installApp("Node.js", ["install", "node"], "OpenJS.NodeJS.LTS", {
    linuxPkg: { apt: "nodejs", dnf: "nodejs", pacman: "nodejs", zypper: "nodejs" },
  });
  if (!ok) return false;
  if (!nodeOk().ok) {
    console.log("Node kuruldu. Bu süreç eski sürümü kullanıyor; yeni terminalde tekrar: air doctor");
  }
  return true;
}

async function fixIssue(issue: DoctorIssue): Promise<boolean> {
  if (issue.kind === "node") return fixNode();
  if (issue.kind === "brew") return ensureHomebrew(true);
  if (issue.kind === "winget") {
    console.log("winget, App Installer ile gelir. Microsoft Store'dan App Installer kurun.");
    return false;
  }
  const adapter = issue.adapter;
  if (!adapter) return false;
  if (issue.kind === "detect") {
    if (!adapter.install) {
      console.log(`${adapter.title} için otomatik kurulum yok.`);
      return false;
    }
    const installed = await adapter.install();
    if (!installed.ok) {
      console.log(installed.message ?? `${adapter.title} kurulamadı.`);
      return false;
    }
    if (installed.message) console.log(installed.message);
    if (!adapter.detect) return true;
    const again = await adapter.detect();
    if (!again.ok) {
      console.log(again.message ?? `${adapter.title} hâlâ eksik.`);
      return false;
    }
    return true;
  }
  if (issue.kind === "env") return fillAndValidateEnv(adapter, true);
  if (issue.kind === "health") {
    await adapter.stop();
    await adapter.start();
    return adapter.health();
  }
  return false;
}

export async function runDoctor(ids: string[]): Promise<void> {
  const issues = await collectDoctorIssues(ids);
  if (!issues.length) {
    console.log("\nSorun yok.");
    return;
  }
  console.log(`\n${issues.length} sorun:`);
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.message}`);
  }
  let fixed = 0;
  let skipped = 0;
  let failed = 0;
  for (const issue of issues) {
    if (!(await confirm(`${issue.title}: ${issue.message}. Düzelteyim mi?`, true))) {
      skipped += 1;
      continue;
    }
    try {
      if (await fixIssue(issue)) {
        console.log(`${issue.title}: düzeltildi.`);
        fixed += 1;
      } else {
        console.log(`${issue.title}: düzeltilemedi.`);
        failed += 1;
      }
    } catch (error) {
      console.log(`${issue.title}: ${error instanceof Error ? error.message : String(error)}`);
      failed += 1;
    }
  }
  console.log(`\nDüzeltildi: ${fixed}. Atlandı: ${skipped}. Olamadı: ${failed}.`);
}
