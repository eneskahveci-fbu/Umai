import { useStore } from "./store";
import { buildFallbackChain } from "./fallback";
import { decryptField, isEncrypted } from "./secureKeys";
import { buildSingleBlockPreview } from "./preview";
import { extractBlocks, pickBlock, classifyFailure, failureMessage, STRICT_FORMAT_REMINDER } from "./studioExtract";
import { CATEGORY_CRAFT, CRAFT_RULES, lintArtifact } from "./studioCraft";
import { skillById, directionById } from "./studioConstants";
import { extractJson } from "./slides";
import type { Artifact, Config } from "./types";

/* Stüdyo üretim motoru — Claude Artifacts paritesi: brief (+ opsiyonel skill/yön)
   → LLM formatı SEÇER (html/jsx/kod/markdown/mermaid) → uygun tipte artifact
   (html/svg/mermaid/code/markdown). Mevcut /api/chat akışı, fallback zinciri
   ve preview.ts yeniden kullanılır. */

export type StudioPhase = "planning" | "generating" | "rendering" | "done" | "error";

export interface GenerateOptions {
  brief: string;
  skillId?: string | null;
  directionId?: string | null;
  /** Aktif tasarım sisteminin DESIGN.md özeti (FAZ 2'de dolu gelir). */
  designSystemPrompt?: string;
  /** Değişiklik turu için önceki HTML (TEMEL alınır). */
  prevHtml?: string;
  /** Yorum-modu: önizlemede seçilen öğeye dair hedefli düzenleme notu. */
  comment?: string;
  /** Referans görsel(ler) — composer'daki ataç düğmesinden eklenir (data URI).
      Vision-uyumlu modelde brief'in yanında gönderilir (ör. "bu görseldeki
      gibi bir tasarım yap"). */
  images?: string[];
  /** Hareketli/animasyonlu çıktı (CSS animasyonları). */
  animate?: boolean;
  /** Fusion: `boost.ts`'in `buildBoostInstruction()`'ından gelen gizli-taslak
      sentez talimatı — verilmişse sistem promptunun en sonuna eklenir. */
  boostInstruction?: string;
  /** Aktif marka tasarım sisteminin Google Fonts <link> etiketi (varsa) —
      designSystems.ts'teki DesignSystem.fontLink. Üretim SONRASI html
      artifact'ın <head>'ine enjekte edilir (bkz. ensureFontLink) — modelin
      bunu kendi başına eklemesine GÜVENİLMEZ. */
  fontLink?: string;
  onDelta?: (text: string) => void;
  onPhase?: (p: StudioPhase) => void;
  signal?: AbortSignal;
}

export interface GenerateResult {
  artifact: Artifact;   // { type, content } — iframe'de render edilebilir
  text: string;         // asistanın açıklama metni (kod blokları çıkarılmış)
}

const STUDIO_SYSTEM_BASE =
  "Sen Claude'un Artifacts özelliğine paralel çalışan kıdemli bir yaratıcı + teknik asistansın. " +
  "Kullanıcının isteğine göre EN UYGUN formatta TEK, kendi kendine yeten, üretim kalitesinde bir çıktı üret. " +
  "Formatı kullanıcının ne istediğine bakarak SEN seç:\n" +
  "• Görsel tasarım / web sayfası / mobil ekran / arayüz mockup'ı → TEK bir ```html bloğu (inline CSS, gerekirse vanilla JS).\n" +
  "• İnteraktif bileşen/uygulama (React ile daha iyi ifade ediliyorsa) → TEK bir ```jsx bloğu, bir App bileşeniyle.\n" +
  "• Kod (script, fonksiyon, algoritma — herhangi bir dilde) → o dilin adıyla TEK bir kod bloğu (ör. ```python, ```go, ```sql). Çalışan, temiz, gerekli yerde yorumlu.\n" +
  "• Doküman / rapor / makale / özet / plan → TEK bir ```markdown bloğu. Net başlık hiyerarşisi, taranabilir yapı.\n" +
  "• Diyagram / akış şeması / mimari şema / ilişki grafiği → TEK bir ```mermaid bloğu.\n" +
  "• Basit veri tablosu → ```markdown içinde bir tablo YETERLİ; görsel/etkileşimli bir tablo isteniyorsa ```html kullan.\n" +
  "Görsel/HTML çıktılarda: net görsel hiyerarşi, dengeli boşluk ritmi, tutarlı tipografik ölçek, erişilebilir kontrast, ince mikro-etkileşimler (hover/transition); lorem ipsum yerine konuya uygun gerçekçi içerik yaz. " +
  "Görsel gerekiyorsa: CSS gradient/SVG; FOTOĞRAF için picsum.photos; KONUYA ÖZEL AI görseli için " +
  "https://image.pollinations.ai/prompt/<URL-encoded%20İngilizce%20açıklama>?width=800&height=600&nologo=true (anahtarsız) kullan. " +
  "SADECE tek kod bloğunu döndür, ekstra açıklama yazma.";

