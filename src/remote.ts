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

function parseGithubTree(url: string): { owner: string; repo: string; ref: string; dir: string } | null {
  const tree = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.*)$/i);
  if (!tree) return null;
  const [, owner, repo, ref, dir] = tree;
  return { owner, repo, ref, dir: dir.replace(/\/+$/, "") };
}

async function fetchOk(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "air-mcp" } });
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
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(api, { headers: { "User-Agent": "air-mcp", Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub klasörü alınamadı (${res.status}): ${dir}`);
  const items = (await res.json()) as { type: string; name: string; path: string; download_url?: string }[];
  if (!Array.isArray(items)) throw new Error("GitHub klasör yanıtı beklenmedik.");
  const files: FetchedFile[] = [];
  for (const item of items) {
    if (item.type === "dir") {
      files.push(...(await fetchGithubDir(owner, repo, ref, item.path)));
      continue;
    }
    if (item.type !== "file" || !item.download_url) continue;
    const content = await fetchOk(item.download_url);
    const prefix = dir.replace(/\/+$/, "");
    const relativePath = item.path.startsWith(`${prefix}/`) ? item.path.slice(prefix.length + 1) : item.name;
    files.push({ relativePath, content });
  }
  return files;
}

export async function fetchText(url: string): Promise<string> {
  return fetchOk(toRawUrl(url));
}

export async function fetchSkillSources(url: string): Promise<FetchedFile[]> {
  const tree = parseGithubTree(url);
  if (tree) {
    const files = await fetchGithubDir(tree.owner, tree.repo, tree.ref, tree.dir);
    if (!files.some((f) => /(^|\/)SKILL\.md$/i.test(f.relativePath))) {
      throw new Error("Bu klasörde SKILL.md yok.");
    }
    return files;
  }
  const content = await fetchText(url);
  return [{ relativePath: "SKILL.md", content }];
}
