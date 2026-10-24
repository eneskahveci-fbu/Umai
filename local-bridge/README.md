# craft.ai — Local Bridge (Yerel Mod)

craft.ai'ı **tıpkı Claude Code gibi yerelde** çalıştır. Bu köprü, web uygulamasının
GitHub/GitLab API yerine **kendi bilgisayarındaki gerçek dosya sistemine ve kabuğuna**
erişmesini sağlar. **Hiçbir sunucu/bulut/ücret yok** — her şey senin makinende.

## Neyi ücretsiz açar?
- ✅ **Gerçek dosya sistemi** — list / read / write / delete / rename / glob / grep
- ✅ **Gerçek kabuk** — komut çalıştır (senkron)
- ✅ **Arka plan görevleri** — uzun komutu arka planda çalıştır, sonra durumunu sor
- ✅ **stdio MCP** — yerel MCP sunucularını spawn et (Claude Code'daki gibi)

## Çalıştırma (bağımlılık yok)

```bash
cd local-bridge
BRIDGE_TOKEN=gizli-sifre WORK_DIR=/calistigin/proje node server.js
```

Çıktıdaki adresi (`http://localhost:4319`) ve token'ı kopyala, uygulamada
**Ayarlar → Yerel Mod**'a yapıştır. Artık ajan senin gerçek dosyalarını okuyup yazar,
gerçek komutları çalıştırır.

> Güvenlik: Sunucu yalnızca `127.0.0.1` (localhost) dinler ve **token zorunludur**.
> Token vermezsen rastgele üretilip ekrana yazılır (asla açık çalışmaz). Tüm dosya
> işlemleri `WORK_DIR` kök dizinine hapsedilir; `..` **ve** symlink ile kök dışına
> çıkılamaz. Kök dizinin kendisi silinemez.

## Ortam değişkenleri
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `4319` | Dinleme portu |
| `HOST` | `127.0.0.1` | Dinleme adresi (loopback önerilir) |
| `BRIDGE_TOKEN` | rastgele | Erişim token'ı (16+ karakter önerilir) |
| `WORK_DIR` | çalışılan dizin | Kök dizin; tüm yollar bunun içinde kalmalı |
| `ALLOWED_ORIGIN` | `*` | CORS izinli origin; `*` dışındaysa yabancı origin 403 alır |
| `MAX_FILE_BYTES` | `2000000` | Okuma **ve** yazma boyutu üst sınırı |
| `MAX_BODY_BYTES` | `8000000` | HTTP gövde üst sınırı |
| `EXEC_TIMEOUT_MS` | `120000` | Senkron komut zaman aşımı (sonunda SIGKILL) |
| `MAX_TASKS` | `50` | Aynı anda tutulan arka plan görevi |

Hatalar artık doğru HTTP durum koduyla döner (`400` geçersiz istek/yol, `401` token,
`403` origin, `404` bilinmeyen uç, `405` yanlış metot, `413` boyut, `429` görev
sınırı, `504` zaman aşımı). Gövde şekli değişmedi: `{ error }`.

## Testler
```bash
npm run test:bridge     # node --test (ek bağımlılık yok)
```

## Uçlar (HTTP, token'lı)
| Uç | Açıklama |
|---|---|
| `GET /health` | Sağlık; kök dizin yalnız token'lıysa döner |
| `POST /fs/list` `{filter?}` | Dosya yollarını listele |
| `POST /fs/read` `{path}` | Dosya oku |
| `POST /fs/write` `{path, content}` | Dosya yaz/oluştur |
| `POST /fs/delete` `{path}` | Dosya sil |
| `POST /fs/rename` `{path, newPath}` | Yeniden adlandır/taşı |
| `POST /fs/glob` `{pattern}` | Glob ile dosya bul |
| `POST /fs/grep` `{pattern, glob?, ignoreCase?}` | İçerikte regex ara |
| `POST /exec` `{command, background?, cwd?}` | Komut çalıştır (background → taskId) |
| `GET /exec/status?id=` | Arka plan görev durumu/çıktısı |
| `POST /mcp/list` `{command, args?, env?}` | stdio MCP araçlarını listele |
| `POST /mcp/call` `{command, args?, tool, arguments}` | stdio MCP aracını çağır |

## npx ile (kurulumsuz)
```bash
cd local-bridge && npm start
```
