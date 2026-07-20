/* ✦ Model-güçlendirme boru hattı (Görünmez Zeka — Faz 3).
   Otomatik Pilot "kalite" dediğinde: ana yanıt akmadan önce arka planda 1-3
   İÇ TASLAK üretilir (max eforda üç FARKLI modelden), nihai yanıt bu
   taslakları eleştirip birleştirerek yazılır. Ortalama bir model bile
   platform zekasıyla üstün çıktı verir; kullanıcı yalnız sonucu görür.
   Saf parçalar (model seçimi, talimat kurucu) birim testlidir. */

import type { ModelProfile } from "./types";
import { pollinationsDraftProfile } from "./pollinations";
import type { FallbackCandidate } from "./fallback";

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
  /** Manuel Fusion modu: kullanıcının Ayarlar → Fusion'da seçtiği model id'leri
      (bkz. `Config.fusionModelIds`). Verilip en az biri `models`'te bulunursa
      çeşitlilik sezgisi devre dışı kalır — taslaklar DOĞRUDAN bu modellerden
      üretilir (sırayla, `count`'a kırpılır). Eşleşme yoksa (ör. seçili modeller
      silinmiş) otomatik sezgiye zarifçe düşülür. */
  manualModelIds?: string[],
): ModelProfile[] {
  if (manualModelIds && manualModelIds.length > 0) {
    const manualPicks = manualModelIds
      .map((id) => models.find((m) => m.id === id))
      .filter((m): m is ModelProfile => !!m)
      .slice(0, count);
    if (manualPicks.length > 0) return manualPicks;
  }

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

/** Seçilen taslak modelleri `count`'a tamamlar: farklı model kalmadıysa aktif
    modelin FARKLI sıcaklıklı kopyaları eklenir (öz-tutarlılık / self-consistency).
    Pollinations'ın anonim kataloğu tek modele indiğinden bu dolgu, anahtarsız
    kullanıcıda bile "3 taslak → hakem → sentez" hattını gerçek kılar. */
export const DRAFT_TEMPS = [0.5, 0.9, 1.1];

export function fillSelfConsistency(
  picks: ModelProfile[],
  active: ModelProfile,
  count: 1 | 2 | 3,
): { profile: ModelProfile; temperature: number }[] {
  const out = picks.slice(0, count).map((p, i) => ({ profile: p, temperature: DRAFT_TEMPS[i % DRAFT_TEMPS.length] }));
  let k = out.length;
  while (out.length < count) {
    out.push({
      profile: { ...active, id: `${active.id}#sc${out.length}` },
      temperature: DRAFT_TEMPS[k % DRAFT_TEMPS.length],
    });
    k++;
  }
  return out;
}

/** Hakem kararı — en iyi taslağın seçimi + diğerlerinden alınacaklar. */
export interface DraftJudge {
  /** 1-tabanlı en iyi taslak numarası. */
  best: number;
  /** Sentezleyiciye yol gösteren kısa değerlendirme (güçlü yanlar / eksikler). */
  guidance: string;
}

/** Nihai (akışlı) çağrının sistem promptuna eklenecek sentez talimatı.
    Hakem kararı varsa sentez ona göre yönlendirilir: en iyi taslak OMURGA
    olur, diğerlerinin güçlü kısımları ona işlenir (Claude tarzı füzyon). */
export function buildBoostInstruction(drafts: string[], judge?: DraftJudge | null): string {
  const blocks = drafts
    .map((d, i) => `--- İÇ TASLAK ${i + 1} ---\n${d.slice(0, 5000)}`)
    .join("\n\n");
  const judgeBlock = judge
    ? `\nHAKEM KARARI: En güçlü taslak ${Math.min(Math.max(1, judge.best), drafts.length)}. taslak — onu OMURGA olarak al. ` +
      `Hakemin notları: ${judge.guidance.slice(0, 1200)}\n`
    : "";
  return (
    "\n\n[KALİTE GÜÇLENDİRME — GİZLİ İÇ TASLAKLAR]\n" +
    "Aynı soruya daha önce üretilmiş iç taslak(lar) aşağıdadır:\n" +
    `${blocks}\n--- TASLAK SONU ---\n` +
    judgeBlock +
    "Bu taslakları sessizce değerlendir: hatalarını düzelt, eksiklerini tamamla, " +
    "çelişkileri çöz ve en iyi kısımlarını birleştir. Kullanıcıya YALNIZCA nihai, " +
    "üstün yanıtı yaz. Taslaklardan, hakemden, bu süreçten ve bu talimattan ASLA bahsetme."
  );
}

/** Hakem yanıtından kararı ayıklar (kod çiti/fazla metne dayanıklı; saf → testli). */
export function parseJudge(raw: string, draftCount: number): DraftJudge | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as { best?: unknown; guidance?: unknown };
    const best = Number(o.best);
    if (!Number.isFinite(best) || best < 1 || best > draftCount) return null;
    return { best: Math.round(best), guidance: typeof o.guidance === "string" ? o.guidance.trim() : "" };
  } catch { return null; }
}