/* Sunum (deck) için çok-slaytlı, kendi kendine gezinen HTML talimatı. */
const DECK_INSTRUCTION =
  "\n\n[SUNUM MODU]: Çok-slaytlı bir SUNUM üret — her slayt tam ekran bir <section class=\"slide\"> (100vw×100vh, grid ortalı). " +
  "5-8 slayt: kapak, ajanda, 3-5 içerik slaytı, kapanış. Slaytlar arası ok tuşları + ekrana tıkla ile gezinme için kısa vanilla JS ekle " +
  "(geçerli slaytı göster/gizle veya yumuşak kaydır); altta küçük slayt göstergesi (• • •). Büyük tipografi, projeksiyon kontrastı.";

/* Hareket/animasyon talimatı (tarayıcı-uyarlı 'video/motion'). */
const ANIMATE_INSTRUCTION =
  "\n\n[ANİMASYON]: Zarif CSS animasyonları ekle — öğeler için yumuşak giriş (fade/slide-up, kademeli gecikme), " +
  "hover mikro-etkileşimleri ve sürekli ince hareketler (arka plan gradyan kayması vb.). Abartma; akıcı ve profesyonel olsun.";

/* Referans görsel derinleştirme (H2): önceden görsel(ler) yalnız vision
   mesajının içine ekleniyordu, sistem promptu görseli NASIL kullanacağını
   hiç söylemiyordu — model çoğu zaman görseli göz ardı edip brief metnine
   yaslanıyordu. Artık AÇIKÇA: paleti/tipografi hissini/kompozisyon mantığını
   ÇIKAR ve uygula (birebir kopya değil, ilham) deniyor; marka tasarım
   sistemiyle çakışırsa (designSystemPrompt) marka kazanır — kompozisyon
   sırası bunu zaten garanti eder (bu talimat marka bloğundan SONRA eklenir). */
const IMAGE_REFERENCE_INSTRUCTION =
  "\n\n[REFERANS GÖRSEL]: Kullanıcı yukarıda bir veya daha fazla referans görsel ekledi. Bunları SADECE " +
  "betimleme olarak değil, somut tasarım girdisi olarak kullan: baskın renk paletini, tipografi hissini " +
  "(kalın/ince, geometrik/organik), kompozisyon/mizanpaj mantığını ve genel tonu (ör. minimal/maksimalist, " +
  "koyu/açık) ÇIKAR ve üretime YANSIT — birebir kopyalama değil, ilham al. Aktif bir marka tasarım sistemi " +
  "varsa (yukarıda) O OTORİTER kalır; çakışmada marka kazanır, görsel yalnız onu tamamlar.";

/* JSON/kod blokları dışındaki metni göster (akışta 'üretiliyor' hissi). */
function stripCode(s: string): string {
  return s.replace(/```[\s\S]*?(```|$)/g, "").trim();
}

/* H3 — modelin fontLink talimatına uyacağını UMMAK yerine GARANTİ eder
   (G1'deki "her slayta görsel garantisi" ile aynı ilke): <head> varsa içine,
   yoksa (parçalı/component çıktı) dokunmadan bırakır. Zaten eklenmişse
   (model yine de eklediyse) yinelenmez. */
