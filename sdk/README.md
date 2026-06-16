# Craft.Coder CLI (+ başsız SDK)

Mac/Linux terminalinde **tek komutla** kurulan, **etkileşimli** (Claude Code
tarzı, **craft teması**) bir AI kod asistanı — ve UI olmadan ajanı programatik
sürmek için bağımlılıksız (Node 18+) bir SDK.

## Kurulum (tek komut)

```bash
# Mac & Linux:
curl -fsSL https://raw.githubusercontent.com/eneskahveci-sdo/craft-coder/main/sdk/install.sh | sh
# veya doğrudan:
npm install -g craft-coder
```

## Başlat

```bash
craft-coder           # etkileşimli sohbet (sıfır yapılandırma: ücretsiz model)
```

İlk çalıştırmada ayar gerekmez — ücretsiz **Pollinations** modeli + herkese açık
Craft.Coder sunucusu kullanılır. Kendi modelin için:

```bash
craft-coder --base-url https://api.groq.com/openai/v1 --model llama-3.3-70b-versatile --api-key gsk_...
# veya env: CRAFTCODER_BASE_URL / CRAFTCODER_MODEL / CRAFTCODER_API_KEY
```

Dosya/komut araçları için yerel köprü:

```bash
craft-coder --bridge-url http://localhost:4319 --bridge-token GIZLI
```

Etkileşimli komutlar: `/yeni` sıfırla · `/help` yardım · `/çık` çıkış.

---

Aynı paket, UI olmadan ajanı **programatik** sürmek için bir SDK ve `claude -p`
benzeri başsız CLI de sunar. Çalışan bir Craft.Coder sunucusunun `/api/chat`
ucuna bağlanır; isteğe bağlı **Local Bridge** ile ajan gerçek dosya sistemi +
kabuk üzerinde çok-adımlı görev yürütür.

## Nasıl çalışır?

```
craftcoder CLI / SDK ──POST /api/chat──▶ Craft.Coder sunucusu ──▶ LLM
        ▲                                      │
        │  run_command (olay)                  │  read/write/str_replace
        │                                      ▼  (köprü üzerinden SUNUCU yapar)
        └──── /exec ◀──── Local Bridge ◀───────┘
```

- **Dosya okuma/yazma/düzenleme** sunucu tarafında, köprü üzerinden yapılır.
- **Kabuk komutları** (`run_command`) istemciye olay olarak gelir; SDK bunları
  köprünün `/exec` ucunda çalıştırıp çıktıyı bir sonraki tura geri besler.
  Böylece ajan testleri çalıştırıp çıktıya göre kendini düzeltebilir.
- Köprü vermezseniz araçsız (yalnız sohbet) başsız tamamlama elde edersiniz.

## Önkoşullar

1. Craft.Coder sunucusu çalışıyor olmalı: `npm run dev` (vars. `http://localhost:3000`).
2. Dosya/kabuk araçları için Local Bridge çalışıyor olmalı: `node local-bridge/server.js`
   (adres + token; bkz. `local-bridge/README.md`).

## CLI kullanımı

```bash
# Yalnız sohbet (araçsız)
node sdk/cli.mjs --base-url https://openrouter.ai/api/v1 --model openai/gpt-4o-mini \
  --api-key sk-... "Bu repo ne işe yarıyor?"

# Yerel dosya/kabuk erişimiyle gerçek görev
node sdk/cli.mjs -p "auth.ts'e basit bir rate-limit ekle ve testleri çalıştır" \
  --base-url https://api.groq.com/openai/v1 --model llama-3.3-70b-versatile --api-key gsk-... \
  --bridge-url http://localhost:4319 --bridge-token GIZLI_TOKEN

# Boru hattı + makine-okur JSONL olay akışı
echo "lint hatalarını düzelt" | node sdk/cli.mjs --json --bridge-url http://localhost:4319
```

Asistan metni **stdout**'a, araç/komut izleri **stderr**'e yazılır → çıktıyı
güvenle boru hattında kullanabilirsiniz. `--json` ile her olay tek satır JSON olur.

### Ortam değişkenleri (bayrak öncelikli)

| Değişken | Karşılığı |
| --- | --- |
| `CRAFTCODER_APP_URL` | `--app-url` (vars. `http://localhost:3000`) |
| `CRAFTCODER_BASE_URL` | `--base-url` |
| `CRAFTCODER_MODEL` | `--model` |
| `CRAFTCODER_API_KEY` | `--api-key` |
| `CRAFTCODER_PROVIDER` | `--provider` |
| `CRAFTCODER_BRIDGE_URL` | `--bridge-url` |
| `CRAFTCODER_BRIDGE_TOKEN` | `--bridge-token` |

```bash
export CRAFTCODER_BASE_URL=https://openrouter.ai/api/v1
export CRAFTCODER_MODEL=openai/gpt-4o-mini
export CRAFTCODER_API_KEY=sk-...
node sdk/cli.mjs "değişiklikleri özetle"
```

## Programatik (SDK) kullanım

```js
import { streamAgent, runAgent } from "./sdk/craftcoder.mjs";

// 1) Olay akışı (ince taneli)
for await (const ev of streamAgent({
  prompt: "package.json'daki bağımlılıkları listele",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openai/gpt-4o-mini",
  apiKey: process.env.OPENROUTER_KEY,
  bridge: { url: "http://localhost:4319", token: process.env.BRIDGE_TOKEN },
})) {
  if (ev.type === "text") process.stdout.write(ev.text);
  if (ev.type === "command") console.error("$", ev.command);
}

// 2) Tek seferde sonuç
const { text, commands } = await runAgent({
  prompt: "README'yi bir cümlede özetle",
  baseUrl: "https://api.pollinations.ai/openai", // anahtarsız
  model: "openai",
});
console.log(text);
```

### `AgentOptions`

| Alan | Tip | Açıklama |
| --- | --- | --- |
| `prompt` | `string` | Kullanıcı talimatı (zorunlu) |
| `baseUrl` | `string` | OpenAI-uyumlu LLM API tabanı (zorunlu) |
| `model` | `string` | Model adı (zorunlu) |
| `apiKey` | `string?` | API anahtarı (Pollinations için boş olabilir) |
| `provider` | `string?` | Sağlayıcı kimliği |
| `appUrl` | `string?` | Craft.Coder sunucusu (vars. `http://localhost:3000`) |
| `systemPrompt` | `string?` | Sistem yönergesi eki |
| `bridge` | `{url, token}?` | Yerel dosya/kabuk erişimi → araçları açar |
| `tools` | `boolean?` | Araçları zorla aç/kapat (vars. köprü varsa açık) |
| `maxTurns` | `number?` | `run_command` geri-besleme döngüsü sınırı (vars. 12) |
| `temperature`, `maxTokens`, `effort` | — | LLM ayarları |

### Olay tipleri (`streamAgent`)

`text` · `reasoning` · `tool` (`phase: start|end`) · `command` (`command`, `output`)
· `turn-end` (`reason`) · `warning` · `done` (`text`)

## Güvenlik

- Köprü, başlatıldığı kök dizinle sınırlıdır ve token ile korunur; SDK yalnızca
  sizin verdiğiniz adrese/token'a bağlanır.
- `run_command` çıktısı modele geri beslendiğinden, güvenmediğiniz istemleri
  yetkisiz bir köprüye yöneltmeyin. Döngü `maxTurns` ile sınırlandırılmıştır.
