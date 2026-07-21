import { useStore } from "./store";
import { buildFallbackChain } from "./fallback";
import { decryptField, isEncrypted } from "./secureKeys";
import { buildSingleBlockPreview, parseBlocks } from "./preview";
import { CATEGORY_CRAFT, CRAFT_RULES, lintArtifact } from "./studioCraft";
import { skillById, directionById } from "./studioConstants";
import type { Artifact } from "./types";

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
  /** Hareketli/animasyonlu çıktı (CSS animasyonları). */
  animate?: boolean;
  /** Fusion: `boost.ts`'in `buildBoostInstruction()`'ından gelen gizli-taslak
      sentez talimatı — verilmişse sistem promptunun en sonuna eklenir. */
  boostInstruction?: string;
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

/* JSON/kod blokları dışındaki metni göster (akışta 'üretiliyor' hissi). */
function stripCode(s: string): string {
  return s.replace(/```[\s\S]*?(```|$)/g, "").trim();
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

export function buildStudioSystem(opts: Pick<GenerateOptions, "skillId" | "directionId" | "designSystemPrompt" | "prevHtml" | "comment" | "animate" | "boostInstruction">): string {
  /* Kompozisyon sırası (Open Design dersi): marka sözleşmesi ÖNCE ve otoriter,
     zanaat kuralları sonra (çakışmada marka kazanır), tür talimatı en sonda. */
  let sys = STUDIO_SYSTEM_BASE;
  if (opts.designSystemPrompt?.trim()) sys += `\n\n[Marka tasarım sistemi — YALNIZCA görsel/HTML çıktı üretiyorsan renk/tipografi/boşlukta OTORİTER, buna UY; kod/doküman/diyagram üretiyorsan bu bölümü YOK SAY]:\n${opts.designSystemPrompt.trim()}`;
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
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      messages: [{ role: "user", content: opts.brief }],
      baseUrl: resolved.baseUrl, model: resolved.model, apiKey: resolved.apiKey, provider: resolved.provider,
      systemPrompt: sys,
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
        const d = j.choices?.[0]?.delta?.content ?? "";
        if (d) { full += d; opts.onDelta?.(stripCode(full)); }
      } catch { /* parçalı satır */ }
    }
  }

  opts.onPhase?.("rendering");
  const blocks = parseBlocks(full);
  const block = blocks.find((b) => ["html", "htm", "jsx", "tsx", "react", "js", "javascript", "svg"].includes(b.lang)) || blocks[0];
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
  if (!artifact) { opts.onPhase?.("error"); throw new Error("Üretim ayrıştırılamadı — brief'i biraz daha açık yaz."); }

  opts.onPhase?.("done");
  /* Kalite denetimi (danışma niteliğinde) yalnızca görsel/HTML çıktılar için
     anlamlı — kod/doküman/diyagram çıktılarında hex renk/viewport kontrolü
     konu dışı, sessizce atlanır. */
  const warnings = artifact.type === "html" ? lintArtifact(artifact.content) : [];
  const note = warnings.length ? `\n\n🧹 Kalite notu: ${warnings.join(" · ")}. İstersen "düzelt" de, gidereyim.` : "";
  return { artifact, text: (stripCode(full) || "Oluşturdum.") + note };
}