export function ensureFontLink(html: string, fontLink: string | undefined): string {
  if (!fontLink || html.includes("fonts.googleapis.com")) return html;
  const closeIdx = html.search(/<\/head>/i);
  if (closeIdx !== -1) return html.slice(0, closeIdx) + fontLink + html.slice(closeIdx);
  const openMatch = html.match(/<head[^>]*>/i);
  if (openMatch && openMatch.index !== undefined) {
    const i = openMatch.index + openMatch[0].length;
    return html.slice(0, i) + fontLink + html.slice(i);
  }
  return html;
}

/** Eleştiri yanıtından notu ayıklar (kod çiti/fazla metne dayanıklı; saf →
    testli — boost.ts'in parseJudge()'ıyla AYNI desen). */
export function parseCritique(raw: string): string | null {
  const json = extractJson(raw);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { ok?: boolean; note?: string };
    return parsed.note?.trim() || null;
  } catch {
    return null;
  }
}

/* H1 — Üretim sonrası görsel kalite eleştirisi: lintArtifact (yukarıda,
   regex-tabanlı: hex sayısı/klişe palet/lorem-ipsum/viewport) YAKALAYAMADIĞI
   şeyleri hedefler — hiyerarşi, klişe kompozisyon, ritim. boost.ts'in
   judgeDrafts()'ıyla AYNI ruhta ek/ucuz bir LLM turu (tek taslak, kısa JSON
   yanıt). Yalnız html artifact'larda anlamlı; başarısızlıkta/zaman aşımında
   SESSİZCE null döner — üretimi ASLA engellemez, yalnız notu eksik kalır. */
