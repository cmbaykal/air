import { CONTENT_CLIENTS, type ContentClientId } from "./clients.ts";
import { nodeOk } from "./doctor.ts";
import { ensureFields, getEnv, loadEnvFile } from "./env.ts";
import { enable, enabledIds, loadCatalog, resolveIds } from "./registry.ts";
import { ask, confirm, pickMany } from "./prompt.ts";
import { addRule } from "./rules.ts";
import { addSkill } from "./skills.ts";
import type { McpAdapter } from "./types.ts";

async function prepareOne(adapter: McpAdapter, reusePrompt: boolean): Promise<boolean> {
  console.log(`\n→ ${adapter.title}`);
  if (adapter.detect) {
    const detected = await adapter.detect();
    if (!detected.ok) {
      console.log(detected.message ?? "Eksik.");
      const installed = adapter.install ? await adapter.install() : { ok: false };
      if (!installed.ok) {
        console.log(installed.message ?? `${adapter.title} kurulamadı. Bu sunucu atlandı.`);
        return false;
      }
    } else if (detected.message) {
      console.log(detected.message);
    }
  }

  let force = false;
  if (reusePrompt && adapter.requiredEnv.some((field) => getEnv(field.key))) {
    if (!(await confirm(`${adapter.title} için kayıtlı bilgileri kullanayım mı?`, true))) {
      force = true;
    }
  }
  for (;;) {
    await ensureFields(adapter.requiredEnv, force);
    if (!adapter.validateEnv) return true;
    const valid = await adapter.validateEnv();
    if (valid.ok) return true;
    console.log(valid.message ?? `${adapter.title} doğrulanamadı.`);
    if (!(await confirm("Bilgileri tekrar gireyim mi?", true))) {
      console.log(`${adapter.title} atlandı.`);
      return false;
    }
    force = true;
  }
}

export async function prepareAdapters(adapters: McpAdapter[], reusePrompt = false): Promise<McpAdapter[]> {
  loadEnvFile();
  const node = nodeOk();
  if (!node.ok) {
    console.log(node.message);
    return [];
  }
  const ready: McpAdapter[] = [];
  for (const adapter of adapters) {
    try {
      if (await prepareOne(adapter, reusePrompt)) ready.push(adapter);
    } catch (error) {
      console.log(`${adapter.title}: ${error instanceof Error ? error.message : String(error)}`);
      if (await confirm("Bu sunucuyu atlayıp devam edeyim mi?", true)) continue;
      console.log("Kurulumda kaldığınız yerden devam edebilirsiniz: air setup");
      return ready;
    }
  }
  return ready;
}

export async function runSetup(): Promise<string[]> {
  const catalog = loadCatalog();
  const already = new Set(enabledIds());
  const picked = await pickMany(
    "Bu projede hangi MCP sunucuları açık olsun?",
    catalog.map((s) => ({
      id: s.id,
      title: already.has(s.id) ? `${s.title} (açık)` : s.title,
    })),
  );
  if (picked.length === 0) {
    console.log("Hiç sunucu seçilmedi.");
    return [];
  }
  enable(picked);
  const ready = await prepareAdapters(resolveIds(picked), true);
  if (ready.length) console.log("\nKurulum tamam. Başlatmak için: air start");
  else console.log("\nKurulumda doğrulanan sunucu yok. Tekrar: air setup");
  return ready.map((a) => a.id);
}

async function setupFromUrl(kind: "skill" | "rule"): Promise<void> {
  const url = await ask(kind === "skill" ? "Skill URL" : "Kural URL");
  if (!url) {
    console.log("URL girilmedi.");
    return;
  }
  const clients = (await pickMany(
    "Hangi istemcilere yazayım?",
    CONTENT_CLIENTS.map((c) => ({ id: c.id, title: c.title })),
  )) as ContentClientId[];
  if (!clients.length) return;
  const opts = { project: null, write: false, print: false };
  if (kind === "skill") await addSkill(url, clients, opts);
  else await addRule(url, clients, opts);
}

export async function runSetupWizard(): Promise<string[]> {
  const kinds = await pickMany("Ne ekleyelim?", [
    { id: "mcp", title: "MCP sunucusu" },
    { id: "skill", title: "Skill" },
    { id: "rule", title: "Kural" },
  ]);
  if (!kinds.length) {
    console.log("Hiçbir şey seçilmedi.");
    return [];
  }
  let mcp: string[] = [];
  if (kinds.includes("mcp")) mcp = await runSetup();
  if (kinds.includes("skill")) await setupFromUrl("skill");
  if (kinds.includes("rule")) await setupFromUrl("rule");
  return mcp;
}

export async function maybePersistEnable(ids: string[]): Promise<void> {
  const current = new Set(enabledIds());
  const fresh = ids.filter((id) => !current.has(id));
  if (fresh.length === 0) return;
  if (await confirm(`${fresh.join(", ")} kalıcı olarak açılsın mı?`, true)) {
    enable(fresh);
  }
}
