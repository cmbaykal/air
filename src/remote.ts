export const USER_AGENT = "air";

export interface FetchedFile {
  relativePath: string;
  content: string;
}

export function slugFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "item";
    return slugify(last.replace(/\.(md|mdc)$/i, ""));
  } catch {
    return "item";
  }
}

export function slugify(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug) throw new Error("Geçersiz ad.");
  return slug;
}

export function toRawUrl(url: string): string {
  const blob = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  if (blob) {
    const [, owner, repo, ref, filePath] = blob;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
  }
  return url;
}

const SKIP_DIRS = new Set([".git", ".github", "node_modules", "marketing", "examples", "assets", "api", "agents"]);

export function parseGithubSource(url: string): { owner: string; repo: string; ref: string; dir: string } | null {
  const tree = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?$/i);
  if (tree) {
    const [, owner, repo, ref, dir] = tree;
    return { owner, repo, ref, dir: (dir ?? "").replace(/\/+$/, "") };
  }
  const repoOnly = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/i);
  if (repoOnly) {
    const [, owner, repo] = repoOnly;
    return { owner, repo, ref: "main", dir: "" };
  }
  return null;
}

export interface SkillFetchOpts {
  entry?: string;
  name?: string;
  description?: string;
}

async function fetchOk(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  } catch (error) {
    throw new Error(`İndirilemedi: ${url} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!res.ok) throw new Error(`İndirilemedi (${res.status}): ${url}`);
  return res.text();
}

async function fetchGithubDir(
  owner: string,
  repo: string,
  ref: string,
  dir: string,
): Promise<FetchedFile[]> {
  const base = dir ? `contents/${dir}` : "contents";
  const api = `https://api.github.com/repos/${owner}/${repo}/${base}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(api, { headers: { "User-Agent": USER_AGENT, Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub klasörü alınamadı (${res.status}): ${dir || repo}`);
  const items = (await res.json()) as { type: string; name: string; path: string; download_url?: string }[];
  if (!Array.isArray(items)) throw new Error("GitHub klasör yanıtı beklenmedik.");
  const files: FetchedFile[] = [];
  for (const item of items) {
    if (item.type === "dir") {
      if (SKIP_DIRS.has(item.name)) continue;
      files.push(...(await fetchGithubDir(owner, repo, ref, item.path)));
      continue;
    }
    if (item.type !== "file" || !item.download_url) continue;
    if (item.name === ".DS_Store") continue;
    const content = await fetchOk(item.download_url);
    const prefix = dir.replace(/\/+$/, "");
    const relativePath = prefix && item.path.startsWith(`${prefix}/`) ? item.path.slice(prefix.length + 1) : item.name;
    files.push({ relativePath, content });
  }
  return files;
}

function ensureSkillMd(files: FetchedFile[], opts?: SkillFetchOpts): FetchedFile[] {
  if (files.some((f) => /(^|\/)SKILL\.md$/i.test(f.relativePath))) return files;
  const entryName = opts?.entry ?? "index.md";
  const entry = files.find((f) => f.relativePath === entryName || f.relativePath.endsWith(`/${entryName}`));
  if (!entry || !opts?.name || !opts.description) {
    throw new Error("SKILL.md bulunamadı.");
  }
  const front = `---\nname: ${opts.name}\ndescription: ${opts.description}\n---\n\n`;
  const rest = files.filter((f) => f !== entry);
  return [{ relativePath: "SKILL.md", content: `${front}${entry.content}` }, ...rest];
}

export async function fetchText(url: string): Promise<string> {
  return fetchOk(toRawUrl(url));
}

export async function fetchSkillSources(url: string, opts?: SkillFetchOpts): Promise<FetchedFile[]> {
  const tree = parseGithubSource(url);
  if (tree) {
    const files = await fetchGithubDir(tree.owner, tree.repo, tree.ref, tree.dir);
    return ensureSkillMd(files, opts);
  }
  const content = await fetchText(url);
  return ensureSkillMd([{ relativePath: "SKILL.md", content }], opts);
}
