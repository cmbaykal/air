import path from "node:path";
import { connectClients, CLIENTS, CONTENT_CLIENTS, isContentClient, type ClientId, type ContentClientId } from "./clients.ts";
import { nodeOk } from "./doctor.ts";
import { applyListenPort, resolveListenPort } from "./ports.ts";
import { catalogPort, disable, enable, enabledIds, loadCatalog, resolveIds } from "./registry.ts";
import { isRunning } from "./process.ts";
import { confirm, pickMany } from "./prompt.ts";
import { addRule, listRules, removeRule } from "./rules.ts";
import { addSkill, listSkills, removeSkill } from "./skills.ts";
import { maybePersistEnable, prepareAdapters, runSetupWizard } from "./setup.ts";
import type { McpAdapter } from "./types.ts";

function help(): void {
  console.log(`Air — local MCP orkestratörü

Kullanım:
  air setup
  air list
  air enable <id...>
  air disable <id...>
  air start [id...]
  air stop [id...]
  air status
  air doctor [id...]
  air connect [--client cursor|lmstudio|claude-desktop|claude-code|opencode] [--write] [--print]
  air skill add <url> [--client cursor|claude-code|opencode] [--project [dir]] [--write] [--print]
  air skill list
  air skill remove <id> [--client ...] [--project [dir]]
  air rule add <url> [--client cursor|claude-code|opencode] [--project [dir]] [--write] [--print]
  air rule list
  air rule remove <id> [--client ...] [--project [dir]]

Örnek:
  air enable figma
  air start figma
  air connect --client cursor --write
  air skill add https://raw.githubusercontent.com/org/repo/main/SKILL.md --write
  air rule add https://example.com/style.md --project --write
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
    } else if (a === "--project") {
      flags.add("--project");
      if (argv[i + 1] && !argv[i + 1].startsWith("-")) {
        values.project = path.resolve(argv[++i]);
      } else {
        values.project = process.cwd();
      }
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
    console.log("Başlatılacak sunucu yok. Bilgileri düzeltmek için: air setup");
    return;
  }
  for (const adapter of ready) {
    try {
      const preferred = catalogPort(adapter.id);
      const { port, fallback } = await resolveListenPort(adapter.id, preferred, Boolean(adapter.fixedPort));
      applyListenPort(adapter, port);
      console.log(`\n${adapter.title} başlatılıyor → ${adapter.url}`);
      if (fallback) {
        console.log(`${adapter.title}: ${preferred} dolu, ${port} kullanılıyor.`);
      }
      if (await adapter.health()) {
        console.log(`${adapter.title} zaten ayakta.`);
        continue;
      }
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

async function chooseContentClients(explicit?: string): Promise<ContentClientId[]> {
  if (explicit) {
    if (!isContentClient(explicit)) {
      throw new Error(`Bu istemci skill/kural desteklemez: ${explicit}`);
    }
    return [explicit];
  }
  return (await pickMany(
    "Hangi istemcilere yazayım?",
    CONTENT_CLIENTS.map((c) => ({ id: c.id, title: c.title })),
  )) as ContentClientId[];
}

function contentOpts(flags: Set<string>, values: Record<string, string>) {
  return {
    project: flags.has("--project") ? values.project : null,
    write: flags.has("--write"),
    print: flags.has("--print"),
  };
}

async function skillCommand(rest: string[], flags: Set<string>, values: Record<string, string>): Promise<void> {
  const sub = rest[0];
  const opts = contentOpts(flags, values);
  if (sub === "list") {
    const items = listSkills();
    if (!items.length) {
      console.log("Kayıtlı skill yok.");
      return;
    }
    for (const item of items) console.log(`${item.id}\t${item.name}\t${item.url}`);
    return;
  }
  if (sub === "remove") {
    if (!rest[1]) throw new Error("air skill remove <id>");
    const clients = values.client
      ? await chooseContentClients(values.client)
      : CONTENT_CLIENTS.map((c) => c.id);
    const removed = removeSkill(rest[1], opts.project, clients);
    if (!removed.length) console.log("Silinecek dosya yok.");
    for (const dest of removed) console.log(`Silindi: ${dest}`);
    return;
  }
  if (sub === "add") {
    if (!rest[1]) throw new Error("air skill add <url>");
    const clients = await chooseContentClients(values.client);
    if (!clients.length) return;
    await addSkill(rest[1], clients, opts);
    return;
  }
  throw new Error("air skill add <url> | list | remove <id>");
}

async function ruleCommand(rest: string[], flags: Set<string>, values: Record<string, string>): Promise<void> {
  const sub = rest[0];
  const opts = contentOpts(flags, values);
  if (sub === "list") {
    const items = listRules();
    if (!items.length) {
      console.log("Kayıtlı kural yok.");
      return;
    }
    for (const item of items) console.log(`${item.id}\t${item.name}\t${item.url}`);
    return;
  }
  if (sub === "remove") {
    if (!rest[1]) throw new Error("air rule remove <id>");
    const clients = values.client
      ? await chooseContentClients(values.client)
      : CONTENT_CLIENTS.map((c) => c.id);
    const removed = removeRule(rest[1], opts.project, clients);
    if (!removed.length) console.log("Silinecek dosya yok.");
    for (const dest of removed) console.log(`Silindi: ${dest}`);
    return;
  }
  if (sub === "add") {
    if (!rest[1]) throw new Error("air rule add <url>");
    const clients = await chooseContentClients(values.client);
    if (!clients.length) return;
    await addRule(rest[1], clients, opts);
    return;
  }
  throw new Error("air rule add <url> | list | remove <id>");
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
    case "setup": {
      let mcpIds: string[] = [];
      try {
        mcpIds = (await runSetupWizard()).mcp;
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        console.log("Kurulum durmadı. Tekrar deneyebilirsiniz.");
      }
      if (!mcpIds.length) return;
      try {
        if (await confirm("Şimdi başlatayım mı?", false)) {
          await startCommand(mcpIds, true);
        }
        if (await confirm("Bir istemciye bağlayayım mı?", false)) {
          await connectCommand({}, flags);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        console.log("Devam etmek için: air setup");
      }
      return;
    }
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
    case "skill":
      await skillCommand(rest, flags, values);
      return;
    case "rule":
      await ruleCommand(rest, flags, values);
      return;
    default:
      throw new Error(`Bilinmeyen komut: ${command}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
