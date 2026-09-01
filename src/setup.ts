import { nodeOk } from "./doctor.ts";
import { ensureFields, loadEnvFile } from "./env.ts";
import { enable, enabledIds, loadCatalog, resolveIds } from "./registry.ts";
import { confirm, pickMany } from "./prompt.ts";
import type { McpAdapter } from "./types.ts";

async function prepareOne(adapter: McpAdapter): Promise<boolean> {
  console.log(`\n→ ${adapter.title}`);
  const detected = await adapter.detect();
  if (!detected.ok) {
    console.log(detected.message ?? "Eksik.");
    const installed = await adapter.install();
    if (!installed.ok) {
      console.log(installed.message ?? `${adapter.title} kurulamadı. Bu sunucu atlandı.`);
      return false;
    }
  } else if (detected.message) {
    console.log(detected.message);
  }

  let force = false;
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

export async function prepareAdapters(adapters: McpAdapter[]): Promise<McpAdapter[]> {
  loadEnvFile();
  const node = nodeOk();
  if (!node.ok) {
    console.log(node.message);
    return [];
  }
  const ready: McpAdapter[] = [];
  for (const adapter of adapters) {
    try {
      if (await prepareOne(adapter)) ready.push(adapter);
    } catch (error) {
      console.log(`${adapter.title}: ${error instanceof Error ? error.message : String(error)}`);
      if (await confirm("Bu sunucuyu atlayıp devam edeyim mi?", true)) continue;
      console.log("Kurulumda kaldığınız yerden devam edebilirsiniz: npx air setup");
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
  const ready = await prepareAdapters(resolveIds(picked));
  if (ready.length) console.log("\nKurulum tamam. Başlatmak için: npx air start");
  else console.log("\nKurulumda doğrulanan sunucu yok. Tekrar: npx air setup");
  return ready.map((a) => a.id);
}

export async function maybePersistEnable(ids: string[]): Promise<void> {
  const current = new Set(enabledIds());
  const fresh = ids.filter((id) => !current.has(id));
  if (fresh.length === 0) return;
  if (await confirm(`${fresh.join(", ")} kalıcı olarak açılsın mı?`, true)) {
    enable(fresh);
  }
}
