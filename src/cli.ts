import { connectClients, CLIENTS, type ClientId } from "./clients.ts";
import { nodeOk } from "./doctor.ts";
import { disable, enable, enabledIds, loadCatalog, resolveIds } from "./registry.ts";
import { isRunning } from "./process.ts";
import { confirm, pickMany } from "./prompt.ts";
import { maybePersistEnable, prepareAdapters, runSetup } from "./setup.ts";
import type { McpAdapter } from "./types.ts";

function help(): void {
  console.log(`Air — local MCP orkestratörü

Kullanım:
  npx air setup
  npx air list
  npx air enable <id...>
  npx air disable <id...>
  npx air start [id...]
  npx air stop [id...]
  npx air status
  npx air doctor [id...]
  npx air connect [--client cursor|lmstudio|claude-desktop|claude-code|opencode] [--write] [--print]

Örnek:
  npx air enable figma
  npx air start figma
  npx air connect --client cursor --write
`);
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--continue-on-error" || a === "--write" || a === "--print") {
      flags.add(a);
    } else if (a === "--client" && argv[i + 1]) {
      values.client = argv[++i];
    } else if (a.startsWith("--")) {
      throw new Error(`Bilinmeyen bayrak: ${a}`);
    } else {
      rest.push(a);
    }
  }
  return { flags, values, rest };
}

async function runningAdapters(): Promise<McpAdapter[]> {
  const out: McpAdapter[] = [];
  for (const adapter of resolveIds(loadCatalog().map((s) => s.id))) {
    if (await isRunning(adapter.id, adapter.port)) out.push(adapter);
  }
  return out;
}

async function chooseStartIds(explicit: string[]): Promise<string[]> {
  if (explicit.length) return explicit;
  const enabled = enabledIds();
  const catalog = loadCatalog();
  const pool = enabled.length ? catalog.filter((s) => enabled.includes(s.id)) : catalog;
  const picked = await pickMany("Hangilerini şimdi başlatayım?", pool.map((s) => ({ id: s.id, title: s.title })));
  if (!enabled.length && picked.length) await maybePersistEnable(picked);
  return picked;
}

async function startCommand(ids: string[], continueOnError: boolean): Promise<void> {
  const selected = await chooseStartIds(ids);
  if (!selected.length) {
    console.log("Sunucu seçilmedi.");
    return;
  }
  const adapters = resolveIds(selected);
  const ready = await prepareAdapters(adapters);
  if (!ready.length) {
    console.log("Başlatılacak sunucu yok. Bilgileri düzeltmek için: npx air setup");
    return;
  }
  for (const adapter of ready) {
    try {
      console.log(`\n${adapter.title} başlatılıyor → ${adapter.url}`);
      await adapter.start();
      const ok = await adapter.health();
      if (!ok) throw new Error("Health check başarısız.");
      console.log(`${adapter.title} hazır.`);
    } catch (error) {
      console.error(`${adapter.title}: ${error instanceof Error ? error.message : String(error)}`);
      if (!continueOnError) process.exitCode = 1;
      if (!continueOnError) return;
    }
  }
}

async function stopCommand(ids: string[]): Promise<void> {
  const explicit = ids.length > 0;
  const running = await runningAdapters();
  const targets = explicit ? resolveIds(ids) : running.filter((a) => a.id !== "figma");
  if (!explicit && running.some((a) => a.id === "figma")) {
    console.log("Figma Desktop açık bırakıldı (Air kapatmaz). Kapatmak için Figma uygulamasını kapatın.");
  }
  if (!targets.length) {
    if (!running.length) console.log("Çalışan sunucu yok.");
    return;
  }
  for (const adapter of targets) {
    if (adapter.id === "figma") {
      console.log("Figma Desktop Air ile kapanmaz. Kapatmak için Figma uygulamasını kapatın.");
      continue;
    }
    await adapter.stop();
    const still = await adapter.health();
    if (still) console.log(`${adapter.title} hâlâ ayakta. .run/${adapter.id}.log dosyasına bakın.`);
    else console.log(`${adapter.title} durduruldu.`);
  }
}

async function listCommand(): Promise<void> {
  const enabled = new Set(enabledIds());
  console.log("id\tbaşlık\tdurum");
  for (const entry of loadCatalog()) {
    const adapter = resolveIds([entry.id])[0];
    const running = await isRunning(adapter.id, adapter.port);
    const flags = [enabled.has(entry.id) ? "enabled" : "disabled", running ? "running" : "stopped"];
    console.log(`${entry.id}\t${entry.title}\t${flags.join(",")}`);
  }
}

async function statusCommand(): Promise<void> {
  const running = await runningAdapters();
  if (!running.length) {
    console.log("Ayakta sunucu yok.");
    return;
  }
  for (const adapter of running) {
    console.log(`${adapter.id}\t${adapter.url}`);
  }
}

async function doctorCommand(ids: string[]): Promise<void> {
  const node = nodeOk();
  console.log(node.message);
  const targets = ids.length ? resolveIds(ids) : resolveIds(loadCatalog().map((s) => s.id));
  for (const adapter of targets) {
    const result = await adapter.detect();
    console.log(`${adapter.id}: ${result.ok ? "ok" : "eksik"} ${result.message ?? ""}`.trim());
  }
}

async function connectCommand(values: Record<string, string>, flags: Set<string>): Promise<void> {
  const running = await runningAdapters();
  let clientIds: ClientId[];
  if (values.client) {
    if (!CLIENTS.some((c) => c.id === values.client)) {
      throw new Error(`Bilinmeyen istemci: ${values.client}`);
    }
    clientIds = [values.client as ClientId];
  } else {
    clientIds = (await pickMany(
      "Hangi istemcilere bağlanayım?",
      CLIENTS.map((c) => ({ id: c.id, title: c.title })),
    )) as ClientId[];
  }
  if (!clientIds.length) return;
  await connectClients(clientIds, running, {
    write: flags.has("--write"),
    print: flags.has("--print"),
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? "help";
  const { flags, values, rest } = parseArgs(argv.slice(1));

  switch (command) {
    case "help":
    case "-h":
    case "--help":
      help();
      return;
    case "setup":
      try {
        await runSetup();
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        console.log("Kurulum durmadı. Tekrar deneyebilirsiniz.");
      }
      try {
        if (await confirm("Şimdi başlatayım mı?", false)) {
          await startCommand(enabledIds(), true);
        }
        if (await confirm("Bir istemciye bağlayayım mı?", false)) {
          await connectCommand({}, flags);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        console.log("Devam etmek için: npx air setup");
      }
      return;
    case "list":
      await listCommand();
      return;
    case "enable":
      if (!rest.length) throw new Error("air enable <id...>");
      enable(rest);
      console.log(`Açık: ${enabledIds().join(", ") || "(yok)"}`);
      return;
    case "disable":
      if (!rest.length) throw new Error("air disable <id...>");
      disable(rest);
      console.log(`Açık: ${enabledIds().join(", ") || "(yok)"}`);
      return;
    case "start":
      await startCommand(rest, flags.has("--continue-on-error"));
      return;
    case "stop":
      await stopCommand(rest);
      return;
    case "status":
      await statusCommand();
      return;
    case "doctor":
      await doctorCommand(rest);
      return;
    case "connect":
      await connectCommand(values, flags);
      return;
    default:
      throw new Error(`Bilinmeyen komut: ${command}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
