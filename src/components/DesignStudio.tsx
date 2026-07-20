"use client";

/* ═══════════════════════════════════════════════════════════════════════
   TASARIM STÜDYOSU — Claude Design'ın ETKİLEŞİM desenine paralel: sol
   sohbet, sağ TEK canlı tasarım tuvali. "OpenDesignStudio" (çoklu sayfa/
   format/deck/katman editörü) sadeleştirilerek buna dönüştürüldü — tek
   tasarım alanı, hazır şablonlar (studioTemplates.ts). Marka seçici YOK:
   ÜRETİM her zaman sabit "claude" tasarım sistemini kullanır
   (designSystems.ts) — çıktı kalitesi kanıtlanmış bir sistemden gelsin diye
   (Temmuz 2026 kararı: bu, ÇIKTI için sabit tutuldu). Arayüzün KENDİSİ artık
   `.theme-claude` TAŞIMIYOR (Tem 2026 kullanıcı kararı) — kroma Umai'nin
   kendi teması uygulanır, yalnız üretilen artifact'in KENDİ gömülü CSS'i
   (iframe içinde, ayrı) Claude'un paletini kullanmaya devam eder. Tuval,
   sohbetin ArtifactPanel'iyle AYNI ArtifactCanvas bileşenini paylaşır
   (önizleme/kod, sürüm gezinme, kopyala/indir/yayınla — tek kaynak).
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { FileCode2, FileText, FolderOpen, Loader2, Save, Send, Sparkles, Square, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav, consumeSurfaceOpenItem } from "@/lib/surfaceNav";
import { generateArtifact, type StudioPhase } from "@/lib/studioGen";
import { autoStudioSkill } from "@/lib/autoPilot";
import type { Artifact, SlideDeck, StudioProject } from "@/lib/types";
import { designSystemById, designSystemPromptText } from "@/lib/designSystems";
import { type StudioTemplate } from "@/lib/studioTemplates";
import { generateDeck, generateDeckFusion } from "@/lib/slidesGen";
import { deckToHtml, SLIDE_THEMES } from "@/lib/slides";
import { StudioHomeScreen, EmptyChatHint } from "./studio/StudioHomeScreen";
import { ArtifactCanvas } from "./ArtifactCanvas";
import { StudioTopBar } from "./studio/StudioTopBar";
import { SavedItemsModal } from "./studio/SavedItemsModal";
import { printPdf } from "@/lib/studioExport";
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
}: {
  messages: DesignMsg[];
  busy: boolean;
  phase: StudioPhase | null;
  onFollowup: (text: string) => void;
  onStop: () => void;
  /** İşaretle & Değiştir'den gelen seçim — nonce her seçimde değişir, metin
      composer'a EKLENIR (yazılmakta olan taslak ezilmez). */
  prefill?: { text: string; nonce: number } | null;
}) {
  const [input, setInput] = useState("");

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

      {/* Yüzen/gölgeli composer — CoderView'ın composer'ıyla aynı dil (elev-2). */}
      <div className="shrink-0 p-2.5">
        <div className="flex items-end gap-1.5 rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            rows={1}
            placeholder="Değişiklik iste — 'başlığı büyüt', 'mavi yap', 'yeni bölüm ekle'…"
            className="flex-1 bg-transparent resize-none outline-none text-sm py-1 max-h-28"
          />
          {busy ? (
            <button onClick={onStop} className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-muted hover:text-red hover:bg-bgsoft transition-colors" title="Durdur" aria-label="Durdur">
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-brand text-bg disabled:opacity-30 hover:bg-branddim transition-colors"
              title="Gönder"
              aria-label="Gönder"
            >
              <Send size={14} />
            </button>
          )}
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
  const [fusionEnabled, setFusionEnabled] = useState(false);
  /* Anasayfanın (StudioHomeScreen) kendi brief taslağı — sohbet başlayınca
     bir daha görünmez, ChatPanel kendi composer'ına geçer. */
  const [homeBrief, setHomeBrief] = useState("");
  /* Mobilde sohbet/tuval arası basit geçiş — masaüstünde ikisi de her zaman görünür. */
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("chat");
  /* İşaretle & Değiştir seçimi → ChatPanel composer'ına ek (bkz. ChatPanel.prefill). */
  const [annotatePrefill, setAnnotatePrefill] = useState<{ text: string; nonce: number } | null>(null);
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
    /* Marka seçici kaldırıldı — Stüdyo artık her zaman sabit "Claude" tasarım
       sistemini kullanır (çıktılar da arayüz gibi Claude Design'a paralel). */
    const designSystemId = "claude";
    const system = designSystemById(designSystemId);

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
            const manualFusionIds = store.config.fusionMode === "manual" ? store.config.fusionModelIds : undefined;
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
            onDelta: (txt) => setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `🎬 Sunum tasarlanıyor… (${txt.length} karakter)` }; return c; }),
            signal: ac.signal,
          });
        }
        /* Var olan tema tercihini koru — güncelleme temayı sıfırlamasın. */
        if (followup && project.deckData?.themeId) deck.themeId = project.deckData.themeId;
        deckData = deck;
        setPhase("rendering");
        result = {
          artifact: { type: "html", content: deckToHtml(deck), title: deck.title },
          text: followup
            ? `Sunumu güncelledim (${deck.slides.length} slayt).`
            : `"${deck.title}" sunumunu ${deck.slides.length} slaytla oluşturdum.`,
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
              const manualFusionIds = store.config.fusionMode === "manual" ? store.config.fusionModelIds : undefined;
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
          /* Takip mesajlarında mevcut tasarımı TEMEL al — ilk üretimde yok. */
          prevHtml: followup ? project.html : undefined,
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
        const msg = e instanceof Error ? e.message : "bilinmeyen hata";
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `Hata: ${msg}` }; return c; });
        addToast(`Üretim hatası: ${msg}`, "error");
      }
    } finally {
      setBusy(false);
      setPhase(null);
      abortRef.current = null;
    }
  }, [busy, project, fusionEnabled, addToast]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

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

  const newProjectAction = useCallback(() => {
    setProject(newDesignProject());
    setMessages([]);
    setVersionIndex(0);
    setMobileView("chat");
    setHomeBrief("");
    addToast("Yeni proje oluşturuldu.", "info");
  }, [addToast]);

  /* Sunum teması: LLM'e gitmeden client-side restyle (Gamma'nın "yeniden
     üretmeden tema değiştir" hissi) — deckToHtml deterministik olduğundan
     anında ve ücretsiz. Yeni bir sürüm EKLEMEZ, mevcut son sürümü günceller
     (kozmetik restyle, ayrı bir "üretim" değil). deckData sürümsüz (tekil)
     olduğundan restyle HER ZAMAN EN SON sürümü hedefler — kullanıcı önceki
     bir sürümü görüntülerken tema değiştirirse (ÖNCEDEN: versions[son] sessizce
     ezilirken ekranda hâlâ eski/görüntülenen sürüm kalıyordu, ikisi ayrışıyordu)
     görünüm de son sürüme kaydırılır ki ekran ile depo hep tutarlı kalsın. */
  const changeDeckTheme = useCallback((themeId: string) => {
    let newLen = 0;
    setProject((p) => {
      if (!p.deckData) return p;
      const deck: SlideDeck = { ...p.deckData, themeId };
      const html = deckToHtml(deck);
      const versions = [...(p.versions ?? [])];
      if (versions.length) versions[versions.length - 1] = html; else versions.push(html);
      newLen = versions.length;
      return { ...p, deckData: deck, html, versions, updatedAt: Date.now() };
    });
    if (newLen > 0) setVersionIndex(newLen - 1);
  }, []);

  /* ── Dışa Aktar (ArtifactCanvas'ın indir/yayınla'sına ek: PDF yazdır) ── */

  const printPdfOption = {
    key: "pdf",
    label: "PDF (yazdır)",
    icon: <FileText size={14} />,
    onSelect: () => {
      const doc = buildArtifactSrcDoc(shownArtifact.type, shownArtifact.content, shownArtifact.language);
      if (!printPdf(doc)) addToast("Yazdırma penceresi açılamadı — pop-up engelleyiciyi kontrol et.", "error");
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
        <select
          value={project.deckData.themeId}
          onChange={(e) => changeDeckTheme(e.target.value)}
          title="Sunum teması"
          aria-label="Sunum teması"
          className="text-xs bg-bgsoft border border-line rounded-lg px-2 py-2 sm:py-1.5 outline-none focus:border-brand/50 cursor-pointer shrink-0"
        >
          {SLIDE_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <button onClick={saveProject} title="Kaydet" aria-label="Kaydet" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
      <button onClick={() => setSavedOpen(true)} title="Projelerim" aria-label="Projelerim" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
      <button
        onClick={() => setFusionEnabled((f) => !f)}
        title="Fusion: 3 model + hakem ile üretim"
        aria-label="Fusion: 3 model + hakem ile üretim"
        className={`w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg transition-colors ${fusionEnabled ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
      ><Sparkles size={15} /></button>
    </>
  );

  /* Anasayfada henüz kaydedilecek bir tasarım yok — yalnız Projelerim (eski
     bir işe dönmek için) ve Fusion (bir sonraki üretimi etkiler) anlamlı. */
  const homeActionButtons = (
    <>
      {savedProjects.length > 0 && (
        <button onClick={() => setSavedOpen(true)} title="Projelerim" aria-label="Projelerim" className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
      )}
      <button
        onClick={() => setFusionEnabled((f) => !f)}
        title="Fusion: 3 model + hakem ile üretim"
        aria-label="Fusion: 3 model + hakem ile üretim"
        className={`w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg transition-colors ${fusionEnabled ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
      ><Sparkles size={15} /></button>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <StudioTopBar
        label="Tasarım"
        activeSurface="studio"
        showWorkActions
        onNew={showHome ? undefined : newProjectAction}
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
        />
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Sol: sohbet — masaüstünde sabit, mobilde tam-ekran (yalnız mobileView==="chat"). */}
          <div className={`${mobileView === "chat" ? "flex" : "hidden"} sm:flex flex-col min-h-0 w-full sm:w-[380px] sm:shrink-0 border-r border-line bg-bg sm:bg-transparent`}>
            <div className="sm:hidden h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
              <span className="text-xs font-bold flex items-center gap-1.5"><Sparkles size={13} className="text-brand" /> Sohbet</span>
              {project.html && (
                <button onClick={() => setMobileView("canvas")} className="ml-auto text-[11px] font-semibold text-brand px-2 py-1 rounded-lg hover:bg-brand/10">Tuvale git →</button>
              )}
            </div>
            <ChatPanel
              messages={messages}
              busy={busy}
              phase={phase}
              onFollowup={(t) => runGenerate(t, true)}
              onStop={stop}
              prefill={annotatePrefill}
            />
          </div>

          {/* Sağ: tuval — masaüstünde her zaman görünür, mobilde yalnız mobileView==="canvas". */}
          <main className={`${mobileView === "canvas" ? "flex" : "hidden"} sm:flex flex-1 min-h-0 flex-col bg-bgsoft/30`}>
            <div className="sm:hidden h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
              <button onClick={() => setMobileView("chat")} aria-label="Sohbete dön" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={16} /></button>
              <span className="text-xs font-bold truncate">{project.name}</span>
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
