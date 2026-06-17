# Oracle (Always Free) — terminal köprüsü hibrit kurulumu

Site **Vercel'de** kalır; gerçek terminal (uzun-yaşayan WebSocket) **Oracle ücretsiz sunucuda** çalışır. İkisi de ücretsiz. Tek script her şeyi yapar: Node + node-pty, ayrı kullanıcı, systemd (otomatik başlatma), Caddy ile **otomatik HTTPS**, güvenlik duvarı.

## Adımlar

1. **Oracle'da ücretsiz makine oluştur**
   - Oracle Cloud → *Compute → Instances → Create*.
   - Image: **Ubuntu 22.04**. Shape: **Ampere A1 (Always Free)** (yoksa "VM.Standard.E2.1.Micro").
   - SSH anahtarını indir/kaydet → *Create*.

2. **80 ve 443 portunu aç (konsolda, bir kez)**
   - Instance → Virtual Cloud Network → *Subnet → Security List → Add Ingress Rules*.
   - İki kural: Source `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **80** ve **443**.

3. **Sunucuya bağlan ve tek komutu çalıştır**
   ```bash
   git clone https://oauth2:<GITLAB_TOKEN>@gitlab.com/eneskahveci.bs/craft-coder.git /tmp/cc \
     && sudo bash /tmp/cc/deploy/oracle/setup.sh
   ```
   (Kendi alan adın varsa: `... setup.sh terminal.alanadi.com` — yoksa otomatik `<ip>.sslip.io` kullanılır.)

4. **Çıkan adresi uygulamaya gir**
   - Script sonunda `wss://<alan>/?token=<gizli>` yazar.
   - Uygulama → **Ayarlar → Terminal sunucu adresi** alanına yapıştır. Bitti.

## Yönetim
- Durum: `systemctl status craft-bridge caddy`
- Yeniden başlat: `sudo systemctl restart craft-bridge`
- Token'ı değiştir: servis dosyasındaki `TOKEN=` değerini düzenle → `sudo systemctl daemon-reload && sudo systemctl restart craft-bridge`.

## Güvenlik
- Köprü yalnız `127.0.0.1`'de dinler; dışarıya yalnız Caddy (443, token korumalı) açıktır.
- `craftbridge` kullanıcısı root değildir. Terminal komutları bu sınırlı kullanıcıyla çalışır.
- Token'ı kimseyle paylaşma; URL'in tamamı erişim demektir.
