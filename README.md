# Air

Yerel MCP orkestratörü. Katalogdaki sunucuları kendi makinenizde çalıştırır; Cursor, Claude, LM Studio veya OpenCode localhost üzerinden bağlanır. Skill ve kural da yazılabilir.

Hiçbir sunucu varsayılan olarak açık değildir. macOS, Windows ve Linux. Node.js 20+ gerekir. `npm link` sonrası komut: `air` (`.env` Air klasöründedir).

Sunucular localhost’ta çalışır. GitHub MCP resmi `github-mcp-server` binary’sidir (`brew install github-mcp-server`); Docker veya `api.githubcopilot.com` remote MCP kullanılmaz.

## Kurulum

```bash
git clone https://github.com/cmbaykal/air.git
cd air
```

Node yoksa proje klasöründe:

- macOS: `./scripts/setup.macos.sh`
- Linux: `./scripts/setup.linux.sh`
- Windows: `powershell -ExecutionPolicy Bypass -File scripts/setup.windows.ps1`

Script Node 20+ yoksa sorarak kurar: macOS/Linux’ta öncelik Homebrew (`brew` yoksa onu da kurmayı önerir), Windows’ta winget. Siteye yönlendirme yalnızca onayla. Sonra `npm install`, `npm link`, `air setup`. MCP bağımlılıkları (github-mcp-server, Android Studio, Java, Maestro, …) de aynı sırayı izler.

Node varsa:

```bash
npm install
npm link
air setup
```

`setup` MCP / skill / kural sorar. Token’lar `.env` dosyasına yazılır.

## Kullanım

```bash
air start figma
air start figma jira
air start
air enable figma jira
air disable notion
air list
air status
air stop figma
air stop
air doctor
```

`air doctor` Node, Homebrew ve sunucu bağımlılıklarını kontrol eder; eksik veya hatalı olanlar için düzeltmeyi sorar.

`enable` süreci başlatmaz. `air start figma` enable olmasa da başlatır. `npm start` = `air start`.

Figma Desktop açılır; **Preferences → Enable Dev Mode MCP Server** açık olmalı.

## Bağlama

```bash
air connect
air connect --client cursor --write
```

`connect` yalnızca çalışan sunucuları ekler. Config’e yazmadan önce `.bak` alır; diğer MCP kayıtları silinmez.

| İstemci | Config |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| LM Studio | `~/.lmstudio/mcp.json` |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json` — Windows `%APPDATA%\Claude\claude_desktop_config.json` — Linux `~/.config/Claude/claude_desktop_config.json` |
| OpenCode | `~/.config/opencode/opencode.json` |
| Claude Code | `~/.claude.json` (`type: "http"`) |

Elle eklemek: `air connect --print` veya `examples/cursor.mcp.json` (Cursor / LM Studio / Claude Desktop aynı şema) ve `examples/opencode.json`.

## Skill ve kural

```bash
air skill packs
air skill add mobile --write
air skill add https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md --write
air skill list
air skill remove xlsx

air rule add https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md --project --write
air rule list
```

`air skill add mobile` hazır paketi yazar: Compose / CMP, Kotlin Compose, iOS (SwiftUI/Tuist). Paket listesi: `config/skill-packs.json`. `air setup` skill adımında paketi de sunar.

`--client` yoksa menü. `--write` onayı atlar. `--print` gösterir.

| | Cursor | Claude Code | OpenCode |
|---|---|---|---|
| Skill (genel) | `~/.cursor/skills/<ad>/` | `~/.claude/skills/<ad>/` | `~/.config/opencode/skills/<ad>/` |
| Skill (proje) | `.cursor/skills/<ad>/` | `.claude/skills/<ad>/` | `.opencode/skills/<ad>/` |
| Kural (genel) | `~/.cursor/rules/<id>.mdc` | `~/.claude/CLAUDE.md` | `~/.config/opencode/AGENTS.md` |
| Kural (proje) | `.cursor/rules/<id>.mdc` | `CLAUDE.md` | `AGENTS.md` |

Skill kaynağında `SKILL.md` + `name` / `description` gerekir. Cursor kuralı `.mdc`; diğerlerinde `<!-- air:rule:<id> -->` bloğu. LM Studio ve Claude Desktop bu akışta yok.

## Sunucu adresleri

| id | Adres | Ne gerekir |
|---|---|---|
| figma | http://127.0.0.1:3845/mcp | Figma Desktop + Dev Mode MCP |
| jira | http://127.0.0.1:3101/mcp | Site + e-posta + [API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| notion | http://127.0.0.1:3102/mcp | [Integration token](https://www.notion.so/my-integrations) |
| obsidian | http://127.0.0.1:3103/mcp | Vault klasörü (filesystem MCP; uygulama şart değil) |
| github | http://127.0.0.1:3104/mcp | [GitHub PAT](https://github.com/settings/tokens) + yerel `github-mcp-server` |
| gitlab | http://127.0.0.1:3105/mcp | GitLab URL + [PAT](https://gitlab.com/-/user_settings/personal_access_tokens) |
| git | http://127.0.0.1:3106/mcp | Repo yolu + `git` + `uv` |
| firebase | http://127.0.0.1:3107/mcp | Proje klasörü + `firebase login` |
| cloudflare | http://127.0.0.1:3108/mcp | [API token](https://dash.cloudflare.com/profile/api-tokens) + Account ID |
| xcode | http://127.0.0.1:3109/mcp | macOS + Xcode |
| android | http://127.0.0.1:3110/mcp | Android SDK |
| maestro | http://127.0.0.1:3111/mcp | Maestro CLI + Java 17 |
| asc | http://127.0.0.1:3112/mcp | App Store Connect API key (.p8) |
| play | http://127.0.0.1:3113/mcp | Play service account JSON + `uv` |
| release | http://127.0.0.1:3114/mcp | `storepilot.yaml` (ASC/Play kimlikleri varsa kullanılır) |
| sqlite | http://127.0.0.1:3115/mcp | SQLite `.db` yolu + `uv` |
| bitbucket | http://127.0.0.1:3116/mcp | E-posta + [API token](https://id.atlassian.com/manage-profile/security/api-tokens) |

Değerler `.env` içinde. Örnek: `.env.example`

## Kaldırma

```bash
air stop
npm unlink
```

Klasörü silin (`.env`, `.air`, `.run` içindedir). `air-*` kayıtları için bağlama tablosuna, skill/kural dosyaları için skill tablosuna bakın.

## Yeni sunucu

1. `src/servers/yeni.ts` — `McpAdapter`
2. `src/servers/index.ts` — kaydet
3. `config/servers.json` — `id`, `title`, `port`
