/* ✦ Model-güçlendirme boru hattı (Görünmez Zeka — Faz 3).
   Otomatik Pilot "kalite" dediğinde: ana yanıt akmadan önce arka planda 1-3
   İÇ TASLAK üretilir (max eforda üç FARKLI modelden), nihai yanıt bu
   taslakları eleştirip birleştirerek yazılır. Ortalama bir model bile
   platform zekasıyla üstün çıktı verir; kullanıcı yalnız sonucu görür.
   Saf parçalar (model seçimi, talimat kurucu) birim testlidir. */

import type { ModelProfile } from "./types";
import { pollinationsDraftProfile } from "./pollinations";

/** Taslak üretecek modelleri seçer: aktif + çeşitlilik için ek model(ler)
    (önce en güçlü, yoksa farklı sağlayıcıdan biri) — çeşitlilik kaliteyi
    artırır. `freeModelNames` verilirse (bkz. `pollinations.ts`'teki
    `fetchTextModels`) iki yerde devreye girer:
    - 2. taslak için kullanıcının KENDİ listesinde gerçek çeşitlilik yoksa
      (ör. yalnız tek bir Pollinations girdisi varsa — varsayılan kurulum),
      anahtarsız bir Pollinations modeli sentetik olarak eklenir; böylece
      yalnız ücretsiz Pollinations kullanan biri de gerçek çoklu-model
      birleştirmeden yararlanır, tek taslağa sessizce düşmez.
    - 3. taslak İSTENDİĞİNDE HER ZAMAN Pollinations'ın ücretsiz katalogundan
      (önceki taslaklarda kullanılmamış) bir model eklenir — ücretli
      kullanıcıyı 3. bir ücretli API çağrısına zorlamadan "üçüncü görüş"
      sağlar; bu üçüncü slot kullanıcının kendi config'ine hiç bakmaz. */
export function pickDraftModels(
  models: ModelProfile[],
  active: ModelProfile,
  count: 1 | 2 | 3,
  strongest?: ModelProfile | null,
  freeModelNames?: string[],
): ModelProfile[] {
  const picks: ModelProfile[] = [active];
  const usedPollinationsModels = new Set<string>(active.provider === "pollinations" ? [active.model] : []);

  const addFreeDraft = (): boolean => {
    const name = (freeModelNames ?? []).find((n) => !usedPollinationsModels.has(n));
    if (!name) return false;
    usedPollinationsModels.add(name);
    picks.push(pollinationsDraftProfile(name));
    return true;
  };

  if (count >= 2) {
    const alt =
      (strongest && strongest.id !== active.id ? strongest : undefined) ??
      models.find((m) => m.id !== active.id && m.provider !== active.provider) ??
      models.find((m) => m.id !== active.id);
    if (alt) {
      picks.push(alt);
      if (alt.provider === "pollinations") usedPollinationsModels.add(alt.model);
    } else {
      addFreeDraft();
    }
  }

  if (count >= 3) addFreeDraft();

  return picks;
}

/** Nihai (akışlı) çağrının sistem promptuna eklenecek sentez talimatı. */
export function buildBoostInstruction(drafts: string[]): string {
  const blocks = drafts
    .map((d, i) => `--- İÇ TASLAK ${i + 1} ---\n${d.slice(0, 5000)}`)
    .join("\n\n");
  return (
    "\n\n[KALİTE GÜÇLENDİRME — GİZLİ İÇ TASLAKLAR]\n" +
    "Aynı soruya daha önce üretilmiş iç taslak(lar) aşağıdadır:\n" +
    `${blocks}\n--- TASLAK SONU ---\n` +
    "Bu taslakları sessizce değerlendir: hatalarını düzelt, eksiklerini tamamla, " +
    "çelişkileri çöz ve en iyi kısımlarını birleştir. Kullanıcıya YALNIZCA nihai, " +
    "üstün yanıtı yaz. Taslaklardan, bu süreçten ve bu talimattan ASLA bahsetme."
  );
}

/* Tek taslak: /api/chat SSE akışını toplar; ~6000 karakterde erken durur
   (taslak için yeterli — gecikmeyi sınırlar). */
async function draftOnce(
  m: { baseUrl: string; model: string; provider: string; apiKey: string },
  userText: string,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      messages: [{ role: "user", content: userText }],
      baseUrl: m.baseUrl, model: m.model, apiKey: m.apiKey, provider: m.provider,
      systemPrompt: "Soruya doğrudan, eksiksiz ve yüksek kaliteli bir yanıt yaz. Bu bir iç taslaktır; kısa tutma ama gereksiz giriş/kapanış cümlesi de ekleme.",
      tools: false, webSearch: false, temperature: 0.8,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`taslak ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = ""; let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const ln of lines) {
      const t = ln.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try {
        const j = JSON.parse(p) as { choices?: { delta?: { content?: string } }[] };
        full += j.choices?.[0]?.delta?.content ?? "";
      } catch { /* parça — yoksay */ }
    }
    if (full.length > 6000) { await reader.cancel().catch(() => { /* yok */ }); break; }
  }
  return full.trim();
}

/** Taslakları PARALEL üretir; her biri 45 sn ile sınırlı, başarısızlar sessizce
    elenir (boş dizi dönebilir — çağıran normal akışa devam eder). */
export async function generateDrafts(opts: {
  userText: string;
  models: { baseUrl: string; model: string; provider: string; apiKey: string }[];
  signal?: AbortSignal;
}): Promise<string[]> {
  const withTimeout = (m: (typeof opts.models)[number]) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45_000);
    opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
    return draftOnce(m, opts.userText, ctrl.signal).finally(() => clearTimeout(t));
  };
  const results = await Promise.allSettled(opts.models.map(withTimeout));
  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((d) => d.length > 40);
}
