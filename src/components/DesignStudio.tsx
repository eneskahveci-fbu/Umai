"use client";

/* ═══════════════════════════════════════════════════════════════════════
   TASARIM STÜDYOSU — Claude Design'ın ETKİLEŞİM desenine paralel: sol
   sohbet, sağ TEK canlı tasarım tuvali. "OpenDesignStudio" (çoklu sayfa/
   format/deck/katman editörü) sadeleştirilerek buna dönüştürüldü — tek
   tasarım alanı, hazır şablonlar (studioTemplates.ts). Composer, Claude
   Design'ın kendi prompt kutusundaki seçeneklerle eşleşir: ataç (referans
   görsel), tasarım sistemi seçici, çoklu model seçici (bkz.
   studio/ComposerExtras.tsx) — kullanıcı kararı (Tem 2026): marka seçici
   geri getirildi, varsayılan Umai'nin kendi sistemi ("craft"). Arayüzün
   KENDİSİ `.theme-claude` TAŞIMAZ — kroma Umai'nin kendi teması uygulanır,
   yalnız üretilen artifact'in KENDİ gömülü CSS'i (iframe içinde, ayrı)
   seçili tasarım sisteminin paletini kullanır. Tuval, sohbetin
   ArtifactPanel'iyle AYNI ArtifactCanvas bileşenini paylaşır (önizleme/kod,
   sürüm gezinme, kopyala/indir/yayınla — tek kaynak).
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, FileCode2, FileText, FolderOpen, Loader2, Paperclip, Save, Sparkles, Square, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { friendlyError } from "@/lib/friendlyError";
import { useSurfaceNav, consumeSurfaceOpenItem } from "@/lib/surfaceNav";
import { generateArtifact, type StudioPhase } from "@/lib/studioGen";
import { autoStudioSkill } from "@/lib/autoPilot";
import type { Artifact, SlideDeck, StudioProject } from "@/lib/types";
import { designSystemById, designSystemPromptText } from "@/lib/designSystems";
import { type StudioTemplate } from "@/lib/studioTemplates";
import { generateDeck, generateDeckFusion, rewriteSlide } from "@/lib/slidesGen";
import { deckToHtml, lintDeck, SLIDE_THEMES } from "@/lib/slides";
import { StudioHomeScreen, EmptyChatHint } from "./studio/StudioHomeScreen";
import { DesignSystemPicker, ModelPicker, TemplatePicker, ImagePreviewStrip } from "./studio/ComposerExtras";
import { VoiceButton } from "./VoiceButton";
import { ArtifactCanvas } from "./ArtifactCanvas";
import { StudioTopBar } from "./studio/StudioTopBar";
import { SavedItemsModal } from "./studio/SavedItemsModal";
import { printPdf, printDeckPdf } from "@/lib/studioExport";
import { hasUnsavedWork } from "@/lib/studioProjectState";
import { artifactDownload, buildArtifactSrcDoc } from "@/lib/artifactDoc";
import { pickDraftModels, fillSelfConsistency, generateDrafts, judgeDrafts, buildBoostInstruction, type DraftJudge } from "@/lib/boost";
import { buildFallbackChain } from "@/lib/fallback";
import { resolveModelApiKey } from "@/lib/secureKeys";
import { fetchTextModels } from "@/lib/pollinations";

const PHASE_LABEL: Record<StudioPhase, string> = {
  planning: "Planlanıyor…",
  generating: "Tasarım üretiliyor…",
  rendering: "Önizleme hazırlanıyor…",
  done: "Hazır",
  error: "Hata",
};

const MAX_VERSIONS = 8;
/* "slides" skili sabit slayt sayısıyla üretir (v1 basitlik — kullanıcı ayarı yok). */
const DEFAULT_SLIDE_COUNT = 8;

interface DesignMsg { role: "user" | "assistant"; text: string; }

