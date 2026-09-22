# Oracle (Always Free) — HİBRİT köprü kurulumu (terminal + sunucu)

**Vercel'deki siten hiç değişmez.** Sadece, gerçek terminal + gerçek dosya
sistemi isteyen kısımlar için ücretsiz bir Oracle sunucusu eklersin. İkisi de
ücretsiz. Tek script her şeyi yapar: Node + node-pty, ayrı kullanıcı, kalıcı
workspace, systemd (otomatik başlatma), Caddy ile **otomatik HTTPS**, güvenlik duvarı.

Tek bir adres (`wss://…/?token=…`) hem **terminali** hem **dosya sistemini** açar.
Böylece **mobil Safari/Firefox dahil** her yerden, repo bağlamadan, gerçek bir
ortamda çalışırsın.

## Mimari (kimde ne çalışır)

| Katman | Nerede | Değişiklik |
|---|---|---|
| Site (Next.js, UI, /api/chat) | **Vercel** | **Yok — aynı kalır** |
| Terminal + dosya sistemi köprüsü | **Oracle (ücretsiz)** | Bu script kurar |

Bağlantıyı uygulama tarafında **Ayarlar**'dan girersin; kod/dağıtım değişmez.

## Adımlar

1. **Oracle'da ücretsiz makine oluştur**
   - Oracle Cloud → *Compute → Instances → Create*.
   - Image: **Ubuntu 22.04**. Shape: **Ampere A1 (Always Free)**.
   - SSH anahtarını indir/kaydet → *Create*.
   - ⚠️ "Out of host capacity" hatası alırsan: başka bir *Availability Domain*
     dene, ya da AMD **VM.Standard.E2.1.Micro** (o da Always Free) seç, ya da
     birkaç dakika sonra tekrar dene (Ampere talebi yoğun olduğunda olur).

2. **80 ve 443 portunu aç (konsolda, bir kez)**
   - Instance → Virtual Cloud Network → *Subnet → Security List → Add Ingress Rules*.
   - İki kural: Source `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **80** ve **443**.

3. **Sunucuya bağlan ve tek komutu çalıştır**
   ```bash
   git clone https://github.com/eneskahveci-bs/craft-coder.git /tmp/cc \
     && sudo bash /tmp/cc/deploy/oracle/setup.sh
   ```
   (Kendi alan adın varsa: `… setup.sh terminal.alanadi.com` — yoksa otomatik
   `<ip>.sslip.io` kullanılır, ücretsiz.)

4. **Çıkan adresi uygulamaya gir** (tek alan, ikisini de kurar)
   - Script sonunda `wss://<alan>/?token=<gizli>` yazar.
   - Uygulama → **Ayarlar → 🔗 Hibrit Sunucu** alanına yapıştır.
   - **Terminal WS URL** ve **Yerel Mod** (adres + token) otomatik dolar. Bitti.

## Yönetim
- Durum: `systemctl status craft-bridge caddy`
- Sağlık: `curl https://<alan>/health`
- Yeniden başlat: `sudo systemctl restart craft-bridge`
- Token'ı değiştir: `/etc/systemd/system/craft-bridge.service` içindeki `TOKEN=`
  değerini düzenle → `sudo systemctl daemon-reload && sudo systemctl restart craft-bridge`.
- Workspace: `/opt/craft-bridge/workspace` (repolar/projeler burada **kalıcı**).
- **Köprüyü güncelle (sudo GEREKMEZ):** Uygulamadaki terminal, köprü eskiyse
  tuş şeridinde "Köprüyü güncelle" düğmesi gösterir. Elle yapmak istersen
  terminale yapıştır:
  ```bash
  curl -fsSL https://gitlab.com/eneskahveci.bs/craft-coder/-/raw/main/scripts/terminal-bridge/bridge.mjs -o /opt/craft-bridge/bridge.mjs.new \
    && node --check /opt/craft-bridge/bridge.mjs.new \
    && mv /opt/craft-bridge/bridge.mjs.new /opt/craft-bridge/bridge.mjs \
    && pkill -u "$(id -u)" -f 'node /opt/craft-bridge/bridge.mjs'
  ```
  Dosyalar `craftbridge` kullanıcısına ait olduğu için terminal onları
  yazabilir; eski süreç ölünce systemd (`Restart=always`) 3 sn'de yeni kodla
  kaldırır, terminal kendiliğinden yeniden bağlanır. (Terminal içinde `sudo`
  ÇALIŞMAZ — servis `NoNewPrivileges=true` ile çalışır; bu bilinçli.)
- **Kullanıcı-alanı araçları** (`opencode`, `bun`, `pip --user`…): köprü 2.1+
  `~/.opencode/bin`, `~/.local/bin`, `~/.bun/bin`, `~/.npm-global/bin`,
  `~/.cargo/bin`, `~/go/bin` dizinlerini (varsa) terminalin PATH'ine kendisi
  ekler — `.bashrc` düzenlemeye gerek yok. `snap install` root ister, kullanma.

## (Opsiyonel) Yerel LLM — Pollinations'tan daha güçlü, tamamen kendi sunucunda

Yukarıdaki kurulum tamamlandıktan sonra, AYNI sunucuya bir Ollama modeli
ekleyip Pollinations'tan çok daha güçlü, tamamen ücretsiz (Oracle Always
Free) ve üçüncü tarafa hiç veri gitmeyen bir model çalıştırabilirsin:

```bash
sudo bash deploy/oracle/setup-llm.sh
```

Ne yapar: Ollama'yı kurar (yalnız `127.0.0.1`'de dinler, dışarıya hiç
açılmaz — ek güvenlik duvarı kuralı gerekmez), sunucunun RAM'ine göre
otomatik model seçer (≥16GB → Qwen2.5 14B, yoksa Qwen2.5 7B), köprüyü
(`bridge.mjs`'in `/llm/v1/*` proxy uçlarıyla) günceller ve sonunda
craft.ai → **Ayarlar → Modeller**'e yapıştıracağın **Base URL** (`https://
<alan>/llm/v1`), **Anahtar** (mevcut köprü token'ın) ve **Model** adını
yazdırır — normal bir "Özel" sağlayıcı gibi eklenir, uygulama tarafında
ekstra bir kod/kavram yok.

Farklı bir model denemek istersen: `sudo CRAFT_MODEL=qwen2.5:7b bash
deploy/oracle/setup-llm.sh` (herhangi bir Ollama kütüphane modeli olabilir).

## Güvenlik
- Köprü yalnız `127.0.0.1`'de dinler; dışarıya yalnız Caddy (443, token korumalı) açıktır.
- `craftbridge` kullanıcısı root değildir; terminal ve dosya işlemleri bu sınırlı
  kullanıcıyla çalışır.
- Token hem terminal (WS `?token=`) hem sunucu (HTTP `Bearer`) için ortaktır.
- Token'ı kimseyle paylaşma; URL'in tamamı erişim demektir.
