import { nodeOk } from "./doctor.ts";
import { ensureFields, loadEnvFile } from "./env.ts";
import { enable, enabledIds, loadCatalog, resolveIds } from "./registry.ts";
import { confirm, pickMany } from "./prompt.ts";
import type { McpAdapter } from "./types.ts";

export async function prepareAdapters(adapters: McpAdapter[]): Promise<void> {
  loadEnvFile();
  const node = nodeOk();
  if (!node.ok) throw new Error(node.message);
  for (const adapter of adapters) {
    console.log(`\n→ ${adapter.title}`);
    const detected = await adapter.detect();
    if (!detected.ok) {
      console.log(detected.message ?? "Eksik.");
      const installed = await adapter.install();
      if (!installed.ok) throw new Error(installed.message ?? `${adapter.title} kurulamadı.`);
    } else if (detected.message) {
      console.log(detected.message);
    }
    await ensureFields(adapter.requiredEnv);
    if (adapter.validateEnv) {
      const valid = await adapter.validateEnv();
      if (!valid.ok) throw new Error(valid.message ?? `${adapter.title} doğrulanamadı.`);
    }
  }
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
  await prepareAdapters(resolveIds(picked));
  console.log("\nKurulum tamam. Başlatmak için: npx air start");
  return picked;
}

export async function maybePersistEnable(ids: string[]): Promise<void> {
  const current = new Set(enabledIds());
  const fresh = ids.filter((id) => !current.has(id));
  if (fresh.length === 0) return;
  if (await confirm(`${fresh.join(", ")} kalıcı olarak açılsın mı?`, true)) {
    enable(fresh);
  }
}
