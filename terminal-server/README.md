# craft.ai — Kalıcı Terminal Sunucusu (gerçek Linux shell)

Bu sunucu, craft.ai'a **gerçek ve kalıcı** bir Linux shell bağlar (Claude Code'un
gerçek terminaline benzer). WebSocket üzerinden PTY açar; token ile korunur.

- `server.js` — WebSocket PTY sunucusu (auth + origin kontrolü + health-check)
- `deploy-oracle.sh` — Oracle Cloud (Ubuntu ARM) için **tek komutluk kalıcı kurulum**
- `Dockerfile` — konteyner ile çalıştırmak için

## En kolay yol: Oracle Cloud Free Tier (7/24, ücretsiz)

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

- `TERMINAL_TOKEN` **zorunlu** — bu sunucu bağlanan herkese shell verir.
- Yalnızca güvendiğin makinede çalıştır; `ALLOWED_ORIGIN` ile origin'i kısıtlayabilirsin.
- İşin bitince servisi durdur: `sudo systemctl disable --now craftai-terminal`.