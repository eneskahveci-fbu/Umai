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

## (Opsiyonel) opencode — terminalde `opencode` yazınca açılan AI kodlama ajanı

[opencode](https://opencode.ai) açık kaynak bir terminal AI ajanıdır. Köprü
kurulduktan sonra AYNI sunucuda tek komut:

```bash
sudo bash deploy/oracle/setup-opencode.sh
```

Ne yapar: opencode'u global kurar (terminalin PATH'inde), köprüyü günceller
(xterm-256color + truecolor — tam ekran TUI düzgün görünsün diye) ve servisi
yeniden başlatır. `setup-llm.sh` ile Ollama da kuruluysa opencode'u otomatik o
yerel modele bağlar (anahtarsız); değilse opencode içinde `/connect` ile bir
sağlayıcı ekle. Sonra uygulamada terminali aç (açıksa ⟳ ile yeniden bağlan)
ve `opencode` yaz. Güncellemek için aynı komutu tekrar çalıştır.

**SSH'a erişemiyorsan (root'suz yol):** uygulamanın kendi terminaline (zaten
sunucuya bağlı) şunu yapıştır — sudo gerekmez, köprü kullanıcısının kendi
klasörüne kurar, tekrar çalıştırmak güvenli (günceller):

```bash
npm i -g --prefix ~/.local opencode-ai@latest && { grep -q craft-opencode ~/.bashrc 2>/dev/null || printf '\n# craft-opencode\nexport PATH="$HOME/.local/bin:$PATH"\nexport TERM=xterm-256color COLORTERM=truecolor\n' >> ~/.bashrc; } && . ~/.bashrc && opencode --version
```

Sürüm numarası çıkınca `opencode` yaz. (Ollama otomatik bağlantısı yalnız
sudo'lu scriptte var; burada `/connect` ile sağlayıcı ekle.)

> Not: opencode yerel bir ikili dosyadır; yalnız bu uzak köprü terminalinde
> çalışır, tarayıcı içi WebContainer modunda çalışmaz.

## (Opsiyonel) Laya — yerel karar modeli, sohbette araç olarak

[Laya](https://github.com/NandhaKishorM/laya) (Apache 2.0) sohbet modeli
DEĞİLDİR: metin + tipli sorular alır, **seçim / puan / evet-hayır** kararı
döner (100+ dil, Türkçe dahil). craft.ai'da sohbetteki modelin çağırdığı bir
MCP aracıdır.

```bash
sudo bash deploy/oracle/setup-laya.sh      # SSH ile
bash deploy/oracle/setup-laya.sh           # SSH yoksa: uygulamanın terminalinden (sudo'suz)
```

Ne yapar: ayrı bir Python ortamına CPU PyTorch + `laya[mcp]` kurar, çok dilli
checkpoint'i (~322M) bir kez indirir, köprünün `mcp-servers.json`'una `laya`
girdisini ekler ve köprüyü günceller. Köprü Laya'yı **bir kez başlatıp açık
tutar** (her çağrıda model yüklemez) ve `https://<alan>/mcp/local/laya`
adresinden sunar (köprü token'ıyla korunur). En az ~3GB RAM gerekir (Ampere
A1 uygun; AMD 1GB yetmez).

Sonra uygulamada **Eklentiler → "Laya (karar modeli)"** kartını aç — hibrit
sunucun Ayarlar'da bağlıysa adres + token otomatik dolar. Araç çağırabilen bir
model seçili olmalı.

Aynı mekanizmayla başka stdio MCP sunucuları da eklenebilir:
`/opt/craft-bridge/mcp-servers.json` → `{"<ad>": {"command": "...", "args": [], "env": {}}}`,
adres `https://<alan>/mcp/local/<ad>`.

## Güvenlik
- Köprü yalnız `127.0.0.1`'de dinler; dışarıya yalnız Caddy (443, token korumalı) açıktır.
- `craftbridge` kullanıcısı root değildir; terminal ve dosya işlemleri bu sınırlı
  kullanıcıyla çalışır.
- Token hem terminal (WS `?token=`) hem sunucu (HTTP `Bearer`) için ortaktır.
- Token'ı kimseyle paylaşma; URL'in tamamı erişim demektir.