function newDesignProject(): StudioProject {
  const now = Date.now();
  return {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: "Yeni Tasarım",
    brief: "",
    html: "",
    designSystemId: "",
    skillId: null,
    directionId: null,
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
}

/* ── Sol Panel: AI Sohbet (ilk gönderimden sonra — anasayfa artık StudioHomeScreen) ── */

function ChatPanel({
  messages, busy, phase, onFollowup, onStop, prefill,
  designSystemId, onDesignSystemChange, fusionEnabled, onFusionChange,
  pendingImages, onAddImages, onRemoveImage, onPickTemplate,
  editingSlide, onCancelSlideEdit,
}: {
  messages: DesignMsg[];
  busy: boolean;
  phase: StudioPhase | null;
  onFollowup: (text: string) => void;
  onStop: () => void;
  /** İşaretle & Değiştir'den gelen seçim — nonce her seçimde değişir, metin
      composer'a EKLENIR (yazılmakta olan taslak ezilmez). */
  prefill?: { text: string; nonce: number } | null;
  designSystemId: string;
  onDesignSystemChange: (id: string) => void;
  fusionEnabled: boolean;
  onFusionChange: (v: boolean) => void;
  pendingImages: string[];
  onAddImages: (files: FileList) => void;
  onRemoveImage: (i: number) => void;
  onPickTemplate: (t: StudioTemplate) => void;
  /** Sunum modunda tekil slayt düzenleme seçiliyken (bkz. DesignStudio'daki
      slayt seçici) composer bunun yerine yalnız o slaytı hedefler. */
  editingSlide?: { index: number; title: string } | null;
  onCancelSlideEdit?: () => void;
}) {
  const [input, setInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* Önceki-değer deseni (render-anı türetme, effect yok): yeni bir seçim
     gelince composer'a ekle. */
  const [prevNonce, setPrevNonce] = useState(0);
  if (prefill && prefill.nonce !== prevNonce) {
    setPrevNonce(prefill.nonce);
    setInput((cur) => (cur ? `${cur} ` : "") + prefill.text);
  }

  const submit = () => {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    onFollowup(t);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {messages.length === 0 ? (
          <EmptyChatHint />
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) =>
              m.role === "user" ? (
                /* Klasik sohbet balonu — sağda, ana sohbetteki .user-bubble ile
                   AYNI görsel dil (bkz. MessageBubble.tsx). */
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] min-w-0">
                    <div className="user-bubble px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {m.text}
                    </div>
                  </div>
                </div>
              ) : (
                /* Asistan — solda, avatarsız düz-metin akışı (ana sohbetteki
                   asistan mesajlarıyla aynı desen). */
                <div key={i} className="text-sm whitespace-pre-wrap break-words leading-relaxed text-ink/90">
                  {m.text || <span className="text-muted/60">…</span>}
                </div>
              )
            )}
            {busy && phase && (
              <div className="flex items-center gap-2 text-xs text-brand">
                <Loader2 size={12} className="animate-spin" /> {PHASE_LABEL[phase]}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Yüzen composer — ana sohbetin (CoderView) "Claude design" composer'ıyla
          BİREBİR aynı görsel dil: composer-glow, camsı zemin, rounded-[20px].
          Alt kontrol satırı Claude Design'ın prompt kutusundaki seçeneklerle
          eşleşir: ataç, tasarım sistemi, model (çoklu). */}
      <div className="shrink-0 p-2.5">
        {editingSlide && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs">
              <span className="font-semibold">{editingSlide.index + 1}. slaytı düzenle</span>
              <span className="text-brand/70 truncate max-w-[160px]">{editingSlide.title}</span>
              <button onClick={onCancelSlideEdit} title="Tüm sunumu hedefle" className="hover:text-red transition-colors ml-1">
                <X size={10} />
              </button>
            </div>
          </div>
        )}
        <ImagePreviewStrip images={pendingImages} onRemove={onRemoveImage} />
        <div className="composer-glow flex flex-col gap-1.5 bg-surface/85 backdrop-blur-xl border border-line rounded-[20px] px-3 pt-3 pb-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            rows={1}
            placeholder={editingSlide ? `${editingSlide.index + 1}. slayta yönelik değişiklik iste — 'daha kısa yap'…` : "Değişiklik iste — 'başlığı büyüt'…"}
            className="w-full bg-transparent resize-none outline-none text-[15px] leading-relaxed py-1 max-h-28 placeholder:text-muted/45"
          />
          <div className="flex items-center gap-2">
            {/* Tek satır, yatay kaydırma + sağda soluklaşma ipucu — çok satıra
                bölünmek (eski flex-wrap) dar ekranda dağınık duruyordu.
                Popover'lar yine ComposerExtras.tsx'teki align hesabıyla ekran
                dışına taşmaz. */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-fade-x py-0.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) onAddImages(e.target.files); e.target.value = ""; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Referans görsel ekle"
                aria-label="Referans görsel ekle"
                className="shrink-0 w-9 h-9 rounded-xl border border-line/70 bg-bgsoft/60 hover:border-brand/40 grid place-items-center text-muted hover:text-ink transition-colors"
              >
                <Paperclip size={15} />
              </button>
              <DesignSystemPicker value={designSystemId} onChange={onDesignSystemChange} />
              <ModelPicker fusionEnabled={fusionEnabled} onFusionChange={onFusionChange} />
              <TemplatePicker onPick={onPickTemplate} />
              <VoiceButton
                pill
                onTranscript={(text, isFinal) => {
                  if (isFinal) setInput((cur) => (cur ? `${cur} ` : "") + text);
                }}
              />
            </div>
            {busy ? (
              <button
                onClick={onStop}
                className="shrink-0 w-9 h-9 rounded-xl bg-red hover:bg-red/80 active:bg-red/70 text-white grid place-items-center transition-all hover:scale-105 active:scale-95"
                title="Durdur"
                aria-label="Durdur"
              >
                <Square size={13} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim()}
                className="shrink-0 w-9 h-9 rounded-xl bg-brand hover:bg-branddim active:bg-branddim text-[#111110] grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                title="Gönder"
                aria-label="Gönder"
              >
                <ArrowUp size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCanvas({ busy, phase }: { busy: boolean; phase: StudioPhase | null }) {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-xs flex flex-col items-center gap-3">
        <span className="w-14 h-14 rounded-2xl grid place-items-center text-brand bg-brand/10 border border-brand/20 animate-breathe">
          {busy ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
        </span>
        <p className="text-sm font-semibold text-ink">
          {busy && phase ? PHASE_LABEL[phase] : "Tasarım alanı boş"}
        </p>
        {!busy && (
          <p className="text-xs text-muted/70">
            ✦ Soldan bir değişiklik iste, tuval burada canlanacak.
          </p>
        )}
      </div>
    </div>
  );
}

/* U4 — Mobil sohbet↔tuval anahtarı.
   Eskiden geçiş İKİ FARKLI ve tutarsız denetimle yapılıyordu: sohbet
   tarafında "Tuvale git →" metin bağlantısı, tuval tarafında ise bir "X"
   (kapat gibi görünüyordu ama aslında sohbete dönüyordu). Artık her iki
   ekranda AYNI segment kontrolü: hangi tarafta olduğun her an belli.
   Tuval henüz üretilmediyse "Tuval" devre dışı — tıklanınca boş ekrana
   götürmesin. */
function MobileViewSwitch({
  value, onChange, canvasReady,
}: {
  value: "chat" | "canvas";
  onChange: (v: "chat" | "canvas") => void;
  canvasReady: boolean;
}) {
  const tab = (id: "chat" | "canvas", label: string, disabled = false) => (
    <button
      key={id}
      onClick={() => { if (!disabled) onChange(id); }}
      disabled={disabled}
      aria-current={value === id ? "page" : undefined}
      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
        value === id ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 shrink-0">
      {tab("chat", "Sohbet")}
      {tab("canvas", "Tuval", !canvasReady)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ══════════════════════════════════════════════════════════════════════ */

export function DesignStudio() {
  const nav = useSurfaceNav();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const [project, setProject] = useState<StudioProject>(() => newDesignProject());
  const [messages, setMessages] = useState<DesignMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<StudioPhase | null>(null);
  const [versionIndex, setVersionIndex] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);
  /* Fusion durumu KALICI qualityModelIds'ten başlatılır (lazy init): kullanıcı
     Ayarlar → Kalite'de (ya da önceki oturumda ModelPicker'da) 2+ model seçmişse
     Studio açılışında ModelPicker kutuları işaretli görünüp Fusion KAPALI kalıyordu
     → "2+ seçim Fusion'ı açar" kuralı mevcut seçimlere uygulanmıyordu. */
  const [fusionEnabled, setFusionEnabled] = useState(() => (config.qualityModelIds?.length ?? 0) >= 2);
  /* Composer'daki tasarım sistemi seçici — Umai'nin kendi kimliği varsayılan,
     kullanıcı diğer sistemler arasından seçebilir (bkz. ComposerExtras.tsx). */
  const [designSystemId, setDesignSystemId] = useState("craft");
  /* Composer'daki ataç ile eklenen referans görsel(ler) — henüz gönderilmemiş,
     bir sonraki üretimde tüketilip temizlenir. */
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  /* Anasayfanın (StudioHomeScreen) kendi brief taslağı — sohbet başlayınca
     bir daha görünmez, ChatPanel kendi composer'ına geçer. */
  const [homeBrief, setHomeBrief] = useState("");
  /* Mobilde sohbet/tuval arası basit geçiş — masaüstünde ikisi de her zaman görünür. */
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("chat");
  /* İşaretle & Değiştir seçimi → ChatPanel composer'ına ek (bkz. ChatPanel.prefill). */
  const [annotatePrefill, setAnnotatePrefill] = useState<{ text: string; nonce: number } | null>(null);
  /* Sunum modunda "yalnız bu slaytı düzenle" seçimi — null iken takip isteği
     eskisi gibi TÜM desteyi yeniden üretir; bir slayt seçiliyken yalnız o
     slayt rewriteSlide() ile güncellenir (bkz. runSlideEdit). Her başarılı
     tekil düzenlemeden sonra null'a döner (kullanıcı tekrar seçmeden yanlışlıkla
     hep aynı slaytı düzenlemeye devam etmesin). */
  const [editSlideIndex, setEditSlideIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Henüz hiç mesaj VE tasarım yoksa Claude'un anasayfasına paralel tam-ekran
     giriş ekranı gösterilir; ilk gönderimle (veya şablon seçimiyle) sohbet+
     tuval iki-panel görünümüne geçilir — Claude'da bir isteğin Artifacts
     panelini açması gibi. `!project.html` ek şartı: brief'i olmayan eski bir
     kayıtlı projeyi açınca (messages boş kalır) anasayfaya değil, yüklenen
     tasarıma bakılsın. */
  const showHome = messages.length === 0 && !project.html;

  const versions = project.versions ?? [];
  const vIndex = Math.min(versionIndex, Math.max(0, versions.length - 1));
  const shownContent = versions[vIndex] ?? project.html;
  const shownArtifact: Artifact = { type: project.artifactType ?? "html", content: shownContent, title: project.name, language: project.artifactLanguage };

  /* ── AI Üretim ─────────────────────────────────────────────────── */

  const runGenerate = useCallback(async (brief: string, followup: boolean, template?: StudioTemplate) => {
    if (!brief.trim() || busy) return;

    setBusy(true);
    setPhase("planning");
    setMessages((m) => (followup ? [...m, { role: "user", text: brief }, { role: "assistant", text: "" }] : [{ role: "user", text: brief }, { role: "assistant", text: "" }]));

    const ac = new AbortController();
    abortRef.current = ac;

    /* Skill/yön artık ZORUNLU değil — eşleşme yoksa null kalır ve LLM formatı
       (html/kod/markdown/mermaid) brief'in kendisinden serbestçe seçer (Claude
       Artifacts paritesi). Eskiden "landing"/"minimal" zorla atanıyordu; bir
       Python script isteğine "hero+CTA" talimatı enjekte etmek anlamsızdı. */
    const skillId = template?.skillId ?? (followup ? project.skillId : autoStudioSkill(brief));
    const directionId = template?.directionId ?? project.directionId;
    /* Marka seçici composer'a geri getirildi (kullanıcı kararı) — üretim,
       composer'da seçili tasarım sistemini kullanır (bkz. designSystemId
       state'i, varsayılan Umai'nin kendi sistemi "craft"). */
    const system = designSystemById(designSystemId);
    /* Bu turun referans görsel(ler)i — gönderilir gönderilmez composer'daki
       önizleme şeridi temizlenir (bir sonraki mesajı kirletmesin). */
    const imagesForThisRun = pendingImages;
    setPendingImages([]);

    try {
      let result: { artifact: Artifact; text: string };
      let deckData: SlideDeck | undefined;

      if (skillId === "slides") {
        /* Çok Slaytlı Sunum: generateArtifact'ın serbest-HTML tahminini BAYPAS
           eder — slidesGen.ts'in şemalı JSON motoru + slides.ts'in deterministik
           deckToHtml() render'ı kullanılır (gerçek tema/slayt-başına-görsel/
           konuşmacı notu/gezinme). Takip mesajı da AYNI güvenilir motordan
           geçsin diye "tüm desteyi güncelle" olarak ele alınır — LLM'in
           serbestçe HTML'i yeniden tahmin etmesine izin verilmez (bu, ilk
           üretimdeki kaliteyi düzenlemelerde de korur). Fusion açıksa
           generateDeckFusion (best-of-3 + hakem, bkz. slidesGen.ts) kullanılır;
           taslak/hakem başarısızsa sessizce düz generateDeck()'e düşülür —
           HTML Fusion yolundaki AYNI zarif-düşüş deseni. */
        const deckBrief = followup ? `${project.brief}\n\nGüncelleme isteği: ${brief}` : brief;
        setPhase("generating");
        let deck: SlideDeck | undefined;
        if (fusionEnabled) {
          setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: "✦ Fusion: 3 model ile sunum taslaklanıyor…" }; return c; });
          try {
            const store = useStore.getState();
            const active = store.strongestModel() ?? store.activeModel();
            if (!active) throw new Error("model yok");
            const freeModelNames = await fetchTextModels();
            const manualFusionIds = store.config.qualityModelIds?.length ? store.config.qualityModelIds : undefined;
            const draftProfiles = pickDraftModels(store.config.models, active, 3, store.strongestModel(), freeModelNames, manualFusionIds);
            const slots = fillSelfConsistency(draftProfiles, active, 3);
            const withKeys = await Promise.all(slots.map(async (s) => ({
              baseUrl: s.profile.baseUrl, model: s.profile.model, provider: s.profile.provider,
              apiKey: await resolveModelApiKey(s.profile, store.config.providerKeys), temperature: s.temperature,
            })));
            const fusionFallbacks = buildFallbackChain(store.config.models, active.id);
            const activeKey = await resolveModelApiKey(active, store.config.providerKeys);
            deck = await generateDeckFusion({
              brief: deckBrief, slideCount: DEFAULT_SLIDE_COUNT,
              drafts: withKeys, fallbacks: fusionFallbacks,
              judgeModel: { baseUrl: active.baseUrl, model: active.model, provider: active.provider, apiKey: activeKey },
              signal: ac.signal,
            });
            setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: "✦ Fusion: en iyi sunum seçildi, hazırlanıyor…" }; return c; });
          } catch { /* Fusion taslak/hakem başarısızsa sessizce normal üretime düş. */ }
        }
        if (!deck) {
          deck = await generateDeck({
            brief: deckBrief,
            slideCount: DEFAULT_SLIDE_COUNT,
            onDelta: () => setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: "🎬 Sunum tasarlanıyor…" }; return c; }),
            signal: ac.signal,
          });
        }
        /* Var olan tema tercihini koru — güncelleme temayı sıfırlamasın. */
        if (followup && project.deckData?.themeId) deck.themeId = project.deckData.themeId;
        deckData = deck;
        setPhase("rendering");
        /* Şeffaflık: normalizeDeck (slides.ts) başlığı/madde/gövdesi olmayan
           slaytları SESSİZCE düşürür — hem ilk üretimde hem takip güncellemesinde
           (ikisi de slideCount=DEFAULT_SLIDE_COUNT ister) istenenden az slayt
           gelebilir. Kullanıcı "8 slayt istedim ama neden 5 tane var" diye
           düşünmesin. */
        const shortfall = deck.slides.length < DEFAULT_SLIDE_COUNT
          ? ` (${DEFAULT_SLIDE_COUNT} istendi, ${deck.slides.length} üretilebildi — bazı slaytlar geçerli içerik içermediği için düşürüldü)`
          : "";
        /* Kalite denetimi (danışma niteliğinde) — genel HTML üretim yolundaki
           lintArtifact/CRAFT_RULES notunun (studioGen.ts) deste eşleniği;
           daha önce sunum motorunda hiç yoktu. F5'teki tekil slayt düzenleme
           seçicisine işaret eder — kullanıcı doğrudan hangi slaytı
           düzeltmesi gerektiğini bilir. */
        const lintWarnings = lintDeck(deck);
        const lintNote = lintWarnings.length
          ? `\n\n🧹 Kalite notu: ${lintWarnings.join(" · ")}. İstersen üstteki slayt seçiciden ilgili slaytı seçip düzeltme iste.`
          : "";
        result = {
          artifact: { type: "html", content: deckToHtml(deck), title: deck.title },
          text: (followup
            ? `Sunumu güncelledim (${deck.slides.length} slayt).${shortfall}`
            : `"${deck.title}" sunumunu ${deck.slides.length} slaytla oluşturdum.${shortfall}`) + lintNote,
        };
      } else {
        let boostInstruction: string | undefined;
        if (fusionEnabled) {
          setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: "✦ Fusion: 3 model ile taslak üretiliyor…" }; return c; });
          try {
            const store = useStore.getState();
            const active = store.strongestModel() ?? store.activeModel();
            if (active) {
              const freeModelNames = await fetchTextModels();
              const manualFusionIds = store.config.qualityModelIds?.length ? store.config.qualityModelIds : undefined;
              const draftProfiles = pickDraftModels(store.config.models, active, 3, store.strongestModel(), freeModelNames, manualFusionIds);
              const slots = fillSelfConsistency(draftProfiles, active, 3);
              const withKeys = await Promise.all(slots.map(async (s) => ({
                baseUrl: s.profile.baseUrl, model: s.profile.model, provider: s.profile.provider,
                apiKey: await resolveModelApiKey(s.profile, store.config.providerKeys), temperature: s.temperature,
              })));
              const fusionFallbacks = buildFallbackChain(store.config.models, active.id);
              const draftResults = await generateDrafts({ userText: brief, models: withKeys, fallbacks: fusionFallbacks, signal: ac.signal });
              const drafts = draftResults.map((d) => d.text);
              if (drafts.length) {
                let judge: DraftJudge | null = null;
                if (drafts.length >= 2) {
                  const activeKey = await resolveModelApiKey(active, store.config.providerKeys);
                  judge = await judgeDrafts({ userText: brief, drafts, model: { baseUrl: active.baseUrl, model: active.model, provider: active.provider, apiKey: activeKey }, signal: ac.signal });
                }
                boostInstruction = buildBoostInstruction(drafts, judge);
                setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `✦ Fusion: ${drafts.length} taslak${judge ? " + hakem kararı" : ""} birleştiriliyor…` }; return c; });
              }
            }
          } catch { /* Fusion taslak/hakem başarısızsa sessizce normal üretime düş. */ }
        }

        result = await generateArtifact({
          brief,
          skillId,
          directionId,
          designSystemPrompt: system ? designSystemPromptText(system) : undefined,
          fontLink: system?.fontLink,
          /* Takip mesajlarında mevcut tasarımı TEMEL al — ilk üretimde yok. */
          prevHtml: followup ? project.html : undefined,
          images: imagesForThisRun.length ? imagesForThisRun : undefined,
          boostInstruction,
          onDelta: (txt) => setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: txt || "Tasarım üretiliyor…" }; return c; }),
          onPhase: setPhase,
          signal: ac.signal,
        });
      }

      const wasEmpty = !project.html;
      /* versions[] tek bir `artifactType` alanını PAYLAŞIR (sürüm başına tip
         yok) — takip mesajında format değişirse (ör. HTML tasarımdan Python
         koduna) eski sürümler yanlış tipte render olur. Format değiştiğinde
         geçmişi taşımak yerine yeni bir sürüm zinciri başlat. */
      const typeChanged = followup && project.artifactType && project.artifactType !== result.artifact.type;
      const nextVersions = typeChanged
        ? [result.artifact.content]
        : [...(project.versions ?? []), result.artifact.content].slice(-MAX_VERSIONS);
      setProject((p) => ({
        ...p,
        html: result.artifact.content,
        artifactType: result.artifact.type,
        artifactLanguage: result.artifact.language,
        skillId, directionId, designSystemId,
        deckData,
        versions: nextVersions,
        brief,
        name: followup ? p.name : (template?.name ?? brief.slice(0, 40)) || p.name,
        updatedAt: Date.now(),
      }));
      setVersionIndex(nextVersions.length - 1);
      if (wasEmpty) setMobileView("canvas");

      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: result.text || "Tasarımı oluşturdum." }; return c; });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setMessages((m) => m.slice(0, -1));
      } else {
        const msg = friendlyError(e instanceof Error ? e.message : "bilinmeyen hata");
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `Hata: ${msg}` }; return c; });
      }
    } finally {
      setBusy(false);
      setPhase(null);
      abortRef.current = null;
    }
  }, [busy, project, fusionEnabled, designSystemId, pendingImages]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  /* Tekil slayt düzenleme: rewriteSlide() TEK slaytı yeniden yazar, deste
     şeması/teması/diğer slaytlar AYNEN korunur. TÜM desteyi yeniden üreten
     genel takip yoluna göre hem daha hızlı hem daha güvenilir (küçük tek
     slayt JSON'u, F1/F2/F3'ün token/JSON riskine çok daha az maruz) hem de
     iyi giden slaytları riske atmaz. Daha önce yazılmış ama HİÇBİR yerden
     çağrılmayan bir fonksiyondu — burada gerçek UI akışına bağlanıyor. */
  const runSlideEdit = useCallback(async (instruction: string, slideIndex: number) => {
    if (busy || !project.deckData) return;
    const deck = project.deckData;
    const slide = deck.slides[slideIndex];
    if (!slide) return;
    setBusy(true);
    setPhase("generating");
    setMessages((m) => [...m, { role: "user", text: instruction }, { role: "assistant", text: "" }]);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const newSlide = await rewriteSlide({ deck, index: slideIndex, instruction, signal: ac.signal });
      const nextSlides = deck.slides.map((s, i) => (i === slideIndex ? newSlide : s));
      const nextDeck: SlideDeck = { ...deck, slides: nextSlides, updatedAt: Date.now() };
      const html = deckToHtml(nextDeck);
      const nextVersions = [...(project.versions ?? []), html].slice(-MAX_VERSIONS);
      setProject((p) => ({ ...p, html, deckData: nextDeck, versions: nextVersions, updatedAt: Date.now() }));
      setVersionIndex(nextVersions.length - 1);
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `${slideIndex + 1}. slaytı güncelledim.` }; return c; });
      setEditSlideIndex(null);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setMessages((m) => m.slice(0, -1));
      } else {
        const msg = friendlyError(e instanceof Error ? e.message : "bilinmeyen hata");
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `Hata: ${msg}` }; return c; });
      }
    } finally {
      setBusy(false);
      setPhase(null);
      abortRef.current = null;
    }
  }, [busy, project]);

  /* ── Composer eki: referans görsel(ler) ───────────────────────────
     CoderView'daki readFileIntoInput'un (görsel kısmının) sadeleştirilmiş
     karşılığı — Stüdyo'da yalnız görsel referans anlamlı (kod/metin dosyası
     değil), bu yüzden ayrı MoreMenu yerine tek bir ataç düğmesi yeterli. */
  const addImageFiles = useCallback((files: FileList) => {
    const MAX_IMAGES = 6;        // referans görsel üst sınırı (payload şişmesin)
    const MAX_BYTES = 5 * 1024 * 1024; // dosya başına ~5MB
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { addToast(`'${f.name}' bir görsel değil, atlandı.`, "info"); continue; }
      if (f.size > MAX_BYTES) { addToast(`'${f.name}' çok büyük (max 5MB), atlandı.`, "error"); continue; }
      /* Sayı sınırını EKLEMEDEN önce kontrol et (base64 her görseli ~%33 büyütür
         ve tümü LLM payload'ına gider). setPendingImages içinde sınırla ki art
         arda okumalar yarışmasın. */
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        setPendingImages((p) => {
          if (p.length >= MAX_IMAGES) { addToast(`En fazla ${MAX_IMAGES} görsel eklenebilir.`, "info"); return p; }
          return [...p, reader.result as string];
        });
      };
      /* Önceden onerror yoktu → bozuk/okunamayan dosya SESSİZCE kayboluyordu. */
      reader.onerror = () => addToast(`'${f.name}' okunamadı.`, "error");
      reader.readAsDataURL(f);
    }
  }, [addToast]);
  const removeImage = useCallback((i: number) => {
    setPendingImages((p) => p.filter((_, j) => j !== i));
  }, []);

  /* ── Kaydet / Projelerim ───────────────────────────────────────── */

  const saveProject = useCallback(() => {
    if (!project.html) { addToast("Önce bir tasarım üret.", "info"); return; }
    const existing = config.studioProjects ?? [];
    saveConfig({
      ...config,
      studioProjects: [{ ...project, updatedAt: Date.now() }, ...existing.filter((p) => p.id !== project.id)].slice(0, 40),
    });
    addToast("Proje kaydedildi.", "success");
  }, [project, config, saveConfig, addToast]);

  const savedProjects = config.studioProjects ?? [];

  const openSavedProject = useCallback((p: StudioProject) => {
    setProject(p);
    setVersionIndex((p.versions ?? []).length - 1);
    setMessages(p.brief ? [{ role: "user", text: p.brief }, { role: "assistant", text: "Tasarımı yeniden yükledim." }] : []);
    setSavedOpen(false);
    setMobileView(p.html ? "canvas" : "chat");
    setHomeBrief("");
  }, []);

  const removeSavedProject = useCallback((p: StudioProject) => {
    saveConfig({ ...config, studioProjects: (config.studioProjects ?? []).filter((x) => x.id !== p.id) });
  }, [config, saveConfig]);

  /* ProjectModal'ın "Sohbetler" sekmesinden belirli bir tasarımı açarak
     gelinmiş olabilir (⌘K'nın kullandığı AYNI "belirli öğeyi aç" köprüsü). */
  useEffect(() => {
    const openId = consumeSurfaceOpenItem("studio");
    if (!openId) return;
    const p = (useStore.getState().config.studioProjects ?? []).find((x) => x.id === openId);
    if (p) {
      const t = setTimeout(() => openSavedProject(p), 0);
      return () => clearTimeout(t);
    }
  }, [openSavedProject]);

  /** Mevcut projeyi kayıtlılara yazar (saveProject ile aynı kural, ama sessiz
      ve çağırana yeni listeyi bildirir). U2'de galeriye dönerken kullanılır. */
  const persistProject = useCallback(() => {
    if (!project.html) return;
    const existing = config.studioProjects ?? [];
    saveConfig({
      ...config,
      studioProjects: [{ ...project, updatedAt: Date.now() }, ...existing.filter((p) => p.id !== project.id)].slice(0, 40),
    });
  }, [project, config, saveConfig]);

  /* U3 — "+ Yeni" ARTIK sessizce silmiyor. Eskiden newDesignProject() doğrudan
     çağrılıyordu: kullanıcı bir tasarım üretip kaydetmeyi unuttuysa tek tıkla
     kaybediyordu. Kaybedilecek bir şey varsa (bkz. hasUnsavedWork) önce onay
     istenir; yoksa eskisi gibi anında yeni projeye geçilir. */
  const resetToNewProject = useCallback(() => {
    setProject(newDesignProject());
    setMessages([]);
    setVersionIndex(0);
    setMobileView("chat");
    setHomeBrief("");
  }, []);

  const newProjectAction = useCallback(() => {
    if (hasUnsavedWork(project, config.studioProjects ?? [])
      && !confirm("Bu tasarım kaydedilmedi. Yeni projeye geçilirse kaybolacak. Devam edilsin mi?")) return;
    resetToNewProject();
    addToast("Yeni proje oluşturuldu.", "info");
  }, [project, config.studioProjects, resetToNewProject, addToast]);

  /* U2 — Galeriye (giriş ekranına) YIKICI OLMAYAN dönüş. Eskiden giriş ekranına
     dönmenin tek yolu "+ Yeni" (projeyi siler) ya da stüdyoyu tamamen kapatmaktı.
     Artık çalışma önce kayıtlılara yazılır, sonra tuval boşaltılır — kullanıcı
     ana ekrandaki "Son projeler"den (V1) veya Projelerim'den kaldığı yere döner. */
  const backToGallery = useCallback(() => {
    const willSave = !!project.html;
    persistProject();
    resetToNewProject();
    if (willSave) addToast("Tasarım kaydedildi — Son projeler'den devam edebilirsin.", "success");
  }, [project.html, persistProject, resetToNewProject, addToast]);

  /* Sunum teması: LLM'e gitmeden client-side restyle (Gamma'nın "yeniden
     üretmeden tema değiştir" hissi) — deckToHtml deterministik olduğundan
     anında ve ücretsiz. Yeni bir sürüm EKLEMEZ, mevcut son sürümü günceller
     (kozmetik restyle, ayrı bir "üretim" değil). deckData sürümsüz (tekil)
     olduğundan restyle HER ZAMAN EN SON sürümü hedefler — kullanıcı önceki
     bir sürümü görüntülerken tema değiştirirse (ÖNCEDEN: versions[son] sessizce
     ezilirken ekranda hâlâ eski/görüntülenen sürüm kalıyordu, ikisi ayrışıyordu)
     görünüm de son sürüme kaydırılır ki ekran ile depo hep tutarlı kalsın. */
  const changeDeckTheme = useCallback((themeId: string) => {
    /* Yeni uzunluğu SAF (updater DIŞINDA) hesapla: React batching'de setProject
       updater'ı SENKRON çalışmayabilir → önceki `let newLen` deseninde `newLen`
       hâlâ 0 iken setVersionIndex atlanıyor, ekran/depo ayrışıyordu (yorumun
       çözdüğünü iddia ettiği tam desync). restyle son sürümü GÜNCELLER (yeni
       eklemez); mevcut sürüm yoksa 1 olur. */
    const nextLen = Math.max(1, (project.versions ?? []).length);
    setProject((p) => {
      if (!p.deckData) return p;
      const deck: SlideDeck = { ...p.deckData, themeId };
      const html = deckToHtml(deck);
      const versions = [...(p.versions ?? [])];
      if (versions.length) versions[versions.length - 1] = html; else versions.push(html);
      return { ...p, deckData: deck, html, versions, updatedAt: Date.now() };
    });
    setVersionIndex(nextLen - 1);
  }, [project.versions]);

  /* ── Dışa Aktar (ArtifactCanvas'ın indir/yayınla'sına ek: PDF yazdır) ── */

  const printPdfOption = {
    key: "pdf",
    label: "PDF (yazdır)",
    icon: <FileText size={14} />,
    onSelect: () => {
      /* Sunum (deck) — printDeckPdf(): shownArtifact.content zaten deckToHtml()
         çıktısı (bkz. studioExport.ts'teki yorum — LLM script'i yok, tüm
         kullanıcı metni escapeHtml'li), sandboxed-iframe sarmalayıcıya
         GEREK yok; nested iframe'de sayfa-sonu (page-break-after) PDF'te
         çalışmıyordu (ampirik doğrulandı) — doğrudan üst seviye yazınca
         tarayıcının normal çok-sayfa yazdırma motoru sorunsuz çalışıyor.
         Diğer artifact türleri (serbest LLM HTML/React) hâlâ printPdf()'in
         sandbox'lı yoluna gider — o içerik gerçekten güvenilmez. */
      const ok = project.deckData
        ? printDeckPdf(shownArtifact.content)
        : printPdf(buildArtifactSrcDoc(shownArtifact.type, shownArtifact.content, shownArtifact.language));
      if (!ok) addToast("Yazdırma penceresi açılamadı — pop-up engelleyiciyi kontrol et.", "error");
    },
  };

  /* Üretimi gerçek proje dosyasına çevirme yolu (Codex önerisi, teslim akışı):
     içerik sessionStorage handoff'uyla /app'e taşınır, CoderView mount olunca
     editörde açar — dosyayı repoya işleme/commit mevcut editör akışıyla,
     KULLANICI ONAYIYLA olur; buradan doğrudan repo yazılmaz. */
  const openInEditorOption = {
    key: "editor",
    label: "Editörde aç (repo'ya işle)",
    icon: <FileCode2 size={14} />,
    onSelect: () => {
      const { ext, body } = artifactDownload(shownArtifact.type, shownArtifact.content, shownArtifact.language);
      const slug = (project.name || "tasarim").toLowerCase().replace(/[^a-z0-9çğıöşü]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "tasarim";
      try {
        sessionStorage.setItem("umai_editor_handoff", JSON.stringify({ path: `studio/${slug}.${ext}`, content: body }));
      } catch {
        addToast("İçerik taşınamadı (tarayıcı depolama kotası).", "error");
        return;
      }
      nav.close(); // /app'e döner; CoderView handoff'u mount'ta tüketir
    },
  };

  const actionButtons = (
    <>
      {project.deckData && (
        <>
          <select
            value={project.deckData.themeId}
            onChange={(e) => changeDeckTheme(e.target.value)}
            title="Sunum teması"
            aria-label="Sunum teması"
            className="text-xs bg-bgsoft border border-line rounded-lg px-2 py-2 sm:py-1.5 outline-none focus:border-brand/50 cursor-pointer shrink-0"
          >
            {SLIDE_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {/* Tekil slayt düzenleme hedefi — "Tüm sunum" (varsayılan) takip
              isteğini eskisi gibi tüm desteyi yeniden üretir; belirli bir
              slayt seçilince yalnız o slayt rewriteSlide() ile güncellenir
              (bkz. runSlideEdit), diğer slaytlar/tema korunur. */}
          <select
            value={editSlideIndex === null ? "" : String(editSlideIndex)}
            onChange={(e) => setEditSlideIndex(e.target.value === "" ? null : Number(e.target.value))}
            title="Takip isteği hangi slaytı hedeflesin?"
            aria-label="Slayt düzenleme hedefi"
            className="text-xs bg-bgsoft border border-line rounded-lg px-2 py-2 sm:py-1.5 outline-none focus:border-brand/50 cursor-pointer shrink-0 max-w-[140px]"
          >
            <option value="">Tüm sunum</option>
            {project.deckData.slides.map((s, i) => (
              <option key={s.id} value={i}>{i + 1}. {s.title || "Slayt"}</option>
            ))}
          </select>
        </>
      )}
      <button onClick={saveProject} title="Kaydet" aria-label="Kaydet" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
      <button onClick={() => setSavedOpen(true)} title="Projelerim" aria-label="Projelerim" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
    </>
  );

  /* Anasayfada henüz kaydedilecek bir tasarım yok — yalnız Projelerim (eski
     bir işe dönmek için) anlamlı. Fusion/model seçimi artık composer'daki
     ModelPicker'da (bkz. ComposerExtras.tsx) — burada ayrı bir düğmeye gerek yok. */
  /* U1 — Projelerim ARTIK koşulsuz görünür. Eskiden `savedProjects.length > 0`
     ile gizleniyordu; StudioSwitcher de null döndüğü için yeni bir kullanıcı
     48px'lik üst çubukta YALNIZ bir "X" görüyordu. Kayıt yoksa modal zaten
     kendi boş-durum metnini gösteriyor (emptyLabel) — düğmenin varlığı
     "burada bir yer var" bilgisini veriyor. */
  const homeActionButtons = (
    <button onClick={() => setSavedOpen(true)} title="Projelerim" aria-label="Projelerim" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <StudioTopBar
        label="Tasarım"
        activeSurface="studio"
        showWorkActions
        onNew={showHome ? undefined : newProjectAction}
        onBack={showHome ? undefined : backToGallery}
        title={showHome ? undefined : { value: project.name, onChange: (v) => setProject((p) => ({ ...p, name: v })), placeholder: "Tasarım adı" }}
        onClose={() => nav.close()}
        actions={showHome ? homeActionButtons : actionButtons}
      />

      {showHome ? (
        <StudioHomeScreen
          brief={homeBrief}
          setBrief={setHomeBrief}
          busy={busy}
          onSubmit={(t) => { setHomeBrief(""); runGenerate(t, false); }}
          onPickTemplate={(t) => { setHomeBrief(""); runGenerate(t.brief, false, t); }}
          designSystemId={designSystemId}
          onDesignSystemChange={setDesignSystemId}
          fusionEnabled={fusionEnabled}
          onFusionChange={setFusionEnabled}
          pendingImages={pendingImages}
          onAddImages={addImageFiles}
          onRemoveImage={removeImage}
        />
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Sol: sohbet — masaüstünde sabit, mobilde tam-ekran (yalnız mobileView==="chat"). */}
          <div className={`${mobileView === "chat" ? "flex" : "hidden"} sm:flex flex-col min-h-0 w-full sm:w-[380px] sm:shrink-0 border-r border-line bg-bg sm:bg-transparent`}>
            <div className="sm:hidden h-11 shrink-0 flex items-center px-3 border-b border-line">
              <MobileViewSwitch value={mobileView} onChange={setMobileView} canvasReady={!!project.html} />
            </div>
            <ChatPanel
              messages={messages}
              busy={busy}
              phase={phase}
              onFollowup={(t) => (editSlideIndex !== null ? runSlideEdit(t, editSlideIndex) : runGenerate(t, true))}
              onStop={stop}
              prefill={annotatePrefill}
              onPickTemplate={(t) => runGenerate(t.brief, true, t)}
              designSystemId={designSystemId}
              onDesignSystemChange={setDesignSystemId}
              fusionEnabled={fusionEnabled}
              onFusionChange={setFusionEnabled}
              pendingImages={pendingImages}
              onAddImages={addImageFiles}
              onRemoveImage={removeImage}
              editingSlide={
                project.deckData && editSlideIndex !== null
                  ? { index: editSlideIndex, title: project.deckData.slides[editSlideIndex]?.title || `Slayt ${editSlideIndex + 1}` }
                  : null
              }
              onCancelSlideEdit={() => setEditSlideIndex(null)}
            />
          </div>

          {/* Sağ: tuval — masaüstünde her zaman görünür, mobilde yalnız mobileView==="canvas". */}
          <main className={`${mobileView === "canvas" ? "flex" : "hidden"} sm:flex flex-1 min-h-0 flex-col bg-bgsoft/30`}>
            <div className="sm:hidden h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
              <MobileViewSwitch value={mobileView} onChange={setMobileView} canvasReady={!!project.html} />
              <span className="text-xs font-bold truncate text-muted/70 min-w-0">{project.name}</span>
            </div>
            <div className="flex-1 min-h-0">
              {project.html ? (
                <ArtifactCanvas
                  artifact={shownArtifact}
                  versionIndex={vIndex}
                  versionTotal={versions.length}
                  onPrevVersion={() => setVersionIndex((i) => Math.max(0, i - 1))}
                  onNextVersion={() => setVersionIndex((i) => Math.min(versions.length - 1, i + 1))}
                  extraExportOptions={[printPdfOption, openInEditorOption]}
                  showDevicePicker
                  onAnnotate={(descriptor) => {
                    /* Seçim sohbet composer'ına eklenir; mobilde tuval tam ekran
                       olduğundan sohbete de geçilir ki kullanıcı sonucu görsün. */
                    setAnnotatePrefill({ text: `Seçtiğim öğe ${descriptor} —`, nonce: Date.now() });
                    setMobileView("chat");
                  }}
                />
              ) : (
                <EmptyCanvas busy={busy} phase={phase} />
              )}
            </div>
          </main>
        </div>
      )}

      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Projelerim"
        icon={FolderOpen}
        items={savedProjects}
        getKey={(p) => p.id}
        renderRow={(p) => (
          <>
            <div className="text-sm font-semibold truncate">{p.name}</div>
            <div className="text-[11px] text-muted/60">{new Date(p.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openSavedProject}
        onDelete={removeSavedProject}
        emptyLabel="Henüz kayıtlı proje yok."
      />
    </div>
  );
}
