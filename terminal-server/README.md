# craft.ai — Kalıcı Terminal Sunucusu (gerçek Linux shell)

Bu sunucu, craft.ai'a **gerçek ve kalıcı** bir Linux shell bağlar (Claude Code'un
gerçek terminaline benzer). WebSocket üzerinden PTY açar; token ile korunur.

- `server.js` — WebSocket PTY sunucusu (auth + origin kontrolü + health-check)
- `deploy-oracle.sh` — Oracle Cloud (Ubuntu ARM) için **tek komutluk kalıcı kurulum**
- `Dockerfile` — konteyner ile çalıştırmak için

## Kendi bilgisayarında çalıştır (varsayılan)

Uygulamadaki terminal artık **IDE mantığında** çalışır: web sitesi senin
bilgisayarındaki bu sunucuya bağlanır (`ws://127.0.0.1:7071`). Uzak/Oracle
sunucu yalnızca yönetici (admin) hesaplarına açıktır.

```bash
cd terminal-server
npm install
TERMINAL_TOKEN=$(openssl rand -hex 24) node server.js
```

Çıktıdaki adresi uygulamada **Ayarlar → Terminal & Sunucu → Kendi bilgisayarın**
alanına yapıştır:

```
ws://127.0.0.1:7071/?token=<ürettiğin-token>
```

> Tarayıcı tek başına bilgisayarına erişemez; bu küçük sunucu o köprüdür.
> Yalnız `127.0.0.1` üzerinde dinler, token zorunludur.

## Oracle Cloud Free Tier (yalnız yönetici)

1. **VM oluştur:** cloud.oracle.com → ARM VM (Shape `VM.Standard.A1.Flex`,
   1 OCPU / 6 GB — Always Free).
2. **Portu aç (bulut tarafı):** Networking → Security List → Ingress → TCP `7071`.
3. **VM'e SSH** ile bağlan, bu klasörü kopyala ve çalıştır:
   ```bash
   chmod +x deploy-oracle.sh
   TERMINAL_TOKEN=gizli_sifre ./deploy-oracle.sh
   ```
   Script Node'u kurar, bağımlılıkları yükler, bir **systemd servisi** oluşturur
   (boot'ta başlar, çökerse yeniden başlar, oturum kapansa bile yaşar) ve güvenlik
   duvarı portunu açar.
4. **wss (güvenli) bağlantı:** craft.ai HTTPS olduğundan `wss://` gerekir. Alan
   adın/sertifikan yoksa ücretsiz Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url ws://localhost:7071
   ```
   Verilen `*.trycloudflare.com` adresini `wss://...trycloudflare.com?token=gizli_sifre`
   olarak kullan.
5. **craft.ai → Ayarlar → Terminal Sunucusu** alanına bu `wss://...` adresini yapıştır.

## Servisi yönetme

```bash
sudo systemctl status craftai-terminal     # durum
journalctl -u craftai-terminal -f          # canlı log
sudo systemctl restart craftai-terminal    # yeniden başlat
```

## Docker ile (alternatif)

```bash
docker build -t craftai-terminal .
docker run -d --restart=always -p 7071:7071 -e TERMINAL_TOKEN=gizli_sifre craftai-terminal
```

## Güvenlik

- `TERMINAL_TOKEN` **zorunlu** — token yoksa sunucu artık **başlamaz** (eskiden
  uyarı basıp dünyaya açık bir shell olarak devam ediyordu). Yalnızca yerel
  geliştirme için `ALLOW_INSECURE=1` kaçış kapısı var.
- Bu sunucu `/exec` ve `/mcp/*` uçlarıyla bağlanan herkese **tam kabuk** verir.
  Yalnızca güvendiğin makinede çalıştır; `ALLOWED_ORIGIN` ile origin'i kısıtla.
- Token 16+ karakter olsun (`openssl rand -hex 24`) ve loglara yazılmaz.
- Dosya yolları `realpath` ile çözülür: `..` veya symlink ile `WORK_DIR` dışına
  çıkılamaz; kök dizin silinemez.
- Senkron komutlar `EXEC_TIMEOUT_MS` sonunda öldürülür; arka plan görevleri
  TTL ile temizlenir ve `MAX_TASKS` ile sınırlıdır.
- İşin bitince servisi durdur: `sudo systemctl disable --now craftai-terminal`.
- Yalnızca inceleme/okuma gerekiyorsa `SANDBOX_MODE=read-only` kullan: dosya
  yazma, komut, MCP ve terminal bağlantıları kapanır (tam OS sandbox değil,
  ikinci bir kilittir).

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `7071` | Dinleme portu |
| `TERMINAL_TOKEN` | — | **Zorunlu** terminal + HTTP token'ı |
| `SHELL` | `/bin/bash` | PTY shell |
| `WORK_DIR` | `$HOME` | Terminal cwd + dosya işlemleri kökü |
| `SANDBOX_MODE` | `workspace-write` | `read-only` → yazma/komut/MCP **ve terminal** kapalı |
| `ALLOWED_ORIGIN` | `*` | CORS/WS izinli origin |
| `MAX_FILE_BYTES` | `2000000` | Okuma **ve** yazma boyutu üst sınırı |
| `MAX_BODY_BYTES` | `8000000` | HTTP gövde üst sınırı |
| `EXEC_TIMEOUT_MS` | `120000` | Senkron komut zaman aşımı |
| `MAX_TASKS` | `50` | Arka plan görev üst sınırı |
| `ALLOW_INSECURE` | — | `1` → token'sız başlat (yalnız geliştirme) |

Hata yanıtları doğru HTTP durum kodlarını kullanır (`400/401/403/404/405/413/429/504`),
gövde şekli aynıdır: `{ error }`.
