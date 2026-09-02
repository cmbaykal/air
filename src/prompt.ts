import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function withRl<T>(fn: (rl: readline.Interface) => Promise<T>): Promise<T> {
  const rl = readline.createInterface({ input, output });
  try {
    return await fn(rl);
  } finally {
    rl.close();
  }
}

export async function ask(question: string, def = ""): Promise<string> {
  return withRl(async (rl) => {
    const suffix = def ? ` [${def}]` : "";
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || def;
  });
}

export async function confirmWrite(
  title: string,
  dest: string,
  write: boolean,
  noun: "dizin" | "dosya",
): Promise<boolean> {
  console.log(`\n=== ${title} ===\n${dest}`);
  return write || (await confirm(`${dest} ${noun}ine yazayım mı?`, true));
}

export async function confirm(question: string, def = true): Promise<boolean> {
  const hint = def ? "E/h" : "e/H";
  const answer = (await ask(`${question} [${hint}]`)).toLowerCase();
  if (!answer) return def;
  return answer === "e" || answer === "y" || answer === "evet";
}

export async function pickMany(title: string, options: { id: string; title: string }[]): Promise<string[]> {
  if (options.length === 0) return [];
  console.log(`\n${title}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt.title} (${opt.id})`));
  const raw = await ask("Numara gir (örn. 1 3), a=hepsi, q=hiçbiri");
  if (!raw || raw.toLowerCase() === "q") return [];
  if (raw.toLowerCase() === "a") return options.map((o) => o.id);
  const ids: string[] = [];
  for (const token of raw.split(/[\s,]+/)) {
    const n = Number(token);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) {
      ids.push(options[n - 1].id);
    } else if (options.some((o) => o.id === token)) {
      ids.push(token);
    }
  }
  return [...new Set(ids)];
}