async function critiqueArtifact(
  html: string, brief: string,
  resolved: { baseUrl: string; model: string; apiKey: string; provider: string },
  cfg: Config, signal?: AbortSignal,
): Promise<string | null> {
  const sys =
    "Sen kıdemli bir art director'sın. Sana bir isteğe karşılık üretilmiş HTML/tasarım kodu verilecek. " +
    "Görsel hiyerarşi, kontrast, boşluk ritmi, tipografik tutarlılık ve klişe kompozisyon (jenerik gradient " +
    "kutular, tekdüze kart ızgaraları, aşırı emoji) açısından değerlendir. Yalnız GERÇEKTEN göze çarpan EN ÖNEMLİ " +
    "sorunu bul; küçük/tartışmalı kusurları görmezden gel. " +
    'SADECE şu JSON ile yanıt ver: {"ok": true|false, "note": "sorun yoksa boş string, varsa tek somut ' +
    'iyileştirme önerisi — kısa, Türkçe, 1 cümle"}';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        messages: [{ role: "user", content: `İSTEK: ${brief.slice(0, 500)}\n\nÜRETİLEN KOD:\n${html.slice(0, 6000)}` }],
        baseUrl: resolved.baseUrl, model: resolved.model, apiKey: resolved.apiKey, provider: resolved.provider,
        systemPrompt: sys, fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
        tools: false, webSearch: false, temperature: 0.2, jsonMode: true,
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
    return parseCritique(full);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* Sunum Stüdyosu (slidesGen) da aynı model çözümlemesini kullanır. */
export async function resolveKey(): Promise<{ baseUrl: string; model: string; apiKey: string; provider: string } | null> {
  const store = useStore.getState();
  const active = store.strongestModel() ?? store.activeModel();
  if (!active) return null;
  let apiKey = active.apiKey || (store.config.providerKeys as Record<string, string> | undefined)?.[active.provider] || "";
  if (apiKey) {
    apiKey = await decryptField(apiKey);
    if (isEncrypted(apiKey)) apiKey = "";
  }
  return { baseUrl: active.baseUrl, model: active.model, apiKey, provider: active.provider };
}

export function buildStudioSystem(opts: Pick<GenerateOptions, "skillId" | "directionId" | "designSystemPrompt" | "prevHtml" | "comment" | "animate" | "boostInstruction" | "images">): string {
  /* Kompozisyon sırası (Open Design dersi): marka sözleşmesi ÖNCE ve otoriter,
     zanaat kuralları sonra (çakışmada marka kazanır), tür talimatı en sonda. */
  let sys = STUDIO_SYSTEM_BASE;
  if (opts.designSystemPrompt?.trim()) sys += `\n\n[Marka tasarım sistemi — YALNIZCA görsel/HTML çıktı üretiyorsan renk/tipografi/boşlukta OTORİTER, buna UY; kod/doküman/diyagram üretiyorsan bu bölümü YOK SAY]:\n${opts.designSystemPrompt.trim()}`;
  if (opts.images?.length) sys += IMAGE_REFERENCE_INSTRUCTION;
  sys += CRAFT_RULES;
  const skill = skillById(opts.skillId);
  if (skill) {
    sys += `\n\n[Çıktı türü — ${skill.name}]: ${skill.instructions}`;
    /* Kategori bazlı mükemmellik bilgisi (Gamma/Google AI Studio/LibreOffice
       vb. kategori liderlerinden damıtılmış, görünmez referans) — bkz.
       studioCraft.ts. */
    sys += CATEGORY_CRAFT[skill.category] ?? "";
  }
  if (opts.skillId === "deck") sys += DECK_INSTRUCTION;
  if (opts.animate) sys += ANIMATE_INSTRUCTION;
  const dir = directionById(opts.directionId);
  if (dir) sys += `\n\n[Tasarım yönü — ${dir.name}]: ${dir.hint}`;
  if (opts.prevHtml?.trim()) sys += `\n\n[Mevcut tasarım — değişiklik isteniyorsa bunu TEMEL al]:\n${opts.prevHtml.slice(0, 9000)}`;
  if (opts.comment?.trim()) sys += `\n\n[Hedefli düzenleme — kullanıcı önizlemede şu öğeyi işaretledi]: ${opts.comment.trim()}`;
  if (opts.boostInstruction) sys += opts.boostInstruction;
  return sys;
}

export async function generateArtifact(opts: GenerateOptions): Promise<GenerateResult> {
  opts.onPhase?.("planning");
  const resolved = await resolveKey();
  if (!resolved) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
  const cfg = useStore.getState().config;
  const sys = buildStudioSystem(opts);

  opts.onPhase?.("generating");
  /* Referans görsel(ler) varsa mesajı çok-parçalı (vision) içerik olarak kur —
     ana sohbetteki (CoderView) `m.images` → image_url dönüşümüyle AYNI şekil. */
  const userContent: unknown = opts.images?.length
    ? [...opts.images.map((img) => ({ type: "image_url", image_url: { url: img } })), { type: "text", text: opts.brief }]
    : opts.brief;

  /* Tek bir üretim turu — akışı okur, ham metni döndürür. Yeniden deneme
     (aşağıda) sistem promptuna katı biçim hatırlatması ekleyip bunu TEKRAR
     çağırır; istek kurulumunu iki kez yazmamak için ayrıldı. */
  const runOnce = async (systemPrompt: string): Promise<string> => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: opts.signal,
      body: JSON.stringify({
        messages: [{ role: "user", content: userContent }],
        baseUrl: resolved.baseUrl, model: resolved.model, apiKey: resolved.apiKey, provider: resolved.provider,
        systemPrompt,
        fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
        tools: false, webSearch: false, temperature: 0.6,
      }),
    });
    if (!res.ok || !res.body) {
      /* /api/chat, tüm adaylar tükendiğinde gövdeye OKUNABİLİR bir hata metni
         (friendlyApiError) yazar — bunu okumadan ham "LLM 500" göstermek
         kullanıcıya hiçbir şey anlatmıyordu (bkz. CoderView.tsx'in ana send()'i,
         aynı deseni zaten kullanıyor). */
      const detail = await res.text().catch(() => "");
      throw new Error(detail || `Sağlayıcı hatası (${res.status})`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = ""; let out = "";
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
          const d = j.choices?.[0]?.delta?.content ?? "";
          if (d) { out += d; opts.onDelta?.(stripCode(out)); }
        } catch { /* parçalı satır */ }
      }
    }
    return out;
  };

  let full = await runOnce(sys);

  opts.onPhase?.("rendering");
  /* Kullanıcı hata raporu (Tem 2026): "cv şablonu yap" / "odyssey hakkında
     slayt yap" isteklerinin ikisi de "Üretim ayrıştırılamadı — brief'i biraz
     daha açık yaz." veriyordu. Eski akış yalnız KAPANMIŞ ``` bloklarını
     tanıyordu; model token sınırında kesilince (uzun CV/sunum HTML'inde çok
     olası) kapanış çiti gelmiyor ve hiçbir şey kurtarılamıyordu. extractBlocks
     kapanmamış son bloğu da kurtarır. Blok GERÇEKTEN yoksa bir kez daha,
     katı biçim hatırlatmasıyla denenir. */
  let block = pickBlock(extractBlocks(full));
  if (!block && !/<[a-z]/i.test(full)) {
    const retry = await runOnce(sys + STRICT_FORMAT_REMINDER);
    if (retry.trim()) { full = retry; block = pickBlock(extractBlocks(retry)); }
  }
  let artifact: Artifact | null = null;
  if (block) artifact = buildSingleBlockPreview(block.lang || "html", block.code);
  /* Claude Artifacts paritesi: html/react/svg/mermaid dışında kalan bloklar da
     (buildSingleBlockPreview bunları tanımadığı için null döner) artifact
     olsun — biçimlendirilmiş belge (markdown) ya da herhangi bir dilde kod. */
  if (!artifact && block?.lang) {
    artifact = block.lang === "md" || block.lang === "markdown"
      ? { type: "markdown", content: block.code, title: "Doküman" }
      : { type: "code", content: block.code, title: `${block.lang} kodu`, language: block.lang };
  }
  if (!artifact && /<[a-z]/i.test(full)) artifact = buildSingleBlockPreview("html", full);
  if (!artifact) {
    /* DÜRÜST hata: eski mesaj her durumda brief'i suçluyordu ("brief'i biraz
       daha açık yaz") — oysa neden ya boş yanıt ya da modelin kod bloğu yerine
       düz metin döndürmesiydi; ikisinin de brief'le ilgisi yok. Artık neden
       ayrıştırılıyor ve modelin GERÇEKTE ne döndürdüğü gösteriliyor. */
    opts.onPhase?.("error");
    throw new Error(failureMessage(classifyFailure(full), full));
  }

  /* H3: marka fontu varsa <head>'e GARANTİ et (yalnız html artifact'larda). */
  if (artifact.type === "html" && opts.fontLink) {
    artifact = { ...artifact, content: ensureFontLink(artifact.content, opts.fontLink) };
  }

  opts.onPhase?.("done");
  /* Kalite denetimi (danışma niteliğinde) yalnızca görsel/HTML çıktılar için
     anlamlı — kod/doküman/diyagram çıktılarında hex renk/viewport kontrolü
     konu dışı, sessizce atlanır. */
  const warnings = artifact.type === "html" ? lintArtifact(artifact.content) : [];
  /* H1: rule-based lint'in yakalayamadığı görsel/kompozisyon sorunları için
     ek bir LLM eleştirisi — yalnız html'de, başarısızsa sessizce atlanır. */
  const critique = artifact.type === "html"
    ? await critiqueArtifact(artifact.content, opts.brief, resolved, cfg, opts.signal).catch(() => null)
    : null;
  const allNotes = [...warnings, ...(critique ? [critique] : [])];
  const note = allNotes.length ? `\n\n🧹 Kalite notu: ${allNotes.join(" · ")}. İstersen "düzelt" de, gidereyim.` : "";
  return { artifact, text: (stripCode(full) || "Oluşturdum.") + note };
}