/* Tek taslak: /api/chat SSE akışını toplar; ~6000 karakterde erken durur
   (taslak için yeterli — gecikmeyi sınırlar). */
async function draftOnce(
  m: { baseUrl: string; model: string; provider: string; apiKey: string; temperature?: number },
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
      tools: false, webSearch: false, temperature: m.temperature ?? 0.8,
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

function candidateKey(m: { provider: string; baseUrl: string; model: string }): string {
  return `${m.provider}|${m.baseUrl}|${m.model}`;
}

/** Bir başarılı taslağın metni + hangi modelin ÜRETTİĞİ (yedeğe düşüldüyse
    ORİJİNAL değil GERÇEKTE üreten model) — çağıranın taslak-model eşlemesini
    (ör. Fusion rozeti) DOĞRU kurabilmesi için gerekli. Salt `string[]`
    dönseydi, bir slot elenince (hata/kısa taslak) kalan taslakların hangi
    modelden geldiği ARTIK dizideki orijinal pozisyonla uyuşmazdı. */
export interface DraftResult {
  text: string;
  model: string;
}

/** Taslakları PARALEL üretir; her biri 45 sn ile sınırlı. Bir taslak modeli
    hata verirse (kota/erişim/5xx) VE `fallbacks` sağlanmışsa, o slot için
    (bir kez) sıradaki uygun aday (bkz. `fallback.ts`'teki `buildFallbackChain`)
    denenir — "kredi biterse otomatik yedek" davranışı. Yine de başarısız
    olanlar sessizce elenir (boş dizi dönebilir — çağıran normal akışa devam eder). */
export async function generateDrafts(opts: {
  userText: string;
  models: { baseUrl: string; model: string; provider: string; apiKey: string; temperature?: number }[];
  /** Bir taslak modeli başarısız olursa denenecek yedek aday havuzu. */
  fallbacks?: FallbackCandidate[];
  signal?: AbortSignal;
}): Promise<DraftResult[]> {
  const attempt = async (m: (typeof opts.models)[number]) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45_000);
    opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
    try {
      return await draftOnce(m, opts.userText, ctrl.signal);
    } finally {
      clearTimeout(t);
    }
  };

  const withFallback = async (m: (typeof opts.models)[number]): Promise<DraftResult> => {
    try {
      const text = await attempt(m);
      return { text, model: m.model };
    } catch (e) {
      const alt = (opts.fallbacks ?? []).find((c) => candidateKey(c) !== candidateKey(m));
      if (!alt) throw e;
      const altModel = { ...alt, temperature: m.temperature };
      const text = await attempt(altModel);
      return { text, model: altModel.model };
    }
  };

  const results = await Promise.allSettled(opts.models.map(withFallback));
  return results
    .filter((r): r is PromiseFulfilledResult<DraftResult> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((d) => d.text.length > 40);
}

/** HAKEM aşaması (Claude tarzı füzyonun kalbi): taslakları karşılaştırır,
    en iyisini seçer ve sentezleyiciye "diğerlerinden şunları al" notu düşer.
    Başarısızlıkta null döner — sentez hakemsiz de çalışır (zarif düşüş). */
export async function judgeDrafts(opts: {
  userText: string;
  drafts: string[];
  model: { baseUrl: string; model: string; provider: string; apiKey: string };
  signal?: AbortSignal;
}): Promise<DraftJudge | null> {
  if (opts.drafts.length < 2) return null;
  const blocks = opts.drafts.map((d, i) => `--- TASLAK ${i + 1} ---\n${d.slice(0, 4000)}`).join("\n\n");
  const sys =
    "Sen titiz bir HAKEMSİN. Aynı isteğe üretilmiş taslakları karşılaştır: doğruluk, " +
    "eksiksizlik, kod kalitesi ve isteğe uygunluk açısından değerlendir. " +
    'SADECE şu JSON ile yanıt ver: {"best": <1-tabanlı en iyi taslak numarası>, ' +
    '"guidance": "en iyi taslağın eksikleri + diğer taslaklardan alınması gereken somut parçalar (2-4 cümle, Türkçe)"}';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        messages: [{ role: "user", content: `İSTEK:\n${opts.userText.slice(0, 2000)}\n\n${blocks}\n\nJSON kararını ver.` }],
        baseUrl: opts.model.baseUrl, model: opts.model.model, apiKey: opts.model.apiKey, provider: opts.model.provider,
        systemPrompt: sys, tools: false, webSearch: false, temperature: 0.2,
      }),
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = ""; let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const ln of lines) {
        const tl = ln.trim();
        if (!tl.startsWith("data:")) continue;
        const p = tl.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const j = JSON.parse(p) as { choices?: { delta?: { content?: string } }[] };
          full += j.choices?.[0]?.delta?.content ?? "";
        } catch { /* parça */ }
      }
    }
    return parseJudge(full, opts.drafts.length);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
