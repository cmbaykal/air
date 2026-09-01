# Air

Yerel MCP orkestratörü. Figma, Jira, Notion ve Obsidian sunucularını kendi makinenizde çalıştırır. Cursor, Claude, LM Studio veya OpenCode bu sunuculara localhost üzerinden bağlanır.

Hiçbir sunucu varsayılan olarak açık değildir. Hangisini istiyorsanız onu seçip başlatırsınız.

macOS ve Windows. Node.js 20+ gerekir.

---

## 1. Projeyi alın

```bash
git clone https://github.com/cmbaykal/air.git
cd air
```

## 2. Kurun

### Node yoksa (önerilen)

**macOS** — proje klasöründe:

```bash
chmod +x scripts/setup.macos.sh
./scripts/setup.macos.sh
```

**Windows** — PowerShell’de proje klasöründe:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.windows.ps1
```

Script Node 20+ yoksa kurmayı dener (`brew` / `winget`), sonra `npm install` ve `npx air setup` çalıştırır.

### Node zaten varsa

```bash
npm install
npx air setup
```

`setup` sırayla sorar:

1. Hangi MCP sunucuları bu projede açık olsun? (numara girin, örn. `1` veya `1 3`)
2. Eksik uygulama varsa kurulsun mu?
3. Token / vault yolu (gerekirse tarayıcıda oluşturma sayfasını açar)
4. Şimdi başlatayım mı?
5. Bir istemciye bağlayayım mı?

Token’lar `.env` dosyasına yazılır, git’e girmez.

---

## 3. Çalıştırın

Tüm komutlar proje klasöründen (`air`) çalışır.

### Sadece Figma

```bash
npx air start figma
```

Figma Desktop açılır. İlk seferde Figma içinde **Preferences → Enable Dev Mode MCP Server** açık olmalı. Hazır olunca adres: `http://127.0.0.1:3845/mcp`

### Sadece Jira / Notion / Obsidian

```bash
npx air start jira
npx air start notion
npx air start obsidian
```

Birden fazlası:

```bash
npx air start figma jira
```

### Menüden seçerek

```bash
npx air start
```

Listeden numara girin. Hiçbir sunucu `enable` edilmemişse tam katalog gelir.

### Kalıcı aç / kapa

```bash
npx air enable figma jira    # menüde görünsün
npx air disable notion       # menüden çıksın
npx air list                 # hangisi açık / çalışıyor
```

`enable` tek başına süreci başlatmaz. Çalıştırmak için `start` gerekir.  
`air start figma` enable olmasa da Figma’yı başlatır.

### Durdur / durum

```bash
npx air status          # ayakta olanlar ve URL’leri
npx air stop figma      # sadece Figma MCP (Figma uygulamasını kapatmaz)
npx air stop            # Air’in başlattığı süreçler
npx air doctor          # Node ve uygulamalar yerinde mi
```

`npm start` = `npx air start` (hepsini açmaz, seçim ister).

---

## 4. Yapay zeka aracına bağlayın

Sunucu ayaktayken:

```bash
npx air connect
```

İstemci seçin, snippet görünür. Onaylarsanız config dosyasına yazar (önce `.bak` yedek). Mevcut diğer MCP’ler silinmez. Sonra uygulamayı yeniden açın veya MCP listesini yenileyin.

Doğrudan yazmak:

```bash
npx air connect --client cursor --write
npx air connect --client lmstudio --write
npx air connect --client claude-desktop --write
npx air connect --client opencode --write
npx air connect --client claude-code --print
```

`connect` yalnızca o anda **çalışan** sunucuları ekler.

| İstemci | Config |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| LM Studio | `~/.lmstudio/mcp.json` |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json` — Windows `%APPDATA%\Claude\claude_desktop_config.json` |
| OpenCode | `~/.config/opencode/opencode.json` |
| Claude Code | `claude mcp add --transport http air-figma http://127.0.0.1:3845/mcp` |

Elle eklemek için `examples/` altındaki JSON’lar. `url` / Streamable HTTP destekleyen her MCP istemcisi aynı adresleri kullanır.

---

## Sunucu adresleri

| id | Adres | Ne gerekir |
|---|---|---|
| figma | http://127.0.0.1:3845/mcp | Figma Desktop açık + Dev Mode MCP |
| jira | http://127.0.0.1:3101/mcp | Site + e-posta + [API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| notion | http://127.0.0.1:3102/mcp | [Integration token](https://www.notion.so/my-integrations) |
| obsidian | http://127.0.0.1:3103/mcp | Vault klasör yolu (uygulama şart değil) |
| github | http://127.0.0.1:3104/mcp | [GitHub PAT](https://github.com/settings/tokens) |
| gitlab | http://127.0.0.1:3105/mcp | GitLab URL + [PAT](https://gitlab.com/-/user_settings/personal_access_tokens) |
| git | http://127.0.0.1:3106/mcp | Repo yolu + `git` + `uv` (`uvx`) |
| firebase | http://127.0.0.1:3107/mcp | Proje klasörü + `firebase login` (Google) |
| cloudflare | http://127.0.0.1:3108/mcp | [API token](https://dash.cloudflare.com/profile/api-tokens) + Account ID |
| xcode | http://127.0.0.1:3109/mcp | macOS + Xcode (build / simülatör) |
| android | http://127.0.0.1:3110/mcp | Android SDK (Gradle / adb / emülatör) |
| maestro | http://127.0.0.1:3111/mcp | Maestro CLI + Java 17 (mobil UI test) |

Token ve vault `.env` içinde tutulur. Örnek: `.env.example`

---

## Tipik akış

```bash
cd air
npm install
npx air setup              # bir kez: sunucu seç, token gir
npx air start figma        # istediğin zaman, istediğin sunucu
npx air connect --client cursor --write
```

Sonraki günler:

```bash
cd air
npx air start figma jira
npx air status
```

---

## Yeni sunucu ekleme

1. `src/servers/yeni.ts` — `McpAdapter` yaz
2. `src/servers/index.ts` — kaydet
3. `config/servers.json` — `id`, `title`, boş `port`, `defaultEnabled: false`

```bash
npx air enable yeni
npx air start yeni
```
