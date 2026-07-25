/* Sağlayıcı uyumluluk düşürme (P1/P2).

   Sorun: Umai her isteğe bir dizi OPSİYONEL yetenek alanı ekliyor — `tools`
   (ask_user/web_search/run_code), `response_format`, `reasoning` /
   `reasoning_effort`, cömert bir `max_tokens`, `temperature`. Bu alanların
   hepsini her model kabul etmiyor (NVIDIA NIM kataloğundaki birçok model
   function-calling desteklemez; OpenAI'ın o-serisi `max_tokens` yerine
   `max_completion_tokens` ister ve varsayılan dışı `temperature` reddeder).
   Reddedince sağlayıcı 400 döner ve eski davranışta istek DOĞRUDAN sıradaki
   modele düşerdi — kullanıcı "istediğim model cevap vermiyor, diğer modele
   geçildi" uyarısını görürdü. Oysa sorun modelde değil, gönderdiğimiz fazladan
   alandaydı.

   Çözüm: hatayı OKU, sağlayıcının şikayet ettiği alanı düşür ve AYNI modelle
   tekrar dene. Ancak o da olmazsa fallback zincirine geç.

   Saf fonksiyonlar → birim testli. */

/** İsteğin "olmazsa da olur" alanları — genel 400'de topluca düşürülür. */
const OPTIONAL_FIELDS = ["tools", "tool_choice", "response_format", "reasoning", "reasoning_effort"] as const;

/** Düşürme sonrası güvenli kabul edilen çıktı sınırı (çoğu küçük/ücretsiz
    modelin kabul ettiği aralık). */
const SAFE_MAX_TOKENS = 4096;

export interface DowngradeResult {
  body: Record<string, unknown>;
  /** Ne düşürüldüğü — log/teşhis ve testler için. */
  dropped: string[];
}

/** Sağlayıcı hata metnine bakarak isteği bir kademe "uyumlu" hale getirir.
    Düşürülecek bir şey kalmadıysa null döner (çağıran fallback'e geçer). */
export function downgradeRequest(
  body: Record<string, unknown>,
  errorText: string,
): DowngradeResult | null {
  const low = (errorText || "").toLowerCase();
  const next: Record<string, unknown> = { ...body };
  const dropped: string[] = [];

  const drop = (k: string) => {
    if (k in next) { delete next[k]; dropped.push(k); }
  };

  /* 1) Araç/fonksiyon çağrısı desteklenmiyor. */
  if (/\btool|function[_ ]?call|functions\b/.test(low)) {
    drop("tools");
    drop("tool_choice");
  }

  /* 2) JSON modu desteklenmiyor. */
  if (/response_format|json[_ ]?object|json mode/.test(low)) drop("response_format");

  /* 3) Muhakeme alanları desteklenmiyor. */
  if (/reasoning/.test(low)) { drop("reasoning"); drop("reasoning_effort"); }

  /* 4) Token alanı: ya ADI yanlış (OpenAI o-serisi max_completion_tokens
        ister) ya da DEĞER fazla büyük. */
  if (/max[_ ]?tokens|max[_ ]?completion[_ ]?tokens/.test(low)) {
    if (/max[_ ]?completion[_ ]?tokens/.test(low) && typeof next.max_tokens === "number") {
      next.max_completion_tokens = next.max_tokens;
      delete next.max_tokens;
      dropped.push("max_tokens→max_completion_tokens");
    } else {
      for (const key of ["max_tokens", "max_completion_tokens"]) {
        const v = next[key];
        if (typeof v === "number" && v > SAFE_MAX_TOKENS) {
          next[key] = SAFE_MAX_TOKENS;
          dropped.push(`${key}=${SAFE_MAX_TOKENS}`);
        }
      }
    }
  }

  /* 5) temperature/top_p desteklenmiyor (o-serisi yalnız varsayılanı kabul eder). */
  if (/temperature|top[_ ]?p/.test(low)) { drop("temperature"); drop("top_p"); }

  /* 6) Hata metni hiçbir alanı işaret etmiyorsa (sağlayıcı ayrıntı vermemiş):
        tüm opsiyonel yetenek alanlarını TEK seferde düşür — model adı/anahtar
        doğruysa istek büyük olasılıkla bu sayede geçer. */
  if (dropped.length === 0) {
    for (const k of OPTIONAL_FIELDS) drop(k);
    const v = next.max_tokens;
    if (typeof v === "number" && v > SAFE_MAX_TOKENS) {
      next.max_tokens = SAFE_MAX_TOKENS;
      dropped.push(`max_tokens=${SAFE_MAX_TOKENS}`);
    }
  }

  return dropped.length ? { body: next, dropped } : null;
}

/* ── P2: OpenAI muhakeme modelleri (o1/o3/o4/gpt-5) ─────────────────────
   Bu aile `max_tokens`ı REDDEDER (`max_completion_tokens` ister) ve varsayılan
   dışı `temperature`/`top_p` kabul etmez. Önceden her isteğe ikisi de
   ekleniyordu → bu modeller pratikte HİÇ çalışmıyordu. Düşürme mekanizması
   bunu zaten kurtarır ama bir tur boşa gider; baştan doğru göndermek daha iyi. */

export function isOpenAiReasoningModel(provider: string, model: string): boolean {
  return provider === "openai" && /^(o1|o3|o4|gpt-5)/i.test((model || "").trim());
}

/** o-serisi için istek gövdesini yerinde uyarlar (kopya döndürür). */
export function adaptForOpenAiReasoning(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  if (typeof next.max_tokens === "number") {
    next.max_completion_tokens = next.max_tokens;
    delete next.max_tokens;
  }
  delete next.temperature;
  delete next.top_p;
  return next;
}
