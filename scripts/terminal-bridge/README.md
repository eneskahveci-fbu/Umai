# craft.coder — Yerel Gerçek Terminal Köprüsü

Bu küçük araç, **kendi bilgisayarındaki gerçek terminali** (bash/zsh/PowerShell)
craft.coder'a bağlar. Böylece yapay zekâ, tarayıcı içi sanal makine yerine
**senin gerçek makinende** komut çalıştırabilir — tıpkı Claude Code gibi.

- ✅ Tamamen **ücretsiz**, açık kaynak
- ✅ **Senin makinende** çalışır; hiçbir veri dışarı gönderilmez
- ✅ Yalnızca `localhost`'a bağlanır (istersen token ile korunur)

## Kurulum

```bash
cd scripts/terminal-bridge
npm install
TOKEN=gizli-bir-anahtar npm start
```

Çıktıda şuna benzer bir adres görürsün:

```
ws://localhost:7777/?token=gizli-bir-anahtar
```

## craft.coder'a bağlama

1. craft.coder → **Ayarlar → Terminal** (veya "Terminal WS URL").
2. Yukarıdaki `ws://...` adresini yapıştır.
3. Coder görünümünde terminali aç — gerçek shell'in açılır.
4. (Opsiyonel) **Ayarlar → "Bağlanınca kurulum komutu"** alanına
   `npm install && npm run dev` gibi bir komut yazarsan, terminal her
   bağlandığında otomatik çalışır (Claude Code'un SessionStart'ı gibi).

## Ayarlar (ortam değişkenleri)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `7777` | Dinlenecek port |
| `HOST` | `127.0.0.1` | `0.0.0.0` yaparsan LAN'dan erişilir (dikkatli ol) |
| `TOKEN` | _(boş)_ | Ayarlanırsa bağlanmak için `?token=` zorunlu olur |
| `CRAFT_SHELL` | sistem shell'i | Kullanılacak shell (ör. `zsh`, `powershell.exe`) |
| `CRAFT_CWD` | bulunduğun klasör | Terminalin açılacağı klasör |

## Güvenlik notu

Bu köprü, bağlanan herkese makinende **komut çalıştırma** yetkisi verir.
- Mümkünse her zaman bir `TOKEN` kullan.
- `HOST`'u yalnızca gerektiğinde `0.0.0.0` yap; aksi halde `127.0.0.1` bırak.
- İşin bitince köprüyü kapat (Ctrl+C).
