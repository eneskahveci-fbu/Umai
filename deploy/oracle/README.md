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

## Güvenlik
- Köprü yalnız `127.0.0.1`'de dinler; dışarıya yalnız Caddy (443, token korumalı) açıktır.
- `craftbridge` kullanıcısı root değildir; terminal ve dosya işlemleri bu sınırlı
  kullanıcıyla çalışır.
- Token hem terminal (WS `?token=`) hem sunucu (HTTP `Bearer`) için ortaktır.
- Token'ı kimseyle paylaşma; URL'in tamamı erişim demektir.
