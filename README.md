# Air

Yerel MCP orkestratörü. Katalogdaki sunucuları (Figma, Jira, Notion, Obsidian, GitHub, GitLab, Git, Firebase, Cloudflare, Xcode, Android, Maestro) kendi makinenizde çalıştırır. Cursor, Claude, LM Studio veya OpenCode localhost üzerinden bağlanır. Skill ve kural da aynı istemcilere yazılabilir.

Hiçbir sunucu varsayılan olarak açık değildir. Hangisini istiyorsanız onu seçip başlatırsınız.

macOS, Windows ve Linux. Node.js 20+ gerekir. `npm link` sonrası komut: `air` (her yerden; `.env` Air klasöründedir).

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

**Linux** — proje klasöründe:

```bash
chmod +x scripts/setup.linux.sh
./scripts/setup.linux.sh
```

Script Node 20+ yoksa kurmayı dener (`brew` / `winget`), Linux’ta Node LTS sayfasını açar; sonra `npm install`, `npm link` ve `air setup` çalıştırır.

### Node zaten varsa

```bash
npm install
npm link
air setup
```

`setup` önce ne ekleyeceğini sorar (MCP, skill, kural). MCP seçilirse:

1. Hangi MCP sunucuları açık olsun? (numara girin, örn. `1` veya `1 3`)
2. Eksik uygulama varsa kurulsun mu?
3. Token / vault yolu (gerekirse tarayıcıda oluşturma sayfasını açar)
4. Şimdi başlatayım mı?
5. Bir istemciye bağlayayım mı?

Sunucu seçilmezse başlat / bağla sorulmaz. Skill veya kural seçilirse URL ve istemci sorulur.

Token’lar `.env` dosyasına yazılır, git’e girmez.

---

## 3. Çalıştırın

`npm link` sonrası komutlar herhangi bir dizinden çalışır.

### Sadece Figma

```bash
air start figma
```

Figma Desktop açılır. İlk seferde Figma içinde **Preferences → Enable Dev Mode MCP Server** açık olmalı. Hazır olunca adres: `http://127.0.0.1:3845/mcp`

### Sadece Jira / Notion / Obsidian

```bash
air start jira
air start notion
air start obsidian
```

Birden fazlası:

```bash
air start figma jira
```

### Menüden seçerek

```bash
air start
```

Listeden numara girin. Hiçbir sunucu `enable` edilmemişse tam katalog gelir.

### Kalıcı aç / kapa

```bash
air enable figma jira    # menüde görünsün
air disable notion       # menüden çıksın
air list                 # hangisi açık / çalışıyor
```

`enable` tek başına süreci başlatmaz. Çalıştırmak için `start` gerekir.  
`air start figma` enable olmasa da Figma’yı başlatır.

### Durdur / durum

```bash
air status          # ayakta olanlar ve URL’leri
air stop figma      # sadece Figma MCP (Figma uygulamasını kapatmaz)
air stop            # Air’in başlattığı süreçler
air doctor          # Node ve uygulamalar yerinde mi
```

`npm start` = `air start` (hepsini açmaz, seçim ister).

---

## 4. Yapay zeka aracına bağlayın

Sunucu ayaktayken:

```bash
air connect
```

İstemci seçin, snippet görünür. Onaylarsanız config dosyasına yazar (önce `.bak` yedek). Mevcut diğer MCP’ler silinmez. Sonra uygulamayı yeniden açın veya MCP listesini yenileyin.

Doğrudan yazmak:

```bash
air connect --client cursor --write
air connect --client lmstudio --write
air connect --client claude-desktop --write
air connect --client opencode --write
air connect --client claude-code --write
```

`connect` yalnızca o anda **çalışan** sunucuları ekler.

| İstemci | Config |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| LM Studio | `~/.lmstudio/mcp.json` |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json` — Windows `%APPDATA%\Claude\claude_desktop_config.json` — Linux `~/.config/Claude/claude_desktop_config.json` |
| OpenCode | `~/.config/opencode/opencode.json` |
| Claude Code | `~/.claude.json` (user scope, `type: "http"`) |

Elle eklemek için `examples/` altındaki JSON’lar. `url` / Streamable HTTP destekleyen her MCP istemcisi aynı adresleri kullanır.

---

## 5. Skill ve kural

URL’den indirip Cursor, Claude Code veya OpenCode’a yazar. Varsayılan kullanıcı genel dizinleri; `--project` ile repo (dizin yoksa mevcut klasör).

```bash
air skill add https://raw.githubusercontent.com/org/repo/main/SKILL.md --write
air skill add https://github.com/org/repo/tree/main/skills/foo --client cursor --project --write
air skill list
air skill remove foo

air rule add https://raw.githubusercontent.com/org/repo/main/style.md --write
air rule add https://example.com/api.md --project ./my-app --write
air rule list
air rule remove style
```

`--client` yoksa menüden seçilir. `--write` onayı atlar. `--print` sadece gösterir.

| | Cursor | Claude Code | OpenCode |
|---|---|---|---|
| Skill (genel) | `~/.cursor/skills/<ad>/` | `~/.claude/skills/<ad>/` | `~/.config/opencode/skills/<ad>/` |
| Skill (proje) | `.cursor/skills/<ad>/` | `.claude/skills/<ad>/` | `.opencode/skills/<ad>/` |
| Kural (genel) | `~/.cursor/rules/<id>.mdc` | `~/.claude/CLAUDE.md` | `~/.config/opencode/AGENTS.md` |
| Kural (proje) | `.cursor/rules/<id>.mdc` | `CLAUDE.md` | `AGENTS.md` |

Skill kaynağında `SKILL.md` + `name` / `description` frontmatter gerekir. Kural tek markdown dosyasıdır; Cursor’da `alwaysApply: true` `.mdc`, diğerlerinde `<!-- air:rule:<id> -->` bloğu.

LM Studio ve Claude Desktop bu akışta yok.

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
npm link
air setup              # bir kez: sunucu seç, token gir
air start figma        # istediğin zaman, istediğin sunucu
air connect --client cursor --write
```

Sonraki günler:

```bash
air start figma jira
air status
```

---

## Kaldırma

Otomatik kaldırma yok. Tamamen silmek için:

```bash
air stop
cd air
npm unlink
cd ..
rm -rf air
```

Windows’ta klasörü silmek yeter; `npm unlink` aynı şekilde proje dizininde çalışır.

`.env`, `.air` ve `.run` proje klasörünün içindedir; klasörle birlikte gider.

`air connect --write` kullandıysanız istemci config’lerinden `air-*` kayıtlarını silin. Dosya yolları yukarıdaki **Yapay zeka aracına bağlayın** tablosunda.

`air skill` / `air rule` eklediyseniz ilgili skill klasörlerini, Cursor kural `.mdc` dosyalarını ve `<!-- air:rule:... -->` bloklarını da silin. Yollar **Skill ve kural** tablosunda.

Figma, Git, Java gibi Air’in kurduğu uygulamalar durur; onları ayrıca kaldırmanız gerekir.

---

## Yeni sunucu ekleme

Katalog genişletilebilir. Yeni MCP için:

1. `src/servers/yeni.ts` — `McpAdapter` yaz
2. `src/servers/index.ts` — kaydet
3. `config/servers.json` — `id`, `title`, boş `port`, `defaultEnabled: false`

```bash
air enable yeni
air start yeni
```

Katalogda olmayan bir MCP eklemek istiyorsanız pull request açabilirsiniz. Kendi makineniz veya ekibiniz için değiştirmek isterseniz repoyu fork edip bağımsız düzenleyebilirsiniz.
