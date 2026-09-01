# Air

Yerel MCP orkestratörü. Figma, Jira, Notion ve Obsidian sunucularını makinede ayağa kaldırır; Cursor, Claude, LM Studio veya OpenCode yalnızca localhost URL’sine bağlanır.

Hiçbir sunucu varsayılan açık değildir. Hangisini istersen onu seçersin.

## İlk kurulum

Node 20+ gerekir.

**macOS**

```bash
./scripts/setup.macos.sh
```

**Windows** (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.windows.ps1
```

Node zaten varsa:

```bash
npm install
npx air setup
```

`setup` hangi sunucuların projede açık olacağını sorar, eksik uygulamayı kurmayı teklif eder, token ister.

## Kullanım

```bash
npx air list
npx air enable figma jira
npx air disable notion
npx air start              # açık olanlardan seç
npx air start figma        # sadece Figma
npx air start figma jira
npx air stop
npx air stop figma
npx air status
npx air doctor
npx air connect
npx air connect --client cursor --write
```

`npm start` = `air start` (hepsini açmaz).

## Sunucular

| id | Adres | Not |
|---|---|---|
| figma | http://127.0.0.1:3845/mcp | Figma Desktop + Dev Mode MCP |
| jira | http://127.0.0.1:3101/mcp | API token |
| notion | http://127.0.0.1:3102/mcp | Integration token |
| obsidian | http://127.0.0.1:3103/mcp | Vault klasör yolu |

Figma: Preferences → Enable Dev Mode MCP Server.

Jira token: https://id.atlassian.com/manage-profile/security/api-tokens

Notion token: https://www.notion.so/my-integrations

Sırlar `.env` dosyasındadır; git’e girmez.

## İstemciler

Sunucular ayaktayken:

```bash
npx air connect
```

Onaylarsan mevcut config’e yazar (önce `.bak`). Diğer MCP kayıtların silinmez.

| İstemci | Dosya |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| LM Studio | `~/.lmstudio/mcp.json` |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json` — Windows `%APPDATA%\Claude\claude_desktop_config.json` |
| OpenCode | `~/.config/opencode/opencode.json` |
| Claude Code | `claude mcp add --transport http air-figma http://127.0.0.1:3845/mcp` |

Örnek JSON: `examples/`. Streamable HTTP / `url` alanı olan her MCP istemcisi aynı adresleri kullanır. Config yazıldıktan sonra uygulamayı yeniden aç.

## Yeni sunucu ekleme

1. `src/servers/yeni.ts` — `McpAdapter` uygula
2. `src/servers/index.ts` — `register`
3. `config/servers.json` — yeni kayıt (`defaultEnabled: false`, boş port)

```bash
npx air enable yeni
npx air start yeni
```

## Desteklenen ortam

macOS ve Windows. Linux yok.
