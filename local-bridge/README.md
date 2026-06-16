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
> işlemleri `WORK_DIR` kök dizinine hapsedilir (path traversal koruması).

## Uçlar (HTTP, token'lı)
| Uç | Açıklama |
|---|---|
| `GET /health` | Sağlık + kök dizin (token gerekmez) |
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
