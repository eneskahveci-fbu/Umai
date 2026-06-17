# craft.coder — Hibrit Köprü (Terminal + Sunucu)

Bu köprü craft.coder'a **tek bir adres** üzerinden iki şey birden açar:

1. **Terminal** (WebSocket) — gerçek shell (bash/zsh/PowerShell), canlı.
2. **Sunucu** (HTTP) — gerçek dosya sistemi + komut çalıştırma + MCP.

Böylece craft.coder, tarayıcı içi sanal makine (WebContainer) yerine **gerçek
bir ortamda** çalışır — tıpkı Claude Code gibi. Repo bağlamak zorunlu değildir;
`WORK_DIR` kalıcı bir workspace olarak her zaman hazırdır.

- ✅ Tamamen **ücretsiz**, açık kaynak, tek dosya (`bridge.mjs`)
- ✅ Tek port, tek token → terminal **ve** dosya sistemi birlikte
- ✅ Public sunucuda (Oracle/VPS + Caddy HTTPS) → **mobil Safari/Firefox dahil** çalışır
- ✅ Kendi makinende çalıştırırsan hiçbir veri dışarı çıkmaz

## Çalıştırma

```bash
cd scripts/terminal-bridge
npm install                 # ws + node-pty
TOKEN=gizli WORK_DIR=/proje/yolun npm start
```

Çıktıda iki adres görürsün (ikisi de aynı port, aynı token):

```
Terminal : ws://localhost:7777/?token=gizli
Sunucu   : http://localhost:7777        (token: gizli)
```

## craft.coder'a bağlama

Tek adresi yapıştırman yeterli — gerisi otomatik dolar:

1. craft.coder → **Ayarlar → 🔗 Hibrit Sunucu** alanına `ws(s)://…/?token=…` yapıştır.
   - **Terminal WS URL** ve **Yerel Mod** (adres + token) otomatik kurulur.
2. Coder görünümünde terminali aç → gerçek shell açılır.
3. Ajan artık GitHub/GitLab API yerine bu sunucudaki **gerçek dosyalara** yazar.
4. (Opsiyonel) **Ayarlar → "Bağlanınca kurulum komutu"** → `npm install && npm run dev`.

> Public sunucu için tek-komut kurulum: **`deploy/oracle/setup.sh`** (Caddy ile
> otomatik HTTPS + systemd + güvenlik duvarı). Oracle Always Free veya herhangi
> bir Ubuntu VPS'te çalışır.

## Ayarlar (ortam değişkenleri)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `7777` | Dinlenecek port |
| `HOST` | `127.0.0.1` | Caddy arkasında bırak; doğrudan LAN için `0.0.0.0` (dikkatli ol) |
| `TOKEN` | _(rastgele)_ | Erişim anahtarı — HTTP (Bearer) ve WS (`?token=`) için ortak |
| `WORK_DIR` | bulunduğun klasör | Kalıcı workspace kökü (dosya işlemleri + terminal cwd) |
| `CRAFT_SHELL` | sistem shell'i | Terminal shell'i (ör. `zsh`, `powershell.exe`) |
| `ALLOWED_ORIGIN` | `*` | Tarayıcıdan doğrudan HTTP çağrısı için CORS origin |
| `MAX_FILE_BYTES` | `2000000` | Okuma/yazma üst sınırı |

## Sağlık kontrolü

```bash
curl http://localhost:7777/health      # { ok: true, terminal: true, root: … }
```

## Güvenlik notu

Bu köprü, bağlanan herkese workspace'te **dosya yazma ve komut çalıştırma**
yetkisi verir.
- **Her zaman güçlü bir `TOKEN` kullan** (public sunucuda zorunlu).
- Public sunucuda yalnızca Caddy'yi (443) dışarı aç; köprü `127.0.0.1`'de kalsın.
- Köprüyü **root olmayan** bir kullanıcıyla çalıştır (`setup.sh` bunu yapar).
- Token'ın tamamı erişim demektir; kimseyle paylaşma.
