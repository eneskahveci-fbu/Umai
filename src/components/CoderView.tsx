"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { decryptField, isEncrypted } from "@/lib/secureKeys";
import type { ImageProvider } from "@/lib/imageGen";
import { buildChainFor } from "@/lib/fallback";
import { createReveal, type RevealController } from "@/lib/streamReveal";
import { switchLeftPanel } from "@/lib/leftPanel";
import { compactPlan } from "@/lib/contextWindow";
import { filterMcpServersForModel } from "@/lib/mcpScope";
import {
  ArrowDown,
  AlertTriangle,
  ArrowUp,
  BookMarked,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  File,
  FileCheck2,
  FolderGit2,
  FolderOpen,
  Folder,
  GraduationCap,
  GitPullRequest,
  Globe,
  MoreHorizontal,
  OctagonAlert,
  Loader2 as Loader2Icon,
  MessageSquare,
  PanelLeft,
  Paperclip,
  Check,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Sparkles,
  Trash2,
  Square,
  Terminal,
  DollarSign,
  ShieldCheck,
  Users,
  VenetianMask,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { ConnectStrongerModel } from "./ConnectStrongerModel";
import { detectLanguage, type EditorFile } from "@/lib/editor";
import { bridgeListFiles, bridgeReadFile, bridgeWriteFile, bridgeDeleteFile, buildTreeFromPaths } from "@/lib/bridgeFs";
import { extractAllFileFences } from "@/lib/parsers";
import { fuzzyFiles } from "@/lib/fuzzy";
import { buildPreview } from "@/lib/preview";
import { splitReasoning } from "@/lib/reasoning";

import { RightPanel } from "./RightPanel";

import { MultiCommitBar } from "./MultiCommitBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { EmptyChat } from "./EmptyChat";
import { SelectionQuoteBar } from "./SelectionQuoteBar";
import { VoiceButton } from "./VoiceButton";

const RealTerminal = dynamic(() => import("./RealTerminal").then((m) => m.RealTerminal), {
  ssr: false,
  loading: () => (
    <div className="h-64 shrink-0 border-t border-line/60 bg-codebg grid place-items-center">
      <div className="text-xs text-muted/50">Terminal yükleniyor…</div>
    </div>
  ),
});
import { useStore } from "@/lib/store";
import { runWhenNotStreaming } from "@/lib/streamGate";
import { useModKey } from "@/lib/useModKey";
import { isSupported as isWebContainerSupported } from "@/lib/webcontainer";
import { isAdminEmail } from "@/lib/admin";
import { extractCheckedItems } from "@/lib/checklist";
/* MessageBubble TEMBEL yüklenir. Kendisi küçük ama beraberinde TÜM markdown
   render yığınını (react-markdown + remark/rehype + katex + mermaid +
   highlight.js ≈ 247 KB) getiriyor ve bu yığın statik import'la /app'in ilk
   paketine giriyordu — oysa boş sohbet ekranında render edilecek TEK BİR
   markdown bile yok. Aşağıdaki `useMarkdownWarmup` ilk boyamadan sonra boş
   zamanda modülü sessizce indirir, böylece ilk yanıt geldiğinde gecikme
   OLMAZ; kazanılan tek şey ilk paketin küçülmesidir. */
const MessageBubble = dynamic(() => import("./MessageBubble").then((m) => m.MessageBubble), { ssr: false });
import { SlashMenu } from "./SlashMenu";

/* Üretilen görseli Kütüphane'ye kaydeder — hem "/gorsel" komutu hem de
   generate_image aracı (image_event) buradan geçer, böylece data-URL kota
   kuralı (bkz. addMediaAsset, imageGen.ts) tek bir yerde tanımlı kalır. */
function saveGeneratedImage(url: string, prompt: string, seed?: number): void {
  const store = useStore.getState();
  const config = store.config;
  void import("@/lib/imageGen").then(({ addMediaAsset }) => {
    store.saveConfig({
      ...useStore.getState().config,
      mediaAssets: addMediaAsset(useStore.getState().config.mediaAssets, {
        id: `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        title: prompt.slice(0, 72) || "Görsel",
        url,
        prompt,
        seed,
        createdAt: Date.now(),
        projectId: config.activeProjectId ?? undefined,
        chatId: store.currentId ?? undefined,
        source: "image-gen",
      }),
    });
  });
}
import { MentionMenu } from "./MentionMenu";
import {
  buildTree,
  fetchAllFiles,
  fetchFileContent,
  fetchRepoTree,
  parseRepo,
  splitRepoBranch,
} from "@/lib/github";
import {
  buildGitLabTree,
  fetchAllGitLabFiles,
  fetchGitLabFileContent,
  fetchGitLabRepoTree,
  isGitLabRepo,
  parseGitLabRepo,
  resolveRepoProvider,
} from "@/lib/gitlab";
import type { ChatMessage, TreeFile, TreeNode } from "@/lib/types";
import { lastAssistantIndex, stashAsPendingBranches } from "@/lib/branching";
import { ALL_AGENTS, findAgentByCommand, stripCommand, type Agent } from "@/lib/agents";
import { pollinationsImageUrl } from "@/lib/pollinations";
import { calculateCost, estimateTokens, formatCost, getModelPrice } from "@/lib/pricing";
import { calcBudgetStatus, type BudgetStatus } from "@/lib/budget";
import { buildContextSections, selectRelevantSkills } from "@/lib/prompt";
import { detectSensitive } from "@/lib/pii";
import { planRewind, planTouchesFiles } from "@/lib/rewind";
import { isOfficeFile } from "@/lib/office";
import { friendlyError } from "@/lib/friendlyError";
import { autoEffort, autoSwarm, decidePilot, decidePilotAsync, type PilotDecision } from "@/lib/autoPilot";
import { pickDraftModels, buildBoostInstruction, generateDrafts, fillSelfConsistency, judgeDrafts } from "@/lib/boost";
import { runCompare } from "@/lib/compare";
import { fetchTextModels } from "@/lib/pollinations";
import { importSkillFromUrl, parseSkillIntent, skillFromText } from "@/lib/skillImport";
import { trackEvent } from "@/lib/analytics";
import { retrieve } from "@/lib/retrieval";
import { PLATFORM_KNOWLEDGE } from "@/lib/platform-knowledge";
import { CRAFT_OPERATING_MANUAL } from "@/lib/constants";
import { addPendingAction, removePendingAction, isCommandAllowed, matchDangerousCommand, DEFAULT_COMMAND_ALLOWLIST, type PendingAction } from "@/lib/agentActions";

declare global {
  interface SpeechRecognition {
    lang: string; continuous: boolean; interimResults: boolean;
    onresult: (e: SpeechRecognitionEvent) => void;
    onerror: () => void; onend: () => void; start: () => void;
  }
  interface SpeechRecognitionEvent {
    results: { 0: { 0: { transcript: string } } };
  }
}

/* ─── helpers ─── */

/* Markdown yığınını ilk boyamadan SONRA, tarayıcı boştayken indirir.
   Amaç: /app'in ilk paketi küçük kalsın ama kullanıcı ilk yanıtı aldığında
   MessageBubble çoktan hazır olsun (tembel yüklemenin görünür bir bedeli
   olmasın). requestIdleCallback yoksa (Safari) kısa bir timeout'a düşer. */
function useMarkdownWarmup() {
  useEffect(() => {
    let cancelled = false;
    const warm = () => { if (!cancelled) void import("./MessageBubble"); };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) { const id = ric(warm, { timeout: 2000 }); return () => { cancelled = true; void id; }; }
    const t = setTimeout(warm, 1200);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);
}

/* "⋯ Daha fazla" — az kullanılan eylemleri tek menüde toplar.
   Açılır menü createPortal ile body'e render edilir (overflow kabı kırpmasın).
   placement: "top" (composer, yukarı açılır) | "bottom" (header, aşağı açılır). */
function MoreMenu({ active, children, placement = "top", icon, title = "Daha fazla" }: { active?: boolean; children: React.ReactNode; placement?: "top" | "bottom"; icon?: React.ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  /* Mobilde (sm altı) menü, dropdown yerine alttan açılan tam genişlik SHEET olur
     (iOS hissi: backdrop + tutamaç + safe-area). Masaüstünde konumlu dropdown. */
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      setSheet(window.matchMedia("(max-width: 639px)").matches);
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos(placement === "bottom"
        ? { left: r.right, top: r.bottom + 8 }
        : { left: r.right, bottom: window.innerHeight - r.top + 8 });
    };
    update();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, placement]);
  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title={title}
        className={`flex items-center gap-1.5 text-[12px] px-2.5 py-2.5 sm:px-2 sm:py-1.5 rounded-xl transition-colors active:scale-95 ${
          open || active ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft active:bg-bgsoft"
        }`}
      >
        {icon ?? <MoreHorizontal size={13} />}
      </button>
      {open && sheet && createPortal(
        <>
          <div className="fixed inset-0 z-[79] bg-black/40 animate-modal-bg" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 z-[80] bg-surface border-t border-line rounded-t-2xl shadow-2xl shadow-black/40 p-2 pt-1.5 flex flex-col gap-0.5 max-h-[75dvh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-line/80 mb-1.5 shrink-0" />
            {children}
          </div>
        </>,
        document.body,
      )}
      {open && !sheet && pos && createPortal(
        <div
          ref={menuRef}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, transform: "translateX(-100%)" }}
          className="min-w-[230px] max-h-[70vh] overflow-y-auto bg-surface border border-line rounded-xl shadow-2xl shadow-black/40 p-1 z-[80] flex flex-col gap-0.5 animate-modal-bg"
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

function MoreItem({ onClick, icon, label, desc, active, keepOpen }: { onClick: () => void; icon: React.ReactNode; label: string; desc?: string; active?: boolean; keepOpen?: boolean }) {
  return (
    <button
      onClick={keepOpen ? (e) => { e.stopPropagation(); onClick(); } : onClick}
      className={`flex items-center gap-2.5 text-[12px] px-2.5 py-2 rounded-lg text-left transition-colors ${
        active ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {desc && <span className="block text-[10px] text-muted/50 truncate">{desc}</span>}
      </span>
    </button>
  );
}

/* Hızlı model değiştirici — header'daki model adına tıkla → listeden anında geç
   (Ayarlar'a girmeden). Copilot'un model picker'ı gibi. */
function ModelSwitcher() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const active = config.models.find((m) => m.id === config.activeModelId);
  if (config.models.length === 0) {
    return (
      <button onClick={() => setSettingsOpen(true)} className="text-xs px-2 py-1 rounded-lg border border-brand/40 text-brand hover:bg-brand/10 transition-colors">
        + Model
      </button>
    );
  }
  const activeLabel = active?.label || active?.model || "Model seç";
  return (
    <MoreMenu
      placement="top"
      title={activeLabel}
      icon={
        <span className="flex items-center gap-1.5 text-sm" title={activeLabel}>
          <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
          {/* Sabit 140px, telefonda tipik model adını kesiyordu ("✦ UMAI Default
              (Ücretsiz)" 175px ister). Ekran genişliğine göre pay ver: 390px'lik
              bir telefonda ~195px, sağdaki mod rozetine yer kalarak sığar. */}
          <span className="truncate max-w-[50vw] sm:max-w-[200px] font-semibold text-ink">{activeLabel}</span>
          <ChevronDown size={13} className="text-muted/50 shrink-0" />
        </span>
      }
    >
      <div className="px-2.5 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted/50" onClick={(e) => e.stopPropagation()}>
        Aktif model
      </div>
      {config.models.map((m) => (
        <MoreItem
          key={m.id}
          icon={m.id === config.activeModelId ? <Check size={13} className="text-brand" /> : <span className="w-[13px] grid place-items-center"><span className="w-1.5 h-1.5 rounded-full bg-muted/40" /></span>}
          label={m.label || m.model}
          desc={m.provider}
          active={m.id === config.activeModelId}
          onClick={() => saveConfig({ ...config, activeModelId: m.id })}
        />
      ))}
      <div className="h-px bg-line/60 my-0.5" />
      <MoreItem icon={<Wrench size={13} />} label="Model ekle / yönet…" onClick={() => setSettingsOpen(true)} />
    </MoreMenu>
  );
}

interface StatusBadgeInfo {
  key: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  className: string;
}

/* Alt durum çubuğu — aynı anda 9'a kadar rozet render olabildiğinden (dar
   ekranda satır kırıyordu), tek özet + sayaç pil'ine toplanır; tam liste
   tık'ta açılır. "Hassas veri?" bir uyarı olduğundan (rutin bir mod/durum
   değil) özetin DIŞINDA, her zaman görünür kalır. */
function StatusBar({
  safeMode, web, autoPilot, pilotReasons, autoSwarm, swarm, research,
  toolsEnabled, learningMode, activeAgentLabel, sensitiveHits, budget,
}: {
  safeMode?: boolean;
  web?: boolean;
  autoPilot?: boolean;
  pilotReasons?: string[];
  autoSwarm?: boolean;
  swarm?: boolean;
  research?: boolean;
  toolsEnabled: boolean;
  learningMode?: boolean;
  activeAgentLabel?: string;
  sensitiveHits: string[];
  budget?: BudgetStatus | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const badges: StatusBadgeInfo[] = [];
  if (safeMode) badges.push({ key: "safe", icon: <ShieldCheck size={12} />, label: "Güvenli", title: "Salt-okunur: ajan hiçbir değişiklik yapamaz", className: "text-yellow" });
  if (web) badges.push({ key: "web", icon: <Globe size={12} />, label: "Web", title: "Web araması: en güncel veri internetten çekilir", className: "text-brand" });
  if (autoPilot !== false) {
    badges.push({
      /* "Oto" değil "Oto-pilot": düşünme eforu butonu da ajan modu da "Oto"
         diyordu, üç rozet birbirinden ayırt edilemiyordu. Özellik adı zaten
         "Otomatik Pilot" — rozet de onu söylesin. */
      key: "oto", icon: <Sparkles size={12} className="animate-breathe" />, label: "Oto-pilot",
      title: pilotReasons?.length ? `Bu mesajda: ${pilotReasons.join(" · ")}` : "Otomatik Pilot: eforu, web aramayı, araştırmayı, kaliteyi ve ajan ekibini craft seçer",
      className: "text-brand/80",
    });
  } else if (autoSwarm !== false) {
    badges.push({ key: "oto-ajan", icon: <Sparkles size={12} />, label: "Oto-ajan", title: "Otomatik ajan açık: ihtiyaca göre tek ajan veya ajan ekibi kendiliğinden çalışır", className: "text-muted/70" });
  }
  if (swarm) badges.push({ key: "ekip", icon: <Users size={12} />, label: "Ekip", title: "Ajan Ekibi: planlayıcı → paralel uzman işçiler → birleştirici", className: "text-brand" });
  if (research) badges.push({ key: "arastirma", icon: <Search size={12} />, label: "Araştırma", title: "Derin Araştırma: çok-kaynaklı web araması → atıflı rapor", className: "text-brand" });
  if (toolsEnabled) badges.push({ key: "tools", icon: null, label: "Tools", title: "Tool-use açık", className: "text-green/80" });
  if (learningMode) badges.push({ key: "ogrenme", icon: <GraduationCap size={12} />, label: "Öğrenme", title: "Öğrenme Modu: adım adım eğitsel açıklama", className: "text-brand" });
  if (activeAgentLabel) badges.push({ key: "agent", icon: null, label: activeAgentLabel, title: "Aktif slash komutu", className: "text-brand" });

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted/50 shrink-0">
      {badges.length > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Daralt" : "Tüm aktif modları göster"}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <span className={`flex items-center gap-1 font-medium ${badges[0].className}`} title={badges[0].title}>
            {badges[0].icon} {badges[0].label}
          </span>
          {badges.length > 1 && (
            <span className="text-muted/40 font-mono">{expanded ? "−" : `+${badges.length - 1}`}</span>
          )}
        </button>
      )}
      {badges.length > 1 && (
        <div className={`grid transition-[grid-template-columns] duration-200 ease-out ${expanded ? "grid-cols-[1fr]" : "grid-cols-[0fr]"}`}>
          <div className="min-w-0 overflow-hidden flex items-center gap-1.5">
            {badges.slice(1).map((b) => (
              <span key={b.key} className={`flex items-center gap-1 font-medium whitespace-nowrap ${b.className}`} title={b.title}>{b.icon} {b.label}</span>
            ))}
          </div>
        </div>
      )}
      {sensitiveHits.length > 0 && (
        <span className="flex items-center gap-1 text-yellow font-medium" title={`Mesajında hassas veri olabilir (${sensitiveHits.join(", ")}). API anahtarlarını/kart bilgilerini sohbete yazma.`}>
          <ShieldCheck size={12} /> Hassas veri?
        </span>
      )}
      {budget && budget.level !== "ok" && (
        <span
          className={`flex items-center gap-1 font-medium ${budget.level === "over" ? "text-red" : "text-yellow"}`}
          title={`Bu ay ${formatCost(budget.spentUsd)} / ${formatCost(budget.budgetUsd)} (%${Math.round(budget.ratio * 100)}) — aktif modele göre kaba tahmin. Ayarlar → Kullanım'dan bütçeyi değiştirebilirsin.`}
        >
          <DollarSign size={12} /> {budget.level === "over" ? "Bütçe aşıldı" : "Bütçeye yaklaşıldı"}
        </span>
      )}
    </div>
  );
}

/* short = kapalı butonun üstündeki metin, label = açılan menüdeki satır.
   Varsayılan ("auto") durumda buton KONTROLÜN ADINI ("Efor") gösterir, değerini
   değil: üç ayrı kavram (düşünme eforu, ajan yazma modu, Otomatik Pilot rozeti)
   ekranda aynı anda "Oto" yazıyordu ve hangisinin ne olduğu anlaşılmıyordu.
   Kullanıcı bir seviye seçince buton o seviyeyi gösterir (Düşük/Orta/…). */
const THINKING_LEVELS = [
  { key: "auto",   label: "Otomatik", short: "Efor" },
  { key: "low",    label: "Düşük",  short: "Düşük" },
  { key: "medium", label: "Orta",   short: "Orta" },
  { key: "high",   label: "Yüksek", short: "Yüksek" },
  { key: "max",    label: "Max",    short: "Max" },
] as const;


/* Header'daki küçük açılır-panelli butonlar (Efor, Ajan modu) için ORTAK
   konumlama. Header'ın `overflow-x-auto`'su CSS'e göre overflow-y'yi de
   örtük "auto" yapar (bir eksen visible-dışı olunca öteki eksenin visible'ı
   geçersiz kalır) — bu yüzden düz bir `absolute` açılır panel HEADER'IN ALT
   SINIRINDA KIRPILIYORDU (tamamen görünmez oluyordu — Efor pill'i header'a
   taşınırken canlı testte yakalandı). MoreMenu bunu zaten portal ile
   çözüyordu; aynı teknik (portal + buton dikdörtgeninden hesaplanan sabit
   konum) buraya da taşındı. */
function useHeaderDropdown(open: boolean, onClose: () => void) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ right: number; top: number } | null>(null);

  /* Panel butonun SAĞ kenarına sabitlenir. Eskiden `right` yalnız buton
     dikdörtgeninden hesaplanıyor, viewport'a KIRPILMIYORDU: dar ekranda
     (ör. 375px) buton ortada olduğunda 288px'lik panelin sol kenarı eksiye
     düşüyor ve menü ekranın SOLUNDAN taşıp kesiliyordu (mobil hata raporu).
     Panelin ölçülen genişliğine göre `right`i sınırla → panel her zaman
     ekranın içinde kalsın. */
  const MARGIN = 8;
  const update = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const menuW = menuRef.current?.offsetWidth ?? 0;
    let right = vw - r.right;
    /* Genişlik ancak panel DOM'a girdikten SONRA bilinir; ilk geçişte 0 olur
       ve aşağıdaki layout efekti ikinci bir geçişle düzeltir. */
    if (menuW > 0) right = Math.min(right, Math.max(MARGIN, vw - menuW - MARGIN));
    right = Math.max(MARGIN, right);
    const top = r.bottom + 6;
    /* Aynı değerde setState yapma — layout efekti her render'da çalıştığı için
       döngüye girmemesi buna bağlı. */
    setPos((prev) => (prev && prev.right === right && prev.top === top ? prev : { right, top }));
  }, []);

  /* Panel render edildikten sonra genişliğiyle bir kez daha ölç. */
  useLayoutEffect(() => {
    if (open && pos) update();
  });

  useEffect(() => {
    if (!open) return;
    update();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, onClose, update]);

  return { btnRef, menuRef, pos };
}

/* Efor seçici — ⋯ menüsünden header'a taşındı (Ağu 2026 kullanıcı kararı):
   AgentModeButton ile AYNI desen (buton + dışarı tıklama/Escape ile kapanan
   küçük panel). Herkese açık, her zaman görünür; "otomatik" dışı bir seviye
   seçilirse Otomatik Pilot'un o mesaj için kararını geçersiz kılar. */
function EffortHeaderButton() {
  const thinkingMode = useStore((s) => s.thinkingMode);
  const setThinkingMode = useStore((s) => s.setThinkingMode);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { btnRef, menuRef, pos } = useHeaderDropdown(open, close);
  const current = THINKING_LEVELS.find((l) => l.key === thinkingMode) ?? THINKING_LEVELS[0];

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Düşünme eforu — Otomatik Pilot'un kararını elle geçersiz kıl"
        className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg border transition-colors ${
          thinkingMode === "auto" ? "border-line text-muted hover:text-ink hover:border-brand/40" : "border-brand/40 text-brand bg-brand/5"
        }`}
      >
        <Brain size={12} />
        <span className="hidden sm:inline">{current.short}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", right: pos.right, top: pos.top }}
          className="z-[80] w-40 rounded-2xl border border-line bg-surface/95 backdrop-blur-xl shadow-2xl p-1.5 animate-fade-in"
        >
          {THINKING_LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => { setThinkingMode(l.key); setOpen(false); }}
              className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-xl transition-colors text-[12.5px] font-medium ${
                thinkingMode === l.key ? "bg-brand/10 text-brand" : "hover:bg-bgsoft text-ink"
              }`}
            >
              {l.label}
              {thinkingMode === l.key && <Check size={13} className="shrink-0" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* Ajan modu (Claude Code'daki Normal/Auto-accept/Plan üçlüsüne paralel) —
   composer'da her zaman görünür, tek tıkla açılan bir küçük panelden 3
   modun birinden seçim yapılır. Sunucu tarafındaki gerçek davranış zaten
   var (planApprovalMode/requireWriteApproval, bkz. api/chat/route.ts) —
   burada yalnızca ⋯ menüsüne/Ayarlar'a gömülü, düşük görünürlüklü iki ayrı
   checkbox'ı TEK, her zaman görünen bir kontrole birleştiriyoruz. */
type AgentMode = "auto" | "plan" | "accept";
const AGENT_MODES: { key: AgentMode; label: string; short: string; icon: React.ReactNode; desc: string }[] = [
  { key: "auto", label: "Oto", short: "Oto", icon: <Zap size={12} />,
    desc: "Ajan dosyaları doğrudan yazar/commit eder. İstersen sonradan “Geri Al” ile eski haline döndürebilirsin." },
  { key: "plan", label: "Plan", short: "Plan", icon: <ListChecks size={12} />,
    desc: "Önce ayrıntılı bir plan sunar ve durur — sen “Onayla & Uygula” demeden hiçbir dosyaya dokunmaz." },
  { key: "accept", label: "Düzenlemeleri Onayla", short: "Onay", icon: <FileCheck2 size={12} />,
    desc: "Değişiklikleri doğrudan yazmaz; kod bloğu olarak önerir, sen inceleyip kendin uygularsın." },
];

function AgentModeButton() {
  const config = useStore((s) => s.config);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { btnRef, menuRef, pos } = useHeaderDropdown(open, close);
  const mode: AgentMode = config.planApprovalMode ? "plan" : config.requireWriteApproval ? "accept" : "auto";
  const current = AGENT_MODES.find((m) => m.key === mode)!;

  const choose = (next: AgentMode) => {
    const store = useStore.getState();
    store.saveConfig({
      ...store.config,
      planApprovalMode: next === "plan",
      requireWriteApproval: next === "accept",
    });
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Ajan modu — dosya değişiklikleri nasıl uygulansın?"
        className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg border transition-colors ${
          mode === "auto" ? "border-line text-muted hover:text-ink hover:border-brand/40" : "border-brand/40 text-brand bg-brand/5"
        }`}
      >
        {current.icon}
        <span className="hidden sm:inline">{current.short}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", right: pos.right, top: pos.top }}
          className="z-[80] w-72 max-w-[85vw] rounded-2xl border border-line bg-surface/95 backdrop-blur-xl shadow-2xl p-1.5 animate-fade-in"
        >
          {AGENT_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => choose(m.key)}
              className={`w-full flex items-start gap-2.5 text-left px-2.5 py-2 rounded-xl transition-colors ${
                mode === m.key ? "bg-brand/10" : "hover:bg-bgsoft"
              }`}
            >
              <span className={`shrink-0 mt-0.5 ${mode === m.key ? "text-brand" : "text-muted"}`}>{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[12.5px] font-semibold ${mode === m.key ? "text-brand" : "text-ink"}`}>{m.label}</span>
                <span className="block text-[10.5px] text-muted/60 leading-snug mt-0.5">{m.desc}</span>
              </span>
              {mode === m.key && <Check size={13} className="text-brand shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/* Akış SÜRERKEN sohbete `role:"user"` mesaj eklenmesini erteleyen kapı
   `@/lib/streamGate`'ten gelir (service worker güncelleme bildirimiyle ORTAK).

   Terminal/kod çıktısı ajana gizli bir kullanıcı mesajı olarak geri beslenir.
   Bu, akışın ORTASINDA olursa akan metin o mesajın üzerine yazılıyor ve
   modelin cevabı kullanıcı balonunda görünüyordu (Tem 2026 hata raporu).
   store.ts tarafındaki `lastAssistantIndex` artık yanlış mesaja yazmayı
   imkânsız kılıyor; burada ayrıca mesajın DOĞRU SIRAYA girmesini sağlıyoruz.

   Çıktı DÜŞÜRÜLMEZ, KUYRUĞA alınır (ve güvenlik ağı YOK): checklist yolundaki
   `if (store.streaming) return;` orada doğru — kullanıcı tekrar tıklayabilir —
   ama burada vazgeçmek ajanın çalıştırdığı komutun sonucunu kalıcı olarak
   kaybettirir. */

const EXT_COLOR: Record<string, string> = {
  ts: "text-blue-400", tsx: "text-blue-400",
  js: "text-yellow-400", jsx: "text-yellow-400",
  py: "text-green-400",
  css: "text-pink-400", scss: "text-pink-400",
  html: "text-orange-400",
  json: "text-yellow-600",
  md: "text-gray-300",
  go: "text-cyan-400",
  rs: "text-orange-500",
};

function FileIcon({ name, size = 13 }: { name: string; size?: number }) {
  const color = EXT_COLOR[getExt(name)] ?? "text-muted/60";
  return <File size={size} className={`shrink-0 ${color}`} />;
}

function getAllFiles(node: TreeNode): TreeFile[] {
  return [...node.files, ...Object.values(node.dirs).flatMap(getAllFiles)];
}

/* Ham hata mesajını kullanıcının anlayacağı, çözüm önerili Türkçe metne çevirir.
   Tanınmayan hatalarda orijinal mesaj korunur. */
/* API anahtarını isteğin TAM ANINDA çöz: rehydrate yarışı ya da AES anahtar
   uyuşmazlığı olsa bile sağlayıcıya ASLA 'enc:1:…' şifreli blob gitmesin
   (kredili anahtarda bile 401 sorununu önler). Çözülemezse boş döndür + bir kez uyar. */
let warnedDecrypt = false;
async function usableApiKey(model: { apiKey?: string; provider: string }): Promise<string> {
  const cfg = useStore.getState().config;
  let k = model.apiKey || (cfg.providerKeys as Record<string, string> | undefined)?.[model.provider] || "";
  if (k) {
    k = await decryptField(k);
    if (isEncrypted(k)) {
      k = "";
      if (!warnedDecrypt) {
        warnedDecrypt = true;
        useStore.getState().addToast("Kayıtlı API anahtarı çözülemedi (tarayıcı verisi değişmiş olabilir). Ayarlar → Modeller'den anahtarı tekrar gir.", "error");
      }
    } else {
      warnedDecrypt = false;
    }
  }
  return k;
}



let coderAbort: AbortController | null = null;

type AttachedFile = { path: string; content: string };

/* ── FileTree ── */
function FileTreeNode({
  node, prefix = "", onSelect, attached, onContextMenu,
}: {
  node: TreeNode; prefix?: string; onSelect: (f: TreeFile) => void; attached: string[];
  onContextMenu?: (f: TreeFile, e: React.MouseEvent) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (name: string) => setCollapsed((p) => ({ ...p, [name]: !p[name] }));

  return (
    <div>
      {Object.entries(node.dirs).map(([name, child]) => {
        const key = prefix + name;
        const isOpen = !collapsed[key];
        return (
          <div key={key}>
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted hover:text-ink hover:bg-bgsoft/50 rounded transition-colors text-left"
              style={{ paddingLeft: `${(prefix.split("/").length) * 8 + 4}px` }}
            >
              {isOpen ? <ChevronDown size={10} className="shrink-0" /> : <ChevronRight size={10} className="shrink-0" />}
              {isOpen ? <FolderOpen size={11} className="shrink-0 text-yellow-500/70" /> : <Folder size={11} className="shrink-0 text-muted/50" />}
              <span className="truncate">{name}</span>
            </button>
            {isOpen && <FileTreeNode node={child} prefix={key + "/"} onSelect={onSelect} attached={attached} onContextMenu={onContextMenu} />}
          </div>
        );
      })}
      {node.files.map((f) => {
        const isAttached = attached.includes(f.path);
        return (
          <button
            key={f.path}
            onClick={() => onSelect(f)}
            onContextMenu={(e) => { if (onContextMenu) { e.preventDefault(); onContextMenu(f, e); } }}
            className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors text-left ${
              isAttached
                ? "bg-brand/10 text-brand"
                : "text-muted/80 hover:text-ink hover:bg-bgsoft/50"
            }`}
            style={{ paddingLeft: `${(prefix.split("/").length) * 8 + 8}px` }}
          >
            <FileIcon name={f.name} size={11} />
            <span className="truncate flex-1">{f.name}</span>
            {isAttached && <span className="text-[9px] font-bold">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─── main ─── */

/* Anlamsal indekse alınacak metin/kod uzantıları ve üst sınır. */
const RAG_TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|c|h|cpp|cs|css|scss|html|json|md|mdx|txt|yml|yaml|sh|sql)$/i;
const RAG_MAX_FILES = 150;

/* ── ask_user anket kartı ─────────────────────────────────────────────────────
   Ajan kodlamadan önce tıklanabilir soru(lar) sorduğunda gösterilir. Her soru
   için seçenek butonları + "Diğer" serbest metin; tüm sorular yanıtlanınca
   "Yanıtla & Devam Et" etkinleşir → cevaplar formatlanıp ajana geri yollanır. */
interface SurveyOption { label: string; description?: string; }
interface SurveyQuestion { header: string; question: string; options: SurveyOption[]; }

function SurveyCard({
  questions,
  onSubmit,
}: {
  questions: SurveyQuestion[];
  onSubmit: (answers: string[], questions: SurveyQuestion[]) => void;
}) {
  const [selected, setSelected] = useState<(string | null)[]>(() => questions.map(() => null));
  const [other, setOther] = useState<string[]>(() => questions.map(() => ""));

  const pick = (qi: number, label: string) =>
    setSelected((prev) => prev.map((v, i) => (i === qi ? (v === label ? null : label) : v)));

  const ready = selected.every((v, i) => v !== null || other[i].trim().length > 0);

  const submit = () => {
    if (!ready) return;
    onSubmit(selected.map((v, i) => v ?? other[i].trim()), questions);
  };

  return (
    <div className="ml-11 max-w-2xl mt-3 rounded-xl border border-brand/30 bg-brand/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-brand/20 text-xs font-semibold text-brand">
        <MessageSquare size={13} className="shrink-0" />
        <span>Devam etmeden önce birkaç soru — tıkla veya yaz</span>
      </div>
      <div className="divide-y divide-line/30">
        {questions.map((q, qi) => (
          <div key={qi} className="px-3 py-3">
            <p className="text-xs font-semibold text-ink mb-2">{q.question}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {q.options.map((opt) => (
                <button
                  key={opt.label}
                  title={opt.description}
                  onClick={() => pick(qi, opt.label)}
                  className={[
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors text-left",
                    selected[qi] === opt.label
                      ? "bg-brand text-[#111110] border-brand"
                      : "border-line bg-bgsoft text-muted hover:border-brand/50 hover:text-ink",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Diğer…"
              value={other[qi]}
              onChange={(e) => {
                const v = e.target.value;
                setOther((prev) => prev.map((x, i) => (i === qi ? v : x)));
                if (v) setSelected((prev) => prev.map((x, i) => (i === qi ? null : x)));
              }}
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-line bg-bg text-ink placeholder:text-muted focus:outline-none focus:border-brand/60"
            />
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-brand/20 flex justify-end">
        <button
          onClick={submit}
          disabled={!ready}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-[#111110] disabled:opacity-40 hover:bg-branddim transition-colors"
        >
          Yanıtla &amp; Devam Et
        </button>
      </div>
    </div>
  );
}

export function CoderView() {
  useMarkdownWarmup();
  const mod = useModKey();
  const config = useStore((s) => s.config);
  const isAdmin = isAdminEmail(useStore((s) => s.userEmail));
  const repo = useStore((s) => s.repo);
  const tree = useStore((s) => s.tree);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const incognito = useStore((s) => s.incognito);
  const streaming = useStore((s) => s.streaming);
  const pendingInput = useStore((s) => s.pendingInput);

  const toolsEnabledStore = useStore((s) => s.toolsEnabled);
  const artifact = useStore((s) => s.artifact);
  const setRepo = useStore((s) => s.setRepo);
  const setTree = useStore((s) => s.setTree);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setPendingInput = useStore((s) => s.setPendingInput);
  const addToast = useStore((s) => s.addToast);

  /* Yerel Mod aktifse github/gitlab repo olmadan da araçlar açılır (gerçek FS+shell). */
  const localActive = !!(config.localMode && config.localBridgeUrl?.trim());
  const toolsEnabled = toolsEnabledStore && (!!repo || localActive);

  /* "Alan" paneli — Tem 2026 kullanıcı kararı: Dosyalar (depo) ve Sunucu
     (workspace) paneli AYNI konumda (sol, w-64/56, z-30) render ediliyordu
     ama bağımsız boolean'lardı — ikisi de teorik olarak aynı anda açık
     kalabilir, üst üste binerdi. Artık TEK bir kaynak-doğruluk (leftPanel):
     en fazla biri açık, geçiş saf bir fonksiyonla yapılır (bkz.
     lib/leftPanel.ts). filesOpen/wsOpen türetilmiş sabitler olarak kalıyor
     ki aşağıdaki render blokları değişmesin. */
  /* Ö8 (kullanıcı kararı, Tem 2026): durum STORE'a taşındı. Panelleri açan
     tek giriş noktası artık Sidebar → "Araçlar" menüsü ve Sidebar bu
     bileşenin KARDEŞİ — yerel useState ile oraya erişilemezdi. Geçiş mantığı
     yine saf (lib/leftPanel.ts). */
  const leftPanel = useStore((s) => s.leftPanel);
  const setLeftPanel = useStore((s) => s.setLeftPanel);
  const filesOpen = leftPanel === "files";
  const wsOpen = leftPanel === "workspace";
  const [wsTree, setWsTree] = useState<TreeNode | null>(null);
  const [wsPaths, setWsPaths] = useState<string[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsSearch, setWsSearch] = useState("");
  /* Ö10 — sunucu dosyası sağ tık menüsü + yükleme girişi. */
  const [wsMenu, setWsMenu] = useState<{ path: string; x: number; y: number } | null>(null);
  const wsUploadRef = useRef<HTMLInputElement>(null);
  const [wsFetching, setWsFetching] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  /* Terminal bir kez boot olur ve ARKAPLANDA mount kalır (kapatınca unmount
     olmaz) → ajan run_command'ları her zaman çalışır; buton sadece görünürlüğü
     açıp kapatır. */
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [terminalSupported, setTerminalSupported] = useState(true);
  /* Terminal "hazır" mı? run_command komutunu erken gönderip kaybetmemek için izlenir. */
  const terminalReadyRef = useRef(false);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");


  /* Taslak koruması: yazılan mesaj yenileme/kapanmada kaybolmaz. */
  const [input, setInput] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("craftai_draft") ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (input) localStorage.setItem("craftai_draft", input);
        else localStorage.removeItem("craftai_draft");
      } catch { /* yok say */ }
    }, 400);
    return () => clearTimeout(t);
  }, [input]);

  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  /* Web araması artık MANUEL toggle DEĞİL — Otomatik Pilot (pilot.web) karar
     verir. Döviz/güncel bilgi sorularında kendiliğinden çalışır (autoWeb).
     Ajan Ekibi ve Derin Araştırma da aynı şekilde elle çip DEĞİL — Otomatik
     Pilot'un (pilot.swarm/pilot.research) veya "/research" gibi bir slash-
     ajanın kararına bağlı, bkz. send() içindeki useSwarm/useResearch. */
  /* Karşılaştırma modu: sohbet + tool-loop yerine aynı mesajı 2-3 modelle
     paralel çalıştırıp sonuçları yan yana gösterir (bkz. send() içindeki
     erken intercept + MessageBubble'ın compareResults render dalı).
     Ağu 2026 kullanıcı kararıyla ⋯ menüsü (tek tetikleyicisi) kaldırıldı;
     `compareMode` hiçbir zaman `true` olamıyor ama state/mantık BİLEREK
     duruyor — otomatikleştirilebilecek bir metin sinyali yok (kullanıcının
     "bu mesajda modelleri karşılaştır" dediği kasıtlı bir eylem), yeniden
     nasıl tetikleneceği netleşene kadar `setCompareMode` kullanılmıyor. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [compareMode, setCompareMode] = useState(false);
  /* Son gönderimin Otomatik Pilot kararı — ✦ Oto rozeti tooltip'i. */
  const [lastPilot, setLastPilot] = useState<PilotDecision | null>(null);
  /* ⋯ menüsü sekme durumu: Çalışma Alanı · Modlar. "Araçlar" sekmesi
     (Kütüphane/Etkinlik günlüğü/Kısayollar) Tem 2026 kullanıcı kararıyla
     Sidebar → Eklentiler'in yanındaki yeni "Araçlar" düğmesine taşındı —
     burada Efor + oturuma özgü kontroller kalıyor (bkz. Sidebar.tsx). */
  /* Plan onayı: bir sonraki istekte plan-modu kapısını geçici aşar. */
  const planApprovedRef = useRef(false);
  /* afterEdit kancası geri-besleme döngü sayacı (her kullanıcı mesajında sıfırlanır,
     turda en çok 3 tur lint→düzelt → sonsuz döngü engellenir). */
  const hookRunsRef = useRef(0);
  /* Otonom Doğrula-Düzelt: tur sayacı (her kullanıcı mesajında sıfırlanır, en çok
     5 tur → sonsuz döngü engellenir) + tespit edilen doğrulama komutu önbelleği. */
  const verifyRunsRef = useRef(0);
  const verifyCmdRef = useRef<string | null>(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const connectingRef = useRef(false);
  const [fetchingFile, setFetchingFile] = useState<string | null>(null);
  /* Anlamsal (RAG) arama — transformers.js gömme indeksi (repo+branch ile önbellek). */
  const [semanticMode, setSemanticMode] = useState(false);
  const [ragHits, setRagHits] = useState<import("@/lib/rag").RagHit[]>([]);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragProgress, setRagProgress] = useState<{ done: number; total: number } | null>(null);
  const ragIndexRef = useRef<{ key: string; index: import("@/lib/rag").SemanticIndex } | null>(null);
  /* Otomatik bağlam sıkıştırma önbelleği: aynı eşik için tekrar tekrar
     özetlemeyi önler (key = chatId:eskiMesajSayısı). */
  const compactCacheRef = useRef<{ key: string; summary: string } | null>(null);
  /* Uzun sohbette (60+ mesaj) eşik HER turda kayıyor (KEEP sabit 40 iken
     older.length her turda büyüyor) — bu yüzden özetleme isteği ASLA
     await edilmez (bkz. compactPlan): bu tur hazır bir önbellek varsa
     kullanır, yoksa ham kırpmaya düşer ve arka planda taze özet ister.
     Bu ref aynı anahtar için birden fazla arka-plan isteği uçmasını önler. */
  const compactPendingKeyRef = useRef<string | null>(null);
  const [editorFile, setEditorFile] = useState<EditorFile | null>(null);
  const [pendingCommit, setPendingCommit] = useState<EditorFile[] | null>(null);
  /* Ajanın bu turda yazdığı dosyaların ESKİ içeriği — "Geri al" için. */
  const [checkpoints, setCheckpoints] = useState<{ path: string; previous: string | null }[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [rewinding, setRewinding] = useState(false);
  const [checkpointsExpanded, setCheckpointsExpanded] = useState(false);
  /* Ajanın önerdiği YIKICI işlemler (sil/yeniden adlandır) — onay bekler. */
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  /* ask_user anketi: ajan soru sorduğunda gösterilir; cevaplanınca temizlenir. */
  const [pendingSurvey, setPendingSurvey] = useState<SurveyQuestion[] | null>(null);
  const editorOpen = useStore((s) => s.editorOpen);
  const setEditorOpen = useStore((s) => s.setEditorOpen);
  /* Çoklu dosya sekmeleri: editörde açık tutulan dosyalar + aktif olanın
     kaydedilmemiş durumu (sekme geçişinde veri kaybını önlemek için). */
  const [openTabs, setOpenTabs] = useState<EditorFile[]>([]);
  const [activeDirty, setActiveDirty] = useState(false);
  /* Dosya ağacı sağ-tık menüsü konumu + hedef dosya. */
  const [treeMenu, setTreeMenu] = useState<{ x: number; y: number; file: TreeFile } | null>(null);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);

  /* Dosyayı editörde aç: sekme yoksa ekle, varsa içeriğini güncelle, aktif yap. */
  const openInEditor = useCallback((f: EditorFile) => {
    setEditorFile(f);
    setEditorOpen(true);
    setActiveDirty(false);
    setOpenTabs((tabs) => {
      const i = tabs.findIndex((t) => t.path === f.path);
      if (i === -1) return [...tabs, f];
      const next = [...tabs];
      next[i] = f;
      return next;
    });
  }, [setEditorOpen]);
  /* Sekmeye geç — aktif sekmede kaydedilmemiş değişiklik varsa onay iste. */
  const selectTab = (path: string) => {
    if (path === editorFile?.path) return;
    if (activeDirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?")) return;
    const t = openTabs.find((x) => x.path === path);
    if (t) { setEditorFile(t); setEditorOpen(true); setActiveDirty(false); }
  };
  /* Sekmeyi kapat — aktif ve kirliyse onay iste, komşu sekmeye geç. */
  const closeTab = (path: string) => {
    const isActive = path === editorFile?.path;
    if (isActive && activeDirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Sekme kapatılsın mı?")) return;
    setOpenTabs((tabs) => {
      const idx = tabs.findIndex((t) => t.path === path);
      const next = tabs.filter((t) => t.path !== path);
      if (isActive) {
        if (next.length === 0) { setEditorFile(null); setEditorOpen(false); }
        else { setEditorFile(next[Math.max(0, idx - 1)]); setActiveDirty(false); }
      }
      return next;
    });
  };
  const [loadingAll, setLoadingAll] = useState(false);
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prNumber, setPrNumber] = useState("");
  const [prLoading, setPrLoading] = useState(false);
  /* Bir asistan yanıtını GERÇEK bir PR/MR yorumu olarak GitHub/GitLab'a geri
     gönderme — "PR incele"den (yalnız sohbete yazar) farklı, sonucu dışarı
     yazan tek eylem. postPrMessageIndex: hangi mesajın gönderileceği. */
  const [postPrModalOpen, setPostPrModalOpen] = useState(false);
  const [postPrNumber, setPostPrNumber] = useState("");
  const [postPrLoading, setPostPrLoading] = useState(false);
  const [postPrMessageIndex, setPostPrMessageIndex] = useState<number | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  /* Sayfa gizlenirken (uygulama/sekme değişimi) akan kısmi yanıtı kalıcılaştır —
     tarayıcı sekmeyi dondurup yeniden yüklerse bile o ana kadarki yanıt durur.
     `pagehide` ayrıca dinlenir: iOS Safari'de (özellikle ana ekrana eklenmiş
     "standalone" PWA'da) sekme arka plana alınıp belleği geri kazanmak için
     süreç sonlandırıldığında bazı durumlarda `visibilitychange` yerine/ek
     olarak `pagehide` tetiklenir — ikisi de olmadan tek başına eksik kalırsa
     akan yanıt hiç kaydedilmeden kaybolur ("sanki eski cevaba dönüyor" hissi). */
  useEffect(() => {
    const persistIfStreaming = () => {
      if (useStore.getState().streaming) void useStore.getState().persistCurrent();
    };
    const onVis = () => { if (document.hidden) persistIfStreaming(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", persistIfStreaming);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", persistIfStreaming);
    };
  }, []);
  /* Sekme başlığında canlı durum: yanıt yazılırken ● göstergesi (Claude gibi). */
  useEffect(() => {
    if (!streaming) return;
    const prev = document.title;
    document.title = "● Yanıt yazılıyor… — UMAI";
    return () => { document.title = prev; };
  }, [streaming]);
  /* Escape → akışı durdur (Claude davranışı; menüler açıkken onlara öncelik). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().streaming && !slashOpen && !mentionOpen) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  /* Akıllı oto-kaydırma: kullanıcı yukarı kaydırırsa yapışmayı bırak (Claude gibi). */
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const prevLenRef = useRef(0);
  /* En son dipte iken görülen mesaj sayısı — yukarı kaydırılınca "kaç yeni
     mesaj geldi" rozetini hesaplamak için. */
  const lastSeenCountRef = useRef(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  /** S5 — gönder düğmesinin tek seferlik dalga animasyonu (onAnimationEnd ile
      kendini sıfırlar; zamanlayıcı yok, temizlenecek bir şey kalmaz). */
  const [sendPulse, setSendPulse] = useState(false);
  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < 120;
    setShowScrollDown(dist > 300);
  };
  const scrollToBottom = () => {
    stickRef.current = true;
    lastSeenCountRef.current = messages.length;
    setShowScrollDown(false);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];

  /* Composer auto-grow: içerik değiştikçe yükseklik içeriğe uyar (≤240px);
     gönderimde input boşalınca tek satıra döner.
     `emptyChat` BAĞIMLILIĞI ŞART: boş sohbette textarea'ya min-height veriliyor
     (davetkâr, ~3 satırlık kutu) ve scrollHeight bu tabanı içeriyor, yani buraya
     INLINE 68px yazılıyor. Bağımlılık yalnız `input` olsaydı, dolu bir sohbete
     geçildiğinde input değişmediği için efekt yeniden çalışmaz ve o 68px inline
     yükseklik olduğu gibi kalırdı — composer mesajlı ekranda da kocaman
     görünüyordu. (tsc ve testler bunu geçirir; ancak tarayıcıda görülür.) */
  const emptyChat = messages.length === 0;
  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 240)}px`;
  }, [input, emptyChat]);

  /* S2 — giriş animasyonu eşiği. Baloncuklardaki `animate-fade-in` mount'ta
     çalıştığı için sohbet her AÇILDIĞINDA tüm geçmiş yeniden animasyonlanıyor,
     liste dalgalanarak geliyordu. Bu eşik, sohbete girildiği andaki mesaj
     sayısını tutar: yalnız BUNDAN SONRA eklenen mesajlar animasyonlanır.
     (Render sırasında state ayarlama — React'in "türetilmiş state" için
     önerdiği desen; sohbet değişiminde tek fazladan render ile biter.) */
  const [enterState, setEnterState] = useState({ chatId: currentId, from: messages.length });
  if (enterState.chatId !== currentId) {
    /* Sohbet DEĞİŞTİ. İki hâli ayırmak gerekiyor (canlı testte yakalandı: ilk
       kural yalnız `messages.length` kullanıyordu ve YENİ sohbetin ilk mesajı
       hiç animasyonlanmıyordu — çünkü sohbet id'si ile ilk kullanıcı mesajı
       aynı güncellemede geliyor, yani id ilk görüldüğünde mesaj çoktan orada):
         • Geçmişten AÇILAN sohbet (dolu) → hiçbir eski mesaj animasyonlanmaz.
         • O anda OLUŞTURULAN sohbet (henüz 1-2 mesaj) → baştan animasyonlanır;
           boş ekrandan sohbete geçiş zaten görsel bir başlangıçtır. */
    setEnterState({ chatId: currentId, from: messages.length <= 2 ? 0 : messages.length });
  }
  const enterFrom = enterState.chatId === currentId ? enterState.from : messages.length;
  const activeRepoStr = config.activeRepo || "";
  /* Sağlayıcı, bağlantıyı KURAN taraftan gelir (repo.provider); metin sezgisi
     yalnız henüz bağlanmamışken/eski kayıtlarda yedek. Bkz. resolveRepoProvider. */
  const repoIsGitLab = resolveRepoProvider(repo, activeRepoStr) === "gitlab";

  /* Sohbet değişince / sayfa yenilenince: son asistan mesajına kalıcı yazılmış
     geri-al noktalarını yerel duruma geri yükle (Geri Al kaybolmasın). */
  useEffect(() => {
    const msgs = useStore.getState().current()?.messages ?? [];
    const last = msgs[msgs.length - 1];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckpoints(last?.role === "assistant" && last.checkpoints?.length ? last.checkpoints : []);
  }, [currentId]);

  useEffect(() => {
    if (pendingInput) {
      /* Drain a one-shot value pushed from the global store into the local
         composer; this is an external-store sync, so it belongs in an effect. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput(pendingInput);
      setPendingInput(null);
      taRef.current?.focus();
    }
  }, [pendingInput, setPendingInput]);

  /* Claude'daki "seçili metni sor": asistan yanıtından seçilen metin composer'a
     blockquote olarak eklenir, kullanıcı hemen sorusunu altına yazabilir. */
  const quoteSelection = (text: string) => {
    const quoted = text.split("\n").map((l) => `> ${l}`).join("\n");
    setInput((prev) => (prev.trim() ? `${quoted}\n\n${prev}` : `${quoted}\n\n`));
    taRef.current?.focus();
  };

  useEffect(() => {
    /* silently restore last mounted folder if browser still grants permission */
    import("@/lib/localfs").then(({ restoreMounted }) => restoreMounted().catch(() => { /* ignore */ }));
    import("@/lib/webcontainer").then(({ isSupported }) => setTerminalSupported(isSupported()));
  }, []);

  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    /* Yeni mesaj eklendiyse (kullanıcı gönderdi/yanıt başladı) en alta yapış;
       akış sırasında token gelirken yalnızca kullanıcı zaten alttaysa kaydır. */
    const grew = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;
    if (grew) stickRef.current = true;
    if (!stickRef.current) return;
    lastSeenCountRef.current = messages.length;
    if (grew) {
      /* Yeni mesaj eklendi — gözün takip edebilmesi için yumuşak kaydır. */
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    /* S6 — akış sırasında takip. Eskiden her içerik değişiminde
       scrollIntoView({behavior:"auto"}) çağrılıyordu; token başına birkaç kez
       tetiklendiği için kaydırma zıplıyordu. Artık çizim zaten kare hızına
       bağlı (createReveal) ve kaydırma doğrudan kapsayıcının scrollTop'una
       yazılıyor: scrollIntoView'ın yerleşim işi ve kaydırma-çıpası
       çakışmaları olmadan, kare başına tek ve pürüzsüz bir takip. */
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastMessageContent]);

  /* Sohbet değişince en alta yapış + scroll (yeni sohbet hep dipten başlasın). */
  useEffect(() => {
    stickRef.current = true;
    prevLenRef.current = messages.length;
    lastSeenCountRef.current = messages.length;
    endRef.current?.scrollIntoView({ behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const connectRepo = async (silent = false) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    const store = useStore.getState();
    const activeRepo = store.config.activeRepo || "";
    /* SettingsModal'daki giriş kutusu "sahip/depo VEYA sahip/depo:dal" biçimini
       kabul ettiğini SÖYLÜYORDU (placeholder metni), ama ":dal" kısmı hiçbir
       yerde ayrıştırılmıyordu — kullanıcı tam da önerilen biçimde yazınca
       parseRepo/parseGitLabRepo, repodaki ":" karakterini geçersiz sayıp
       depoyu reddediyordu ("hâlâ bağlanmıyor" raporunun bir parçası buydu).
       Dal soneki varsa ayrılır ve fetch*RepoTree'ye branchOverride olarak
       geçilir; yoksa davranış birebir eskisi gibi kalır (branch: null). */
    const { repoStr, branch: branchOverride } = splitRepoBranch(activeRepo);
    setConnecting(true);
    try {
      if (isGitLabRepo(repoStr)) {
        const parsed = parseGitLabRepo(repoStr);
        if (!parsed) { addToast("Geçersiz GitLab deposu. Örnek: gitlab.com/namespace/repo", "error"); return; }
        const token = await store.tokenForRepo(activeRepo, "gitlab");
        const { branch, items } = await fetchGitLabRepoTree(parsed.namespace, parsed.repo, token, branchOverride ?? undefined);
        setRepo({ owner: parsed.namespace, repo: parsed.repo, branch, provider: "gitlab" });
        setTree(buildGitLabTree(items));
      } else {
        const parsed = parseRepo(repoStr);
        if (!parsed) { addToast("Ayarlar'dan bir GitHub veya GitLab deposu ekle.", "error"); return; }
        const token = await store.tokenForRepo(activeRepo, "github");
        try {
          const { branch, items } = await fetchRepoTree(parsed.owner, parsed.repo, token, branchOverride ?? undefined);
          setRepo({ ...parsed, branch, provider: "github" });
          setTree(buildTree(items));
        } catch (ghErr) {
          /* GitHub'da bulunamadı → aynı namespace/repo'yu GitLab'da dene. Repolar
             GitLab'a taşındıysa kullanıcı `namespace/repo` yazınca da bağlanır
             (genel/public repolarda token gerekmez). */
          const gl = parseGitLabRepo(repoStr);
          if (!gl) throw ghErr;
          try {
            const gtoken = await store.tokenForRepo(activeRepo, "gitlab");
            const { branch, items } = await fetchGitLabRepoTree(gl.namespace, gl.repo, gtoken, branchOverride ?? undefined);
            /* Sağlayıcıyı AÇIKÇA işaretle: bu dala girildiğinde `activeRepo`
               metni hâlâ "namespace/repo" (gitlab.com öneki YOK), yani metne
               bakan her yer burayı GitHub sanardı — ajana GitHub token'ı ile
               `provider:"github"` gider, tüm araç çağrıları 404 alırdı. */
            setRepo({ owner: gl.namespace, repo: gl.repo, branch, provider: "gitlab" });
            setTree(buildGitLabTree(items));
            /* Girdiyi kanonik biçime çek: bir sonraki açılışta boşuna GitHub'a
               sorulup 404 beklenmesin, Ayarlar da depoyu doğru göstersin. */
            const canonical = `gitlab.com/${gl.namespace}/${gl.repo}${branchOverride ? `:${branchOverride}` : ""}`;
            const st = useStore.getState();
            if (st.config.activeRepo !== canonical) {
              /* Aşağıdaki "activeRepo değişti → yeniden bağlan" efektine bunun
                 bir depo DEĞİŞİKLİĞİ değil, aynı deponun kanonik yazımı
                 olduğunu bildir; yoksa ağaç hemen silinip aynı repo ikinci kez
                 çekilirdi (gereksiz istek + görünür titreme). */
              prevActiveRepoRef.current = canonical;
              st.saveConfig({ ...st.config, activeRepo: canonical });
            }
          } catch {
            /* İkisi de başarısız → token durumuna göre eyleme dönük hata. */
            if (!token) {
              throw new Error(
                `GitHub deposuna erişilemedi (${(ghErr as Error).message}). ÖZEL repo ise Ayarlar → Depolar'dan bir GitHub erişim token'ı (PAT, 'repo' kapsamı) ekle; GitLab deposuysa "gitlab.com/namespace/repo" biçiminde gir.`,
              );
            }
            throw new Error(
              `${(ghErr as Error).message}. Depo adı doğru mu, token 'repo' kapsamına sahip mi? GitLab deposuysa "gitlab.com/namespace/repo" biçiminde ekle.`,
            );
          }
        }
      }
      /* Repo bağlandı → ajan repoyu görebilsin diye tool-use'u otomatik aç.
         Kullanıcı daha önce BİLEREK kapatmadıysa (localStorage anahtarı yoksa). */
      if (typeof window !== "undefined" && localStorage.getItem("craftai_tools") === null) {
        useStore.getState().setToolsEnabled(true);
      }
    } catch (e) {
      /* Bağlanamadıysak YARIM bir durum bırakma: eski repo/ağaç state'i asılı
         kalırsa arayüz "bağlı" görünür ama ajan hiçbir dosya göremez — tam da
         "repo bağlı görünüyor, model göremiyor" şikayeti budur. */
      setRepo(null);
      setTree(null);
      /* Açılıştaki otomatik bağlanmada sessiz kal; sadece elle bağlanınca hata göster. */
      if (!silent) addToast(`Depo bağlantısı başarısız: ${(e as Error).message}`, "error");
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  };

  const prevActiveRepoRef = useRef(config.activeRepo);
  useEffect(() => {
    if (!config.activeRepo) {
      /* Aktif depo KALMADI (son depo kaldırıldı vb.). Eskiden burada koşulsuz
         `return` vardı: canlı repo/ağaç state'i temizlenmiyor, kullanıcı
         depoyu sildiği halde arayüzde bağlı görünüyor ve ajan bağlamına eski
         depo gitmeye devam ediyordu. */
      prevActiveRepoRef.current = null;
      if (useStore.getState().repo || useStore.getState().tree) {
        setRepo(null);
        setTree(null);
      }
      return;
    }
    const repoChanged = prevActiveRepoRef.current !== config.activeRepo;
    prevActiveRepoRef.current = config.activeRepo;
    // Clear stale tree when repo switches, then always reconnect
    if (repoChanged && tree) {
      setTree(null);
      setRepo(null);
    }
    if (!tree || repoChanged) connectRepo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId, config.activeGitlabId, config.cliMode]);

  /* Proje değişince, projeye bağlı varsayılan repo varsa onu aktif et
     (yukarıdaki efekt repo bağlantısını otomatik kurar). */
  const prevProjRepoRef = useRef(config.activeProjectId);
  useEffect(() => {
    if (prevProjRepoRef.current === config.activeProjectId) return;
    prevProjRepoRef.current = config.activeProjectId;
    const proj = config.projects.find((p) => p.id === config.activeProjectId);
    if (proj?.repo && proj.repo !== config.activeRepo) {
      const st = useStore.getState();
      st.saveConfig({ ...st.config, activeRepo: proj.repo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeProjectId]);

  /* Terminalde komut çalıştır (arkaplanda hazırlar, hazır olunca gönderir).
     Hem ajan run_command'ı hem de otomasyonlar bunu kullanır. */
  const runInTerminal = (command: string) => {
    const cmd = command.trim();
    if (!cmd) return;
    setTerminalMounted(true);
    useStore.getState().addCommandRun(cmd);
    const fire = () => window.dispatchEvent(new CustomEvent("craftai:terminal-run", { detail: { command: cmd } }));
    if (terminalReadyRef.current) { fire(); return; }
    let done = false;
    const onReady = () => {
      if (done) return; done = true;
      window.removeEventListener("craftai:terminal-ready", onReady);
      fire();
    };
    window.addEventListener("craftai:terminal-ready", onReady);
    setTimeout(onReady, 20000);
  };

  /* Hook olayını tetikle (preToolUse/postToolUse/onStop): o olaya bağlı etkin
     otomasyon komutlarını sıralı (&&) terminale gönderir. Opt-in olduğu için
     yalnızca kullanıcı tanımlarsa çalışır. */
  const fireHooks = (event: "preToolUse" | "postToolUse" | "onStop") => {
    const due = (useStore.getState().config.automations ?? [])
      .filter((a) => a.enabled && a.command.trim() && a.event === event)
      .map((a) => a.command.trim());
    if (due.length > 0) runInTerminal(due.join(" && "));
  };

  /* Anket/checklist otomatik devam (Claude tarzı): AI'nın son mesajındaki bir
     checkbox işaretlenince, ard arda gelen tıklamaları tek turda toplamak için
     kısa bir sessizlik (debounce) bekler, sonra seçimleri özetleyen bir
     kullanıcı mesajı gönderip sohbeti kendiliğinden sürdürür — kullanıcının
     elle yazıp göndermesine gerek kalmaz. */
  const checklistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChecklistAutoContinue = (msgIndex: number) => {
    if (checklistDebounceRef.current) clearTimeout(checklistDebounceRef.current);
    checklistDebounceRef.current = setTimeout(() => {
      checklistDebounceRef.current = null;
      const store = useStore.getState();
      if (store.streaming) return;
      const chat = store.current();
      const msg = chat?.messages[msgIndex];
      /* Bu arada yeni bir mesaj geldiyse (artık son mesaj değilse) sessizce vazgeç. */
      if (!chat || !msg || msg.role !== "assistant" || msgIndex !== chat.messages.length - 1) return;
      const checked = extractCheckedItems(msg.content);
      const text = checked.length > 0
        ? `Seçtiklerim:\n${checked.map((c) => `- ${c}`).join("\n")}`
        : "Seçimimi güncelledim, listeye göre devam et.";
      store.pushMessage({ role: "user", content: text });
      /* callApi is a stable useCallback defined below; only invoked here from
         a timer that fires after mount, so the forward reference is safe. */
      void callApi();
    }, 1400);
  };

  /* Bir REPO bağlanınca terminali HER ZAMAN ARKAPLANDA boot et (gizli) → ajan
     komutları hazır olur; repo yokken boşa kaynak harcanmaz. Ön plana ASLA
     kendiliğinden açılmaz; kullanıcı isterse butonla açar. Komut çıktıları
     sohbette "Terminal" todo kutusunda görünür. Bir kez mount olunca kapanmaz. */
  useEffect(() => {
    const useWs = !!config.terminalWsUrl?.trim();
    /* Terminal HER ZAMAN arka planda mount olur (WS URL'i varsa repo gerekmez) →
       hep bağlı/hazır, ekranı KAPLAMAZ. Ön plana KENDİLİĞİNDEN açılmaz; kullanıcı
       üstteki terminal ikonundan açıp bakar. Bir kez mount olunca kapanmaz. */
    if (useWs) { const id = setTimeout(() => setTerminalMounted(true), 0); return () => clearTimeout(id); }
    if (!repo) return; // WebContainer (yerel sanal) yalnızca repo bağlıyken
    let alive = true;
    import("@/lib/webcontainer").then(({ isSupported }) => { if (alive && isSupported()) setTerminalMounted(true); });
    return () => { alive = false; };
  }, [repo, config.terminalWsUrl]);

  /* Terminal hazır olduğunda işaretle; kapanınca sıfırla → run_command'ı doğru anda gönder. */
  useEffect(() => {
    const onReady = () => { terminalReadyRef.current = true; };
    window.addEventListener("craftai:terminal-ready", onReady);
    return () => window.removeEventListener("craftai:terminal-ready", onReady);
  }, []);
  /* Terminal arkaplanda mount kaldığı için kapatınca 'ready' sıfırlanmaz —
     yalnızca tamamen unmount olursa (terminalMounted=false). */
  useEffect(() => { if (!terminalMounted) terminalReadyRef.current = false; }, [terminalMounted]);

  /* Listen for terminal output events — auto-send to AI as follow-up context */
  useEffect(() => {
    const handler = (e: Event) => {
      const { command, output } = (e as CustomEvent<{ command: string; output: string }>).detail ?? {};
      if (!output) return;
      /* Çıktıyı "Terminal" todo kutusuna yaz (ayrı balon yok). */
      useStore.getState().setCommandOutput(command, output, "done");
      /* Arka plan görevi bitti → kullanıcıya bildir (uzun komutlar non-blocking
         çalışır; ajan placeholder ile devam etmiş, çıktı şimdi geldi). */
      addToast(`Komut tamamlandı: ${command.length > 40 ? command.slice(0, 40) + "…" : command}`, "info");
      /* AI'ya bağlam olarak besle — bu kullanıcı mesajı sohbette GİZLENİR
         (MessageBubble "**Terminal çıktısı**" ile başlayanları render etmez);
         çıktı zaten todo kutusunda görünür. */
      const msg = `**Terminal çıktısı** (\`${command}\`):\n\`\`\`\n${output}\n\`\`\``;
      /* Akış sürüyorsa bitene kadar bekle — yoksa akan metin bu mesajın
         üzerine yazılır (bkz. runWhenNotStreaming). */
      runWhenNotStreaming(
        () => {
          useStore.getState().pushMessage({ role: "user", content: msg });
          /* callApi is a stable useCallback defined below; it's only invoked here
             from an event handler that fires after mount, so the forward ref is safe. */
          void callApi();
        },
        /* Akış hiç bitmezse (takılı `streaming` bayrağı) sessizce kaybolmasın:
           çıktı zaten Terminal kutusunda görünüyor, yalnız ajana beslenemedi. */
        () => addToast("Komut çıktısı ajana iletilemedi — yanıt akışı bitmedi. Çıktı Terminal kutusunda duruyor.", "error"),
      );
    };
    window.addEventListener("craftai:terminal-output", handler);
    return () => window.removeEventListener("craftai:terminal-output", handler);
  // callApi is stable (useCallback with no deps that change), safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* L1 — analiz aracı çıktısı: terminal çıktısıyla BİREBİR aynı desen. Sonuç
     gizli bir kullanıcı mesajı olarak bağlama eklenir (sohbette render
     EDİLMEZ — çıktı zaten "Kod çalıştırma" kutusunda görünür) ve ajan
     kaldığı yerden devam eder. */
  useEffect(() => {
    const handler = (e: Event) => {
      const { language, code, output } = (e as CustomEvent<{ language: string; code: string; output: string }>).detail ?? {};
      if (!output) return;
      const msg = `**Kod çıktısı** (${language}):\n\`\`\`${language}\n${code}\n\`\`\`\nÇıktı:\n\`\`\`\n${output}\n\`\`\``;
      runWhenNotStreaming(
        () => {
          useStore.getState().pushMessage({ role: "user", content: msg });
          void callApi();
        },
        () => addToast("Kod çıktısı ajana iletilemedi — yanıt akışı bitmedi. Çıktı 'Kod çalıştırma' kutusunda duruyor.", "error"),
      );
    };
    window.addEventListener("craftai:code-output", handler);
    return () => window.removeEventListener("craftai:code-output", handler);
  // callApi is stable (useCallback with no deps that change), safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachRepoFile = async (file: TreeFile) => {
    if (attachedFiles.find((f) => f.path === file.path)) {
      setAttachedFiles((prev) => prev.filter((f) => f.path !== file.path));
      return;
    }
    if (!repo) return;
    setFetchingFile(file.path);
    try {
      const store = useStore.getState();
      const activeRepo = store.config.activeRepo || "";
      const prov = resolveRepoProvider(store.repo, activeRepo);
      const token = await store.tokenForRepo(activeRepo, prov);
      const content = prov === "gitlab"
        ? await fetchGitLabFileContent(repo.owner, repo.repo, repo.branch, file.path, token)
        : await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, token);
      setAttachedFiles((prev) => [...prev, { path: file.path, content }]);
      openInEditor({ path: file.path, content, language: detectLanguage(file.path) });
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  /* ── Sunucu (Hibrit köprü) workspace gezgini ──────────────────────────
     Ajanların çalıştığı gerçek dizini (ör. /opt/craft-bridge/workspace) köprünün
     /fs/list ucundan listeler; dosyaya tıklanınca /fs/read ile okuyup editörde
     açar. Repo mantığından tamamen bağımsız — yalnız localMode'da görünür. */
  const loadWorkspace = async () => {
    const cfg = useStore.getState().config;
    const url = cfg.localBridgeUrl?.trim();
    const token = cfg.localBridgeToken || "";
    if (!url) { addToast("Önce Ayarlar → Hibrit Sunucu adresini gir", "info"); return; }
    setWsLoading(true);
    try {
      const paths = await bridgeListFiles(url, token);
      setWsPaths(paths);
      setWsTree(buildTreeFromPaths(paths));
      if (paths.length === 0) addToast("Workspace boş", "info");
    } catch (e) {
      addToast(`Workspace okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setWsLoading(false);
    }
  };

  /* Ö10 (kullanıcı isteği): workspace dosyaları silinip yüklenebilsin, skill
     veya snippet olarak kaydedilebilsin. Sunucu tarafı ZATEN hazırdı
     (local-bridge: /fs/write, /fs/delete — ikisi de safeResolve ile kökün
     dışına çıkışı engelliyor); eksik olan istemci sarmalayıcıları ve UI'dı. */
  const wsUpload = () => wsUploadRef.current?.click();

  const openWsMenu = (f: TreeFile, e: React.MouseEvent) => {
    e.preventDefault();
    setWsMenu({ path: f.path, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 150) });
  };

  /** Seçilen dosyaları köprünün /fs/write ucuna yazar. Köprü UTF-8 METİN
      yazdığı için ikili dosyalar (görsel/zip) bilerek reddedilir — sessizce
      bozuk dosya oluşturmaktansa açıkça söylemek doğru. */
  const wsUploadFiles = async (files: globalThis.File[]) => {
    const cfg = useStore.getState().config;
    const url = cfg.localBridgeUrl?.trim();
    if (!url || files.length === 0) return;
    const token = cfg.localBridgeToken || "";
    let ok = 0;
    for (const f of files) {
      if (f.size > 2_000_000) { addToast(`${f.name} 2MB'den büyük — atlandı.`, "error"); continue; }
      if (/^(image|video|audio)\//.test(f.type) || /\.(zip|gz|tar|pdf|png|jpe?g|webp|gif|docx|xlsx|pptx)$/i.test(f.name)) {
        addToast(`${f.name} ikili dosya — sunucuya yalnız metin dosyası yüklenebilir.`, "error");
        continue;
      }
      try {
        await bridgeWriteFile(url, token, f.name, await f.text());
        ok++;
      } catch (e) {
        addToast(`${f.name} yüklenemedi: ${(e as Error).message}`, "error");
      }
    }
    if (ok > 0) { addToast(`${ok} dosya sunucuya yüklendi`, "success"); await loadWorkspace(); }
  };

  const wsDeleteFile = async (path: string) => {
    const cfg = useStore.getState().config;
    const url = cfg.localBridgeUrl?.trim();
    if (!url) return;
    /* Silme GERİ ALINAMAZ (sunucuda rm -rf) — onay şart. */
    if (!window.confirm(`"${path}" sunucudan KALICI olarak silinsin mi?`)) return;
    try {
      await bridgeDeleteFile(url, cfg.localBridgeToken || "", path);
      addToast(`${path} silindi`, "success");
      await loadWorkspace();
    } catch (e) {
      addToast(`Silinemedi: ${(e as Error).message}`, "error");
    }
  };

  /** Dosyayı okuyup Skills'e ya da Snippet'lere kaydeder — mevcut store
      eylemleri (addSkill/addSnippet) aynen kullanılır. */
  const wsSaveAs = async (path: string, as: "skill" | "snippet") => {
    const cfg = useStore.getState().config;
    const url = cfg.localBridgeUrl?.trim();
    if (!url) return;
    try {
      const content = await bridgeReadFile(url, cfg.localBridgeToken || "", path);
      if (!content.trim()) { addToast("Dosya boş — kaydedilmedi.", "info"); return; }
      const name = path.split("/").pop() || path;
      if (as === "skill") {
        /* SKILL.md biçimindeyse başlık/açıklama frontmatter'dan alınır —
           "skill indir" ile AYNI dönüşüm (skillFromText, tek kaynak). */
        const skill = skillFromText(content, path, ["sunucu"]);
        useStore.getState().addSkill(skill);
        addToast(`Skill olarak kaydedildi: ${skill.title}`, "success");
      } else {
        useStore.getState().addSnippet({
          title: name,
          code: content,
          language: detectLanguage(path),
          tags: [],
        });
        addToast(`Snippet olarak kaydedildi: ${name}`, "success");
      }
    } catch (e) {
      addToast(`Kaydedilemedi: ${(e as Error).message}`, "error");
    }
  };

  const openWorkspaceFile = async (file: TreeFile) => {
    const cfg = useStore.getState().config;
    const url = cfg.localBridgeUrl?.trim();
    const token = cfg.localBridgeToken || "";
    if (!url) return;
    setWsFetching(file.path);
    try {
      const content = await bridgeReadFile(url, token, file.path);
      openInEditor({ path: file.path, content, language: detectLanguage(file.path) });
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setWsFetching(null);
    }
  };

  /* Sağ-tık menüsü: dosyayı sohbete eklemeden yalnızca editörde aç. */
  const openTreeFile = async (file: TreeFile) => {
    const existing = attachedFiles.find((f) => f.path === file.path);
    if (existing) {
      openInEditor({ path: file.path, content: existing.content, language: detectLanguage(file.path) });
      return;
    }
    if (!repo) return;
    setFetchingFile(file.path);
    try {
      const store = useStore.getState();
      const activeRepo = store.config.activeRepo || "";
      const prov = resolveRepoProvider(store.repo, activeRepo);
      const tok = await store.tokenForRepo(activeRepo, prov);
      const content = prov === "gitlab"
        ? await fetchGitLabFileContent(repo.owner, repo.repo, repo.branch, file.path, tok)
        : await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, tok);
      openInEditor({ path: file.path, content, language: detectLanguage(file.path) });
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  /* Sidecar (Cursor/Claude Code tarzı): ajan bir dosyayı yazınca/düzenleyince
     sağ editör panelini otomatik aç ve YENİ içeriği canlı göster. checkpoint_event
     ile tetiklenir; içerik repodan taze çekilir (commit yeni atılmıştır). */
  const showWrittenFile = useCallback(async (path: string) => {
    const store = useStore.getState();
    const r = store.repo;
    if (!r) return;
    try {
      const activeRepo = store.config.activeRepo || "";
      const prov = resolveRepoProvider(r, activeRepo);
      const tok = await store.tokenForRepo(activeRepo, prov);
      const content = prov === "gitlab"
        ? await fetchGitLabFileContent(r.owner, r.repo, r.branch, path, tok)
        : await fetchFileContent(r.owner, r.repo, r.branch, path, tok);
      openInEditor({ path, content, language: detectLanguage(path) });
    } catch { /* dosya henüz okunamadıysa sessiz geç */ }
  }, [openInEditor]);

  /* ── Anlamsal (RAG) arama ──────────────────────────────────────────
     İlk kullanımda depo metin dosyalarını (sınırlı sayıda) çekip gömme
     indeksine ekler; indeks repo+branch ile önbelleklenir. Sonra sorguyu
     anlamca en yakın parçalara eşler. */
  const ensureRagIndex = useCallback(async (): Promise<import("@/lib/rag").SemanticIndex | null> => {
    const store = useStore.getState();
    const r = store.repo;
    if (!r || !tree) return null;
    const key = `${r.owner}/${r.repo}@${r.branch}`;
    if (ragIndexRef.current?.key === key && ragIndexRef.current.index.size > 0) {
      return ragIndexRef.current.index;
    }
    const { SemanticIndex, chunkText } = await import("@/lib/rag");
    const index = new SemanticIndex();
    const activeRepo = store.config.activeRepo || "";
    const gitlab = resolveRepoProvider(r, activeRepo) === "gitlab";
    const token = await store.tokenForRepo(activeRepo, gitlab ? "gitlab" : "github");

    const files = getAllFiles(tree)
      .filter((f) => RAG_TEXT_EXT.test(f.path))
      .slice(0, RAG_MAX_FILES);
    setRagProgress({ done: 0, total: files.length });

    /* Eş zamanlılık sınırlı (5) çekme + parçalama. */
    let i = 0;
    let done = 0;
    const worker = async () => {
      while (i < files.length) {
        const f = files[i++];
        try {
          const content = gitlab
            ? await fetchGitLabFileContent(r.owner, r.repo, r.branch, f.path, token)
            : await fetchFileContent(r.owner, r.repo, r.branch, f.path, token);
          if (content && content.length < 100_000) {
            await index.add(chunkText(f.path, content));
          }
        } catch { /* dosya atla */ }
        done++;
        setRagProgress({ done, total: files.length });
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    ragIndexRef.current = { key, index };
    setRagProgress(null);
    return index;
  }, [tree]);

  const runSemanticSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) { setRagHits([]); return; }
    setRagBusy(true);
    try {
      const index = await ensureRagIndex();
      if (!index || index.size === 0) {
        addToast("Anlamsal indeks kurulamadı (model yüklenemedi)", "error");
        setRagHits([]);
        return;
      }
      const hits = await index.search(q, 8);
      setRagHits(hits);
      if (hits.length === 0) addToast("Eşleşme bulunamadı", "info");
    } finally {
      setRagBusy(false);
    }
  }, [ensureRagIndex, addToast]);

  /* Komut paletinden (Cmd+P) dosya açma isteği → editörde aç. */
  useEffect(() => {
    const handler = async (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail?.path;
      if (!path) return;
      const existing = attachedFiles.find((f) => f.path === path);
      if (existing) {
        openInEditor({ path: existing.path, content: existing.content, language: detectLanguage(path) });
        return;
      }
      const file = tree ? getAllFiles(tree).find((f) => f.path === path) : undefined;
      if (file) await attachRepoFile(file);
    };
    window.addEventListener("craftai:open-file", handler);
    return () => window.removeEventListener("craftai:open-file", handler);
  // attachRepoFile kapanışı attachedFiles/tree ile yenilenir; diğerleri stabil
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedFiles, tree]);

  /* Komut paletinden ("Görsel oluştur" vb.) composer'a metin bırakma isteği —
     ör. "/gorsel " önceden doldurulup imleç odaklanır, kullanıcı brief'i yazar.
     İki kaynak: zaten /app'teysek canlı custom event; başka rotadan
     router.push ile geliniyorsa (bu bileşen henüz mount değildi, event kaçtı)
     mount anında sessionStorage'dan okunur (surfaceNav.ts handoff deseniyle
     aynı). */
  useEffect(() => {
    const applyPrefill = (prefill: string) => {
      setInput(prefill);
      const detected = findAgentByCommand(prefill);
      if (detected) setActiveAgent(detected);
      setTimeout(() => taRef.current?.focus(), 0);
    };
    try {
      const handoff = sessionStorage.getItem("craft_composer_prefill");
      if (handoff) { sessionStorage.removeItem("craft_composer_prefill"); applyPrefill(handoff); }
    } catch { /* yok say */ }
    const handler = (e: Event) => {
      const prefill = (e as CustomEvent<{ text: string }>).detail?.text;
      if (prefill) applyPrefill(prefill);
    };
    window.addEventListener("craftai:composer-prefill", handler);
    return () => window.removeEventListener("craftai:composer-prefill", handler);
  }, []);

  /* Stüdyo'dan "Editörde aç (repo'ya işle)" handoff'u — DesignStudio üretimi
     sessionStorage'a bırakır, burada mount'ta editör sekmesi olarak açılır.
     Repoya yazma/commit mevcut editör akışıyla, kullanıcı onayıyla olur. */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("umai_editor_handoff");
      if (raw) sessionStorage.removeItem("umai_editor_handoff");
    } catch { /* erişilemez depolama — yok say */ }
    if (!raw) return;
    /* setState'i effect gövdesinden çıkar (react-hooks/set-state-in-effect) —
       mount sonrası bir sonraki tick'te aç. */
    const id = setTimeout(() => {
      try {
        const h = JSON.parse(raw!) as { path?: string; content?: string };
        if (!h.path || typeof h.content !== "string") return;
        openInEditor({ path: h.path, content: h.content, language: detectLanguage(h.path) });
        useStore.getState().addToast(`Stüdyo çıktısı editörde açıldı: ${h.path} — kaydedip commit edebilirsin.`, "success");
      } catch { /* bozuk handoff — yok say */ }
    }, 0);
    return () => clearTimeout(id);
  }, [openInEditor]);

  /* Geri al: ajanın bu turda değiştirdiği dosyaları eski içerikleriyle yeniden
     commit eder (revert); bu turda OLUŞTURULAN dosyaları (previous === null)
     siler. EditorPanel/MultiCommitBar ile aynı yazma/silme uçları. */
  const undoCheckpoints = async () => {
    if (!repo || checkpoints.length === 0) return;
    setUndoing(true);
    const store = useStore.getState();
    try {
      const token = await store.tokenForRepo(activeRepoStr, repoIsGitLab ? "gitlab" : "github");
      const idField = repoIsGitLab ? { namespace: repo.owner } : { owner: repo.owner };
      const base = { ...idField, repo: repo.repo, branch: repo.branch, token };
      for (const cp of checkpoints) {
        const isCreated = cp.previous === null;
        const endpoint = repoIsGitLab
          ? (isCreated ? "/api/gitlab/delete" : "/api/gitlab/write")
          : (isCreated ? "/api/github/delete" : "/api/github/write");
        const body = isCreated
          ? { ...base, path: cp.path, message: `revert: remove ${cp.path}` }
          : { ...base, path: cp.path, content: cp.previous, message: `revert: ${cp.path}` };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: `Hata ${res.status}` }));
          throw new Error(error);
        }
      }
      addToast(`↩ ${checkpoints.length} dosya eski haline döndürüldü`, "success");
      setCheckpoints([]);
      setCheckpointsExpanded(false);
      store.setCheckpointsOnLast([]);
      void store.persistCurrent();
    } catch (e) {
      addToast(`Geri alınamadı: ${(e as Error).message}`, "error");
    } finally {
      setUndoing(false);
    }
  };

  /* Oturum geri sarma (Claude Code /rewind karşılığı): sohbetin HERHANGİ bir
     noktasına dön — hem konuşmayı kısalt hem o noktadan sonraki TÜM dosya
     değişikliklerini geri al. Mevcut "Geri Al" yalnız SON turu kapsıyordu.
     Hangi anlık görüntünün yazılacağı saf fonksiyonda hesaplanır
     (lib/rewind.ts — aynı dosya birden çok turda değiştiyse EN ESKİ hâl). */
  const rewindTo = async (targetIndex: number) => {
    const store = useStore.getState();
    const msgs = store.current()?.messages ?? [];
    const plan = planRewind(msgs, targetIndex);
    if (plan.droppedMessages === 0) return;

    const fileNote = planTouchesFiles(plan)
      ? `\n\n${plan.restore.length} dosya eski hâline dönecek, ${plan.remove.length} dosya silinecek.`
      : "";
    if (!window.confirm(
      `Bu noktaya geri sarılsın mı?\n\n${plan.droppedMessages} mesaj sohbetten kalkacak.${fileNote}\n\nBu işlem geri alınamaz.`,
    )) return;

    setRewinding(true);
    try {
      /* Dosyalar ÖNCE: konuşma kırpılmadan yapılır ki bir hata olursa
         kullanıcı hangi noktadan döndüğünü hâlâ görebilsin. */
      if (planTouchesFiles(plan)) {
        if (!repo) { addToast("Dosyaları geri almak için depo bağlı olmalı.", "error"); return; }
        const token = await store.tokenForRepo(activeRepoStr, repoIsGitLab ? "gitlab" : "github");
        const idField = repoIsGitLab ? { namespace: repo.owner } : { owner: repo.owner };
        const base = { ...idField, repo: repo.repo, branch: repo.branch, token };
        const post = async (endpoint: string, body: Record<string, unknown>) => {
          const res = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          });
          if (!res.ok) {
            const { error } = await res.json().catch(() => ({ error: `Hata ${res.status}` }));
            throw new Error(error);
          }
        };
        for (const f of plan.restore) {
          await post(repoIsGitLab ? "/api/gitlab/write" : "/api/github/write",
            { ...base, path: f.path, content: f.content, message: `rewind: ${f.path}` });
        }
        for (const p of plan.remove) {
          await post(repoIsGitLab ? "/api/gitlab/delete" : "/api/github/delete",
            { ...base, path: p, message: `rewind: remove ${p}` });
        }
      }
      store.truncateMessages(plan.keepCount);
      setCheckpoints([]);
      setCheckpointsExpanded(false);
      await store.persistCurrent();
      addToast(`↩ ${plan.droppedMessages} mesaj geri sarıldı`, "success");
    } catch (e) {
      addToast(`Geri sarılamadı: ${(e as Error).message}`, "error");
    } finally {
      setRewinding(false);
    }
  };

  /* Yıkıcı işlem önerisini ONAYLA (uygula) veya REDDET. Silme/yeniden adlandırma
     yalnızca burada, kullanıcı tıklamasıyla gerçekleşir — ajan asla doğrudan yapamaz. */
  const resolvePendingAction = async (action: PendingAction, approve: boolean) => {
    if (!approve) { setPendingActions((p) => removePendingAction(p, action.id)); return; }
    if (!repo) return;
    setResolvingAction(action.id);
    const store = useStore.getState();
    const isGL = repoIsGitLab;
    const token = await store.tokenForRepo(activeRepoStr, isGL ? "gitlab" : "github");
    const idField = isGL ? { namespace: repo.owner } : { owner: repo.owner };
    const jbody = (extra: Record<string, unknown>) => JSON.stringify({ ...idField, repo: repo.repo, branch: repo.branch, token, ...extra });
    const post = async (url: string, extra: Record<string, unknown>) => {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: jbody(extra) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `Hata ${res.status}` }))).error);
    };
    try {
      const delUrl = isGL ? "/api/gitlab/delete" : "/api/github/delete";
      const writeUrl = isGL ? "/api/gitlab/write" : "/api/github/write";
      if (action.kind === "delete") {
        await post(delUrl, { path: action.path, message: `delete: ${action.path}` });
        addToast(`🗑 ${action.path} silindi`, "success");
      } else {
        const content = isGL
          ? await fetchGitLabFileContent(repo.owner, repo.repo, repo.branch, action.path, token)
          : await fetchFileContent(repo.owner, repo.repo, repo.branch, action.path, token);
        await post(writeUrl, { path: action.newPath, content, message: `rename: ${action.path} → ${action.newPath}` });
        await post(delUrl, { path: action.path, message: `rename: remove ${action.path}` });
        addToast(`✏ ${action.path} → ${action.newPath}`, "success");
      }
      setPendingActions((p) => removePendingAction(p, action.id));
    } catch (e) {
      addToast(`İşlem başarısız: ${(e as Error).message}`, "error");
    } finally {
      setResolvingAction(null);
    }
  };

  const readFileIntoInput = (f: globalThis.File) => {
    if (f.type.startsWith("image/")) {
      if (f.size > 5_000_000) { addToast("Görsel 5MB'den büyük.", "error"); return; }
      const reader = new FileReader();
      /* Sıkıştırılmadan eklenirse 5MB'lık bir fotoğraf base64'te ~6.7MB olup
         hem mesaj state'ini hem localStorage'ı şişiriyor, sekme donuyordu.
         Görsel ÜRETİM yolu zaten compressDataUrl kullanıyor — aynısı eke de
         uygulanır. Sıkıştırma başarısız olursa (canvas yok/CORS) ham veriye
         düşülür: davranış en kötü ihtimalle eskisi kadar iyi. */
      reader.onload = () => {
        const raw = reader.result as string;
        void import("@/lib/imageGen")
          .then(({ compressDataUrl }) => compressDataUrl(raw))
          .catch(() => raw)
          .then((url) => setPendingImages((prev) => [...prev, url]));
      };
      reader.readAsDataURL(f);
      return;
    }
    /* PDF: istemcide metni çıkar, metin olarak ekle (görsel akışıyla aynı mantık). */
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      if (f.size > 20_000_000) { addToast("PDF 20MB'den büyük.", "error"); return; }
      addToast(`${f.name} okunuyor…`, "info");
      void (async () => {
        try {
          const { extractPdfText } = await import("@/lib/pdf");
          const text = await extractPdfText(f);
          setAttachedFiles((prev) => [...prev, { path: f.name, content: text }]);
          addToast(`${f.name} eklendi (metin çıkarıldı).`, "success");
        } catch (e) {
          addToast(`PDF okunamadı: ${(e as Error).message}`, "error");
        }
      })();
      return;
    }
    /* L3 — Office (OOXML): .docx/.xlsx/.pptx istemcide açılıp düz metne
       çevrilir (lib/office.ts, bağımlılıksız ZIP+XML okuyucu). PDF akışıyla
       birebir aynı mantık: veri sunucuya gitmez. */
    if (isOfficeFile(f.name)) {
      if (f.size > 20_000_000) { addToast("Dosya 20MB'den büyük.", "error"); return; }
      addToast(`${f.name} okunuyor…`, "info");
      void (async () => {
        try {
          const { extractOfficeText } = await import("@/lib/office");
          const text = await extractOfficeText(f);
          if (!text.trim()) { addToast(`${f.name} içinde metin bulunamadı.`, "info"); return; }
          setAttachedFiles((prev) => [...prev, { path: f.name, content: text }]);
          addToast(`${f.name} eklendi (metin çıkarıldı).`, "success");
        } catch (e) {
          addToast(`${f.name} okunamadı: ${(e as Error).message}`, "error");
        }
      })();
      return;
    }
    /* .ipynb → hücre-bazlı okunur biçim (markdown + kod + çıktı). */
    if (f.name.toLowerCase().endsWith(".ipynb")) {
      if (f.size > 2_000_000) { addToast("Notebook 2MB'den büyük.", "error"); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const { ipynbToReadable } = await import("@/lib/notebook");
        setAttachedFiles((prev) => [...prev, { path: f.name, content: ipynbToReadable(reader.result as string) }]);
      };
      reader.readAsText(f);
      return;
    }
    if (f.size > 512_000) { addToast("Dosya 512KB'den büyük.", "error"); return; }
    /* ESKİ ikili Office biçimleri (.doc/.ppt/.xls) OOXML değil, zip de değil —
       yukarıdaki OOXML okuyucu bunları açamaz; net yönlendirme ver. */
    if (/\.(doc|ppt|xls)$/i.test(f.name)) {
      addToast("Eski Word/PowerPoint/Excel biçimi — .docx/.xlsx/.pptx olarak kaydet ya da PDF'e çevir.", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFiles((prev) => [...prev, { path: f.name, content: reader.result as string }]);
    };
    reader.readAsText(f);
  };

  /* Otomatik bellek: yanıt bittikten sonra arka planda son alışverişten kalıcı
     tercihleri damıt ve "🧠 Otomatik Bellek" skill'ine ekle. Gizli sohbetlerde
     ve ayar kapalıyken çalışmaz; hata ana akışı asla etkilemez. */
  const extractMemory = useCallback(async () => {
    const store = useStore.getState();
    if (store.config.autoMemory === false) return;
    const chat = store.current();
    if (!chat || chat.incognito) return;
    const active = store.activeModel();
    if (!active?.apiKey) return; // anahtarsız (Pollinations) uçta ekstra çağrı yapma
    const msgs = chat.messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant")?.content ?? "";
    if (!lastUser.trim() || !lastAssistant.trim()) return;
    const existing = store.config.skills?.find((s) => s.id === "auto_memory")?.content ?? "";
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: lastUser, assistantText: lastAssistant, existing,
          baseUrl: active.baseUrl, model: active.model, apiKey: await usableApiKey(active),
        }),
      });
      const { facts } = await res.json();
      if (Array.isArray(facts) && facts.length) {
        store.addAutoMemoryFacts(facts.filter((f: unknown): f is string => typeof f === "string"));
      }
    } catch { /* yoksay */ }
  }, []);

  /* Tek bir kanca komutunu çalıştırıp çıktısını döndür (yalnız Yerel Mod köprüsü
     çıktıyı doğrudan yakalayabilir). Köprü yoksa null. */
  const runHookCommand = useCallback(async (command: string): Promise<string | null> => {
    const cfg = useStore.getState().config;
    if (cfg.localMode && cfg.localBridgeUrl?.trim()) {
      try {
        const r = await fetch(`${cfg.localBridgeUrl.replace(/\/$/, "")}/exec`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.localBridgeToken || ""}` },
          body: JSON.stringify({ command }),
        });
        const d = await r.json();
        return typeof d.error === "string" ? `Hata: ${d.error}` : String(d.output ?? "").slice(0, 8000);
      } catch (e) {
        return `Yerel köprüye ulaşılamadı: ${(e as Error).message}`;
      }
    }
    return null;
  }, []);

  /* Olay kancalarını çalıştır. `edited` = bu tur dosya düzenlendi mi.
     - afterEdit: düzenleme olduysa komutu çalıştır, çıktıyı ajana GERİ BESLE
       (kendi kendine lint/test düzeltsin). En çok 3 tur (hookRunsRef) → döngü yok.
     - onFinish: ajan tamamen durunca yalnız bildir (geri besleme yok). */
  const runHooks = useCallback(async (edited: boolean, phase: "finish" | "error" = "finish") => {
    const hooks = (useStore.getState().config.hooks ?? []).filter((h) => h.enabled);
    if (!hooks.length) return;
    /* onError — ajan/komut hata verince yalnız bildir (geri besleme yok; köprü ile). */
    if (phase === "error") {
      const errHooks = hooks.filter((h) => h.event === "onError");
      const cfg = useStore.getState().config;
      if (errHooks.length && cfg.localMode && cfg.localBridgeUrl?.trim()) {
        for (const h of errHooks) {
          addToast(`🪝 ${h.label || h.command}`, "info");
          await runHookCommand(h.command);
        }
      }
      return;
    }
    /* afterEdit — geri-beslemeli oto-düzelt */
    if (edited && hookRunsRef.current < 3) {
      const editHooks = hooks.filter((h) => h.event === "afterEdit");
      if (editHooks.length) {
        hookRunsRef.current += 1;
        let fedBack = false;
        for (const h of editHooks) {
          addToast(`🪝 ${h.label || h.command}`, "info");
          const out = await runHookCommand(h.command);
          if (out !== null) {
            /* Yerel Mod: çıktıyı doğrudan ajana besle (terminal-output dinleyicisi
               yeni bir callApi başlatır → ajan sonucu görür, hatayı düzeltir). */
            window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command: h.command, output: out || "(çıktı yok)" } }));
          } else {
            /* Köprü yok: komutu terminalde çalıştır; terminal çıktıyı geri besler. */
            setTerminalOpen(true);
            window.dispatchEvent(new CustomEvent("craftai:terminal-run", { detail: { command: h.command } }));
          }
          fedBack = true;
        }
        if (fedBack) return; // geri-besleme yeni turu tetikler → onFinish'i bu turda atla
      }
    }
    /* onFinish — yalnız bildir (geri besleme yok; sadece köprü ile çalışır) */
    const finishHooks = hooks.filter((h) => h.event === "onFinish");
    if (finishHooks.length) {
      const cfg = useStore.getState().config;
      if (cfg.localMode && cfg.localBridgeUrl?.trim()) {
        for (const h of finishHooks) {
          addToast(`🪝 ${h.label || h.command}`, "info");
          const out = await runHookCommand(h.command);
          if (out !== null) addToast(`🪝 ${h.label || h.command} ✓`, "success");
        }
      }
    }
  }, [addToast, runHookCommand]);

  /* Otonom doğrulama komutunu tespit et (repo package.json'ından, bir kez önbelleğe
     alınır). Öncelik: check > lint (+typecheck/tsc). Bulunamazsa makul varsayılan. */
  const detectVerifyCommand = useCallback(async (): Promise<string> => {
    if (verifyCmdRef.current !== null) return verifyCmdRef.current;
    let cmd = "npm run lint";
    try {
      const store = useStore.getState();
      const r = store.repo;
      if (r) {
        const activeRepo = store.config.activeRepo || "";
        const prov = resolveRepoProvider(r, activeRepo);
        const tok = await store.tokenForRepo(activeRepo, prov);
        const pkgRaw = prov === "gitlab"
          ? await fetchGitLabFileContent(r.owner, r.repo, r.branch, "package.json", tok)
          : await fetchFileContent(r.owner, r.repo, r.branch, "package.json", tok);
        const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        const hasTs = !!(pkg.devDependencies?.typescript || pkg.dependencies?.typescript || scripts.typecheck);
        const parts: string[] = [];
        if (scripts.check) parts.push("npm run check");
        else {
          if (scripts.lint) parts.push("npm run lint");
          if (scripts.typecheck) parts.push("npm run typecheck");
          else if (hasTs) parts.push("npx tsc --noEmit");
        }
        if (parts.length) cmd = parts.join(" && ");
      }
    } catch { /* repo/paket okunamadı → varsayılan komut */ }
    verifyCmdRef.current = cmd;
    return cmd;
  }, []);

  /* Otonom Doğrula-Düzelt: ajan bir turda dosya düzenlediyse, arka plandaki terminalde
     doğrulama komutunu çalıştırır. Çıktı craftai:terminal-output ile ajana OTOMATİK
     döner → hata varsa düzeltir (sonraki tur tekrar doğrulanır), temizse onaylar.
     En çok 5 tur (verifyRunsRef) → döngü güvenliği. İki arka uçtan biri gerekir:
     Hibrit Köprü (terminalWsUrl, admin) VEYA WebContainer (tarayıcı desteği + bağlı
     repo, HERKESE açık — bkz. webcontainer.ts'teki paylaşımlı API anahtarı yedeği).
     İkisi de yoksa (ör. mobil/repo bağlı değil) sessizce atlar. */
  const runAutoVerify = useCallback(async (edited: boolean) => {
    const cfg = useStore.getState().config;
    if (!edited || cfg.autoVerify === false) return;
    const hasWs = !!cfg.terminalWsUrl?.trim();
    if (!hasWs) {
      /* WebContainer yolu: doğrulanacak gerçek bir repo bağlı olmalı (boş
         sandbox'ta build/test komutunun bir anlamı yok) ve tarayıcı
         SharedArrayBuffer/cross-origin-isolation'ı desteklemeli. */
      if (!useStore.getState().repo || !isWebContainerSupported()) return;
    }
    if (verifyRunsRef.current >= 5) return;
    verifyRunsRef.current += 1;
    const cmd = await detectVerifyCommand();
    if (!cmd) return;
    addToast(`🔎 Otonom doğrulama (${verifyRunsRef.current}/5): ${cmd}`, "info");
    runInTerminal(cmd);
  }, [addToast, detectVerifyCommand]);

  const callApi = useCallback(async (
    overrideAgent?: Agent | null,
    opts?: { continuation?: boolean; depth?: number; noStrongest?: boolean; modelId?: string },
  ) => {
    const store = useStore.getState();
    let active = store.activeModel();
    if (!active) { store.setSettingsOpen(true); return; }

    /* Otomatik efor/Ajan-Ekibi için son kullanıcı mesajı. */
    const _lastUserText = String(store.current()?.messages.findLast?.((m) => m.role === "user")?.content ?? "");
    /* Ajan Ekibi: kullanıcı elle açtıysa VEYA otomatik eşik (açıkça çok-parçalı
       ağır istek) tetiklendiyse devreye girer. Devam turlarında otomatik açılmaz. */
    /* ✦ OTOMATİK PİLOT — görünmez zeka: mod kararları (efor/web/araştırma/
       kalite/ekip) mesajdan tek noktada türetilir. Elle açılan çipler her
       zaman geçersiz kılar; devam turu ve slash-ajanlarda devreye girmez.
       Admin DIŞINDAKİ tüm hesaplarda Otomatik Pilot HER ZAMAN açıktır (Claude
       gibi tam otomatik — kapatma anahtarı bile yok); yalnız admin Ayarlar'dan
       kapatıp elle yönetebilir. */
    const isAdminNow = isAdminEmail(store.userEmail);
    const pilotEnabled = isAdminNow ? store.config.autoPilot !== false : true;
    const pilotRepoCtx = !!store.repo || !!(store.config.localMode && store.config.localBridgeUrl?.trim());
    const pilotShouldRun = pilotEnabled && !opts?.continuation && !overrideAgent;
    /* H6 — "ilk mesajda çok geç cevap veriyor". Pilot turu (/api/route-plan)
       ilk token'dan ÖNCE, seri olarak bekleniyor. O uç AYRI bir lambda: sohbetin
       ilk mesajında kendi soğuk açılışını da yaşıyor ve tipik bir ilk mesaj
       (60-300 karakter) `pilotConfidence`'tan geçemediği için bu tur neredeyse
       her zaman çalışıyordu. Sohbetin İLK mesajında artık ağa hiç çıkılmıyor;
       aynı kararlar senkron regex yoluyla (decidePilot — zaten dokümante edilmiş
       güvenli yedek) anında veriliyor. Sonraki mesajlarda lambda ısınmış olur ve
       LLM-tabanlı yönlendirme eskisi gibi devreye girer. */
    const userTurns = (store.current()?.messages ?? []).filter((m) => m.role === "user").length;
    const isFirstTurn = userTurns <= 1;
    const pilot: PilotDecision | null = !pilotShouldRun
      ? null
      : isFirstTurn
        ? decidePilot(_lastUserText, { hasRepo: pilotRepoCtx })
        : await decidePilotAsync(
            _lastUserText,
            { hasRepo: pilotRepoCtx },
            { baseUrl: active.baseUrl, model: active.model, apiKey: await usableApiKey(active) },
          );
    setLastPilot(pilot);
    /* Ajan Ekibi: elle çip artık yok — yalnız Otomatik Pilot'un kararına
       (ya da Pilot devre dışıysa eski regex yedeğine) bağlı. */
    const useSwarm = pilot ? pilot.swarm : (store.config.autoSwarm !== false && !opts?.continuation && autoSwarm(_lastUserText));
    /* Derin Araştırma: kullanıcı "/research" ajanını seçtiyse ya da Otomatik
       Pilot gerek gördüyse (devam turlarında değil). */
    const useResearch = (overrideAgent?.id === "research" || !!pilot?.research) && !opts?.continuation;
    const wantWeb = !!pilot?.web;
    /* Faz 6 (kullanıcı kararı): yalnız generate_image — repo bağlı olmasa/
       Tools kapalı olsa bile doğal dilden görsel isteği algılanırsa bu TEK
       araç sunucudaki tool-loop'a eklenir (bkz. api/chat/route.ts'in
       body.imageGen dalı). deep_research/dispatch_agents hâlâ repo ister. */
    const wantImageGen = !!pilot?.image;
    /* Sunucu (route.ts'in generate_image işleyicisi) her zaman anahtarsız
       Pollinations'a düşüyordu — kullanıcının Ayarlar → Model'de seçtiği/
       eklediği modelden TAMAMEN bağımsız, kafa karıştırıcıydı ("Model X seçili
       ama Pollinations kullanılıyor" raporu). Ayarlar → Görsel üretimi
       tercihine göre (auto/pollinations/sabit sağlayıcı) BYOK sağlayıcıyı
       burada, istekten ÖNCE çöz ve sunucuya ilet — /gorsel komutunun zaten
       kullandığı AYNI pickImageProvider mantığı. */
    let imageModelPref: { provider: ImageProvider; apiKey: string } | null = null;
    /* Ajanın generate_image aracı için TÜM zincir gönderilir (yalnız ilk aday
       değil): önceden tek aday yollanıyordu, o da başarısız olunca sunucu
       doğrudan anahtarsız Pollinations'a düşüyordu — Ayarlar'daki "görsel
       yedek zinciri" seçeneği ajan yolunda hiç işlemiyordu. */
    let imageModelChain: { provider: ImageProvider; apiKey: string }[] = [];
    /* KAPI GENİŞ TUTULUR: sağlayıcı yalnız `wantImageGen` (doğal dil regex'i)
       tetiklendiğinde çözülüyordu. Oysa generate_image aracı modele DAHA GENİŞ
       durumda sunuluyor (repo bağlı/Tools açıkken coderTools içinde de var) —
       o hâllerde istemci hiç BYOK adayı yollamıyor, sunucu da mecburen
       anahtarsız Pollinations'a düşüyordu. Kullanıcının şikâyeti tam buydu:
       "Pollinations değil, hangi model seçiliyse o kullanılsın". Araç
       çağrılabiliyorsa aday da hazır olmalı. */
    if (wantImageGen || (store.toolsEnabled && pilotRepoCtx)) {
      try {
        const { pickImageProvider, buildImageFallbackChain } = await import("@/lib/imageGen");
        imageModelPref = await pickImageProvider(store.config);
        if (imageModelPref) imageModelChain.push(imageModelPref);
        if (store.config.imageFallbackChain) {
          const rest = await buildImageFallbackChain(store.config, imageModelPref?.provider).catch(() => []);
          imageModelChain = [...imageModelChain, ...rest];
        }
      } catch { /* yoksay → sunucu Pollinations tabanına düşer */ }
    }
    /* Ajan Ekibi / Araştırma turunda otomatik EN GÜÇLÜ modeli kullan (ayar açıksa)
       → en yetenekli modelle çalışır. Hata olursa (kredi/anahtar yok) aşağıdaki
       catch bloğu sessizce AKTİF modele döner ve tekrar dener. */
    let usedStrongest = false;
    if ((useSwarm || useResearch) && !opts?.noStrongest && useStore.getState().config.agentsUseStrongestModel !== false) {
      const strong = store.strongestModel();
      if (strong && strong.id !== active.id) { active = strong; usedStrongest = true; }
    }

    /* Proje-başına model/örnekleme: aktif projenin ayarları global'i geçersiz kılar. */
    const activeProjectCfg = store.config.projects.find((p) => p.id === store.config.activeProjectId);
    if (activeProjectCfg?.modelId) {
      const override = store.config.models.find((m) => m.id === activeProjectCfg.modelId);
      if (override) active = override;
    }
    /* N2 — "farklı modelle yeniden dene": kullanıcının bu tur için AÇIKÇA
       seçtiği model her şeyi (aktif model, proje ayarı, strongest yükseltmesi)
       geçersiz kılar — en son uygulanır çünkü en açık niyet budur. */
    if (opts?.modelId) {
      const picked = store.config.models.find((m) => m.id === opts.modelId);
      if (picked) { active = picked; usedStrongest = false; }
    }

    /* API anahtarını ŞİMDİ çöz (active artık kesin) → sağlayıcıya asla şifreli
       blob gitmesin; çözülemezse boş + kullanıcı uyarısı (usableApiKey). */
    const reqKey = await usableApiKey(active);

    const chat = store.current();
    const lastUserMsg = chat?.messages.findLast?.((m) => m.role === "user");
    const messageAgentId = lastUserMsg?.agentId;
    const agent =
      overrideAgent !== undefined
        ? overrideAgent
        : messageAgentId
        ? ALL_AGENTS.find((a) => a.id === messageAgentId) ?? null
        : null;

    /* Devam modu (Claude Code tarzı): kesilen asistan yanıtı YENİ baloncuk
       açmadan, aynı mesajın içinden sürdürülür. Sohbete görünür bir kullanıcı
       mesajı eklenmez; talimat yalnızca API isteğine iliştirilir. */
    const lastMsg = chat?.messages[chat.messages.length - 1];
    const isContinuation = !!opts?.continuation && lastMsg?.role === "assistant" && !!lastMsg.content;

    const rawMessages = (chat?.messages ?? []).map((m) => {
      if (m.images?.length) {
        const content: unknown[] = m.images.map((img) => ({ type: "image_url", image_url: { url: img } }));
        content.push({ type: "text", text: m.content });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });
    if (isContinuation) {
      rawMessages.push({
        role: "user",
        content:
          "[Devam] Önceki yanıtın token sınırında kesildi. Tam kaldığın yerden sür: " +
          "kesilen cümlenin/kod bloğunun ortasından devam et, önceki metni TEKRARLAMA, " +
          "selamlama veya giriş cümlesi YAZMA, açık kalan markdown/kod bloğu yapısını koru.",
      });
    }
    /* Bağlam penceresi + OTOMATİK SIKIŞTIRMA: eşik aşılınca eski mesajlar LLM ile
       tek özete damıtılır (Claude Code /compact gibi), son KEEP mesaj aynen
       gönderilir. Stored sohbet DEĞİŞMEZ (yalnızca gönderilen kopya sıkışır).
       ÖNCEDEN özetleme çağrısı bu turu BEKLETİYORDU (await) — KEEP sabit
       kaldığından eşik neredeyse HER turda kayıyor, yani bu nadir değil,
       uzun sohbette tekrar eden bir duraklamaydı. Artık HİÇBİR tur bloklanmaz
       (bkz. compactPlan): hazır bir özet varsa kullanılır, yoksa bu tur ham
       kırpmaya düşer ve arka planda taze bir özet istenir — sonraki tur
       hazır bulur. */
    const MAX_CTX = 60;
    const KEEP = 40;
    let apiMessages: { role: string; content: string | unknown[] }[];
    if (rawMessages.length > MAX_CTX && active) {
      const older = rawMessages.slice(0, rawMessages.length - KEEP);
      const recent = rawMessages.slice(-KEEP);
      const cacheKey = `${chat?.id ?? "_"}:${older.length}`;
      const { summary, shouldRefresh } = compactPlan(cacheKey, compactCacheRef.current, compactPendingKeyRef.current);
      if (shouldRefresh) {
        compactPendingKeyRef.current = cacheKey;
        const transcript = older
          .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : "[görsel]"}`)
          .join("\n\n");
        void fetch("/api/compact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, baseUrl: active.baseUrl, model: active.model, apiKey: reqKey }),
        })
          .then((cr) => cr.json())
          .then((d) => {
            const s = d?.summary || "";
            if (s) {
              compactCacheRef.current = { key: cacheKey, summary: s };
              addToast("Bağlam otomatik özetlendi (uzun sohbet).", "info");
            }
          })
          .catch(() => { /* arka plan özetleme başarısız — sonraki turda tekrar denenir */ })
          .finally(() => {
            if (compactPendingKeyRef.current === cacheKey) compactPendingKeyRef.current = null;
          });
      }
      apiMessages = summary
        ? [{ role: "system" as const, content: `[Önceki konuşmanın özeti — bağlamı koru]\n${summary}` }, ...recent]
        : [{ role: "system" as const, content: `[Bağlam notu: ${rawMessages.length} mesajdan son ${KEEP}'i gönderiliyor.]` }, ...recent];
    } else {
      apiMessages = rawMessages;
    }

    const activeProject = config.projects.find((p) => p.id === config.activeProjectId);
    /* Proje bilgi tabanı enjeksiyonu. Büyükse (RAG-lite): tüm dosyaları gömmek
       yerine soruya en ilgili parçaları getir → token tasarrufu + alaka. Küçükse
       veya eşleşme yoksa mevcut davranış (tüm dosyalar, kırpılmış). */
    const pkFiles = activeProject?.files ?? [];
    let projectKB = "";
    if (pkFiles.length) {
      const pkTotal = pkFiles.reduce((a, f) => a + f.content.length, 0);
      if (pkTotal > 8000 && _lastUserText.trim()) {
        const hits = retrieve(_lastUserText, pkFiles.map((f) => ({ name: f.name, content: f.content })), 6);
        if (hits.length) projectKB = `## Proje Bilgi Tabanı (soruya en ilgili alıntılar)\n${hits.map((h) => `### ${h.name}\n${h.chunk}`).join("\n\n")}`;
      }
      if (!projectKB) projectKB = `## Proje Bilgi Tabanı (referans dosyalar — örnek/bağlam olarak kullan)\n${pkFiles.map((f) => `### ${f.name}\n${f.content.slice(0, 6000)}${f.content.length > 6000 ? "\n…(kırpıldı)" : ""}`).join("\n\n")}`;
    }
    const coderSystemPrompt = [
      config.systemPrompt,
      CRAFT_OPERATING_MANUAL,
      agent
        ? agent.systemPrompt + ((store.toolsEnabled && (!!store.repo || (store.config.localMode && store.config.localBridgeUrl?.trim())))
            ? "\n\n[Araçlar açık] Tahmin etme — gerektiğinde read_file/read_files/grep/glob ile ilgili dosyaları incele, git_diff/git_log/git_blame ile değişiklikleri ve geçmişi gör, discover_rules ile proje kurallarını (CLAUDE.md/.rules) oku. ÖNCE keşfet, SONRA yanıtla; iddialarını dosya kanıtına dayandır."
            : "")
        : "Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun. KARMAŞIK (çok adımlı) görevlerde ÖNCE update_plan ile KISA bir plan (yapılacaklar listesi) sun, sonra adım adım uygula ve her adım bitince planı güncelle.",
      activeProject?.systemPrompt?.trim() ? `## Proje: ${activeProject.name}\n${activeProject.systemPrompt.trim()}` : "",
      projectKB,
      config.rulesFile?.trim() ? `## Proje Kuralları (.rules)\n${config.rulesFile.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    if (!isContinuation) store.pushMessage({ role: "assistant", content: "" });
    store.setFinishReasonOnLast(undefined); // bayatlamış "kesildi" şeridini temizle
    store.setStreaming(true);
    if (!isContinuation) { setCheckpoints([]); setCheckpointsExpanded(false); } // yeni tur — önceki turun geri-al noktaları sıfırlanır
    const turnCheckpoints: { path: string; previous: string | null }[] =
      isContinuation ? [...(lastMsg?.checkpoints ?? [])] : []; // devamda önceki yazmalar korunur
    setPendingActions([]); // bekleyen yıkıcı işlem önerileri
    setPendingSurvey(null); // önceki anketi temizle
    coderAbort = new AbortController();

    /* ✦ Faz 3 — Kalite güçlendirme: pilot "kalite" dediyse YA DA kullanıcı
       "Kalite" çipini elle açtıysa (araçsız, tekil sohbet turlarında) arka
       planda 1-3 iç taslak üret; nihai yanıt bunları eleştirip birleştirerek
       AKIŞLI yazılır. Ortalama model → üstün çıktı. Max eforda 3. taslak her
       zaman Pollinations'ın ücretsiz kataloğundan gelir (ücretli kullanıcıyı
       3. bir ücretli çağrıya zorlamaz); elle açılan çip efor max olmasa bile
       en az 2 model birleştirir — buton gerçekten bir şey yapar. Başarılı
       füzyonun modelleri mesaja kalıcı bir rozet olarak iğnelenir. */
    let boostDrafts: import("@/lib/boost").DraftResult[] = [];
    let boostJudge: import("@/lib/boost").DraftJudge | null = null;
    const toolsWanted = store.toolsEnabled && (!!store.repo || !!(store.config.localMode && store.config.localBridgeUrl?.trim()));
    const qualityTier = store.config.qualityTier ?? "standard";
    /* FÜZYON (kalite="high") yalnız üretim işlerinde (pilot.fusion — autoFusion,
       mesajda hem bir üretim nesnesi (site/uygulama/kod…) hem üretim fiili
       birlikte geçtiğinde) tetiklenir. ÖNCEDEN varsayılan-açık qualityMode de
       bu ağır 3-taslak+hakem hattını tetikliyordu — "Otomatik Fusion her
       mesajda çalışıyor" şikayetinin kök sebebi buydu (qualityMode her
       kullanıcıda varsayılan açık olduğundan neredeyse her uygun mesaj bu
       pahalı hattı ateşliyordu). "standard" kademe artık YALNIZCA aşağıdaki
       hafif, ekstra API çağrısı gerektirmeyen tek-geçişli talimata etki eder
       (bkz. finalSystemPrompt). Kullanıcı Ayarlar → Kalite'de "Kapalı" ya da
       "Standart" seçtiyse bu ağır hat hiç çalışmaz — yalnız "Yüksek" tetikler. */
    /* Kesin model modu (strictModel): Fusion doğası gereği birden fazla modeli
       (3. taslak her zaman Pollinations'tan) birleştirir — "yalnızca seçtiğim
       model cevap versin" isteğiyle doğrudan çelişir, bu yüzden hiç tetiklenmez. */
    if (qualityTier === "high" && pilot?.fusion && !useSwarm && !useResearch && !toolsWanted && !isContinuation && !store.config.strictModel) {
      try {
        useStore.getState().updateLastThinking("✦ Füzyon: 3 iç taslak hazırlanıyor…");
        const freeModelNames = await fetchTextModels();
        /* Ayarlar → Kalite'de kullanıcı model seçtiyse (qualityModelIds dolu)
           o modeller kullanılır; boşsa çeşitlilik sezgisi çalışır (pickDraftModels). */
        const manualFusionIds = store.config.qualityModelIds?.length ? store.config.qualityModelIds : undefined;
        const draftProfiles = pickDraftModels(
          store.config.models, active, 3, store.strongestModel(), freeModelNames, manualFusionIds,
        );
        /* Farklı model kalmadıysa aynı modelin farklı sıcaklıklı kopyaları
           (öz-tutarlılık) — anahtarsız tek-model kurulumda bile 3 gerçek taslak. */
        const slots = fillSelfConsistency(draftProfiles, active, 3);
        const withKeys = await Promise.all(slots.map(async (s) => ({
          baseUrl: s.profile.baseUrl, model: s.profile.model, provider: s.profile.provider,
          apiKey: await usableApiKey(s.profile), temperature: s.temperature,
        })));
        /* Taslak modellerinden biri kota/erişim hatası verirse (kredi bittiyse)
           otomatik bir sonraki uygun modele düşülür — bkz. generateDrafts.
           Ayarlar'daki "kalite öncelikli" seçeneği açıksa aynı kurallarla
           (anahtarsız son çare güvencesi dahil) ama en güçlüden en zayıfa. */
        const fusionFallbacks = buildChainFor(store.config, active.id);
        boostDrafts = await generateDrafts({ userText: _lastUserText, models: withKeys, fallbacks: fusionFallbacks, signal: coderAbort.signal });
        if (boostDrafts.length >= 2) {
          /* HAKEM: en iyi taslağı seç + diğerlerinden alınacakları not et —
             sentez bu karara göre en iyi taslağı omurga yapar. */
          useStore.getState().updateLastThinking("✦ Hakem: taslaklar karşılaştırılıyor…");
          boostJudge = await judgeDrafts({
            userText: _lastUserText, drafts: boostDrafts.map((d) => d.text),
            model: { baseUrl: active.baseUrl, model: active.model, provider: active.provider, apiKey: reqKey },
            signal: coderAbort.signal,
          });
        }
        if (boostDrafts.length) {
          useStore.getState().updateLastThinking(`✦ Füzyon: ${boostDrafts.length} taslak${boostJudge ? " + hakem kararı" : ""} birleştiriliyor…`);
          /* GERÇEKTEN başarıyla taslak üreten modeller — slots'un İLK N elemanını
             almak (önceki hata) bir slot elendiğinde YANLIŞ modelleri etiketlerdi
             (bkz. generateDrafts'ın DraftResult.model'i). */
          useStore.getState().setFusionModelsOnLast(boostDrafts.map((d) => d.model));
          trackEvent("fusion_used", undefined, { draftCount: boostDrafts.length, hasJudge: !!boostJudge });
        }
      } catch { boostDrafts = []; boostJudge = null; /* güçlendirme başarısızsa normal akış */ }
    }
    const abortCtl = coderAbort;

    /* Efor "otomatik" bırakılırsa Otomatik Pilot karar verir; kullanıcı elle
       bir seviye seçtiyse (bkz. EffortMenuControl) o seçim geçerli olur. */
    const thinkingMode = store.thinkingMode === "auto" ? (pilot?.effort ?? autoEffort(_lastUserText)) : store.thinkingMode;
    let finalSystemPrompt = coderSystemPrompt;
    if (thinkingMode === "medium") {
      finalSystemPrompt += "\n\n[EFOR: ORTA] Yanıtlamadan önce kısa bir iç değerlendirme yap, ardından net ve eksiksiz yanıt ver.";
    } else if (thinkingMode === "high") {
      finalSystemPrompt +=
        "\n\n[EFOR: YÜKSEK] Bu göreve ciddi efor harca: adım adım analiz et, " +
        "olası yaklaşımları kıyasla, edge case'leri düşün, ardından gerekçeli ve eksiksiz çözümü ver.";
    } else if (thinkingMode === "max") {
      finalSystemPrompt +=
        "\n\n[EFOR: MAX] Mümkün olan en yüksek eforu harca. Problemi birden fazla açıdan incele, " +
        "tüm alternatif yaklaşımları değerlendir, olası hataları ve edge case'leri listele, " +
        "güvenlik ve performans etkilerini değerlendir, ardından en sağlam çözümü tam gerekçesiyle sun. Kısa kesme.";
    }
    /* Çok-geçişli kalite modu: taslak → öz-eleştiri → düzeltme döngüsünü tek
       yanıt içinde uygulat (yalnızca nihai sürümü göster). */
    if (boostDrafts.length > 0) {
      finalSystemPrompt += buildBoostInstruction(boostDrafts.map((d) => d.text), boostJudge);
    } else if (qualityTier !== "off") {
      finalSystemPrompt +=
        "\n\n[KALİTE MODU] Yanıtını üç aşamada üret ama YALNIZCA son sürümü göster: " +
        "(1) TASLAK: hızlı bir ilk çözüm düşün. " +
        "(2) ÖZ-ELEŞTİRİ: taslağındaki hataları, eksikleri, edge-case'leri ve daha iyi yaklaşımları içten değerlendir. " +
        "(3) DÜZELTME: eleştirini uygulayıp en doğru, eksiksiz ve sağlam yanıtı ver. " +
        "Taslak ve eleştiri sürecini YAZMA; sadece nihai, düzeltilmiş yanıtı sun.";
    }
    /* Öğrenme Modu: üniversite yazılım öğrencileri için eğitsel yanıt. Kodun
       yanında "neden"i, kavram tanımlarını ve sırada öğrenilecekleri ver. */
    if (store.config.learningMode) {
      finalSystemPrompt +=
        "\n\n[ÖĞRENME MODU] Kullanıcı yazılım öğrenen bir öğrenci. Yanıtını eğitsel kur: " +
        "(1) Önce kısa, sade bir genel bakışla NE yapacağını ve NEDEN bu yaklaşımı seçtiğini açıkla. " +
        "(2) Kodu adım adım, yorum satırlarıyla ver; geçen teknik terim/jargonu (ör. closure, async, big-O) parantez içinde kısaca Türkçe tanımla. " +
        "(3) Yaygın hataları/edge-case'leri ve 'neden böyle' mantığını belirt. " +
        "(4) Sonunda 'Sırada öğren' başlığıyla 2-3 ilgili kavram/kaynak öner. " +
        "Üstten bakmadan, anlaşılır ve cesaretlendirici bir dille yaz. Kod kalitesinden ödün verme.";
    }
    /* Özel yazı stili: aktifse kullanıcı tanımlı talimatları ekle (yerleşik stilin
       yerine geçer — UI seçimde ikisi karşılıklı dışlanır). */
    if (store.config.activeCustomStyleId) {
      const cs = (store.config.customStyles ?? []).find((s) => s.id === store.config.activeCustomStyleId);
      if (cs?.instructions.trim()) finalSystemPrompt += `\n\n[Stil]: ${cs.instructions.trim()}`;
    }

    const repo = store.repo;
    /* Yerel Mod: köprü tanımlı ve açıksa, github/gitlab repo'ya gerek kalmadan
       araçlar gerçek dosya sistemine + kabuğa erişir. */
    const localActive = !!(store.config.localMode && store.config.localBridgeUrl?.trim());
    const toolsEnabled = store.toolsEnabled && (!!repo || localActive);
    const activeRepo = store.config.activeRepo || "";
    const repoIsGitLab = resolveRepoProvider(store.repo, activeRepo) === "gitlab";
    /* ÇÖZÜLMÜŞ token — depodaki 'enc:1:…' blob'u sunucuya gitmemeli, yoksa
       ajanın TÜM repo araçları 401 alır ("repo bağlı ama model tanımıyor").
       Eskiden HER İKİ sağlayıcının AKTİF hesabının token'ı çekilip aralarından
       seçiliyordu; artık deponun kendi hesabına bağlı token alınır (bkz.
       tokenForRepo) — birden çok hesap bağlıyken doğru olan budur. */
    const repoToken = await store.tokenForRepo(activeRepo, repoIsGitLab ? "gitlab" : "github");

    /* Web search pre-fetch: when searchOn, fetch Jina results before sending to AI */
    let webSearchContext = "";
    if (wantWeb) {
      const userQuery = lastUserMsg?.content ?? "";
      try {
        const wsr = await fetch(`/api/web-search?q=${encodeURIComponent(userQuery)}`, {
          signal: AbortSignal.timeout(12000),
        });
        if (wsr.ok) webSearchContext = await wsr.text();
      } catch { /* ignore — continue without search */ }
      /* Kaynakları metinden ayrıkla → yanıt altında "Kaynaklar" olarak göster. */
      const sources: { title: string; url: string }[] = [];
      for (const block of webSearchContext.split("\n\n")) {
        const lines = block.split("\n");
        const title = (lines[0] || "").replace(/^[•\-*]\s*/, "").trim();
        const url = (lines.find((l) => /^\s*https?:\/\//.test(l)) || "").trim();
        if (url && title && sources.length < 8 && !sources.some((s) => s.url === url)) sources.push({ title, url });
      }
      if (sources.length) store.setSourcesOnLast(sources);
    }

    /* Devam modunda full mevcut içerikten başlar → akış aynı baloncuğa eklenir. */
    const priorLen = isContinuation ? (lastMsg?.content.length ?? 0) : 0;
    let full = isContinuation ? (lastMsg?.content ?? "") : ""; // try/catch ortak erişimi
    /* R2/S1 — akıcı yazma. Eskiden her token'da updateLastContent(full)
       çağrılıyor, ReactMarkdown mesajın tamamını baştan ayrıştırıyordu (uzun
       yanıtta ~1.000 ayrıştırma) ve metin blok blok zıplayarak beliriyordu.
       Artık token'lar tampona yazılır, çizim kare hızına bağlanır. */
    let reveal: RevealController | null = null;
    let cutAtLength = false; // finish_event: "length" ⇒ otomatik devam tetiklenebilir
    let realUsage: { prompt: number; completion: number } | null = null; // sağlayıcı gerçek token
    /* reasoning delta'ları birikir. Boştan BAŞLAMAZ: Füzyon/Hakem bloğu bu
       turda zaten "•••" panosuna bir durum notu ("✦ Füzyon: N taslak
       birleştiriliyor…" vb.) yazmış olabilir — buradan "" ile başlamak,
       gerçek reasoning delta'sı gelir gelmez o notu SESSİZCE SİLİYORDU
       (updateLastThinking her zaman TAM DEĞİŞTİRME yapar, birleştirmez).
       Var olan notu üstüne ekleyerek koru; yoksa (Füzyon çalışmadıysa)
       zaten boş başlar, davranış değişmez. */
    let thinkingFull = (() => {
      const s = useStore.getState();
      const prior = s.chats.find((c) => c.id === s.currentId)?.messages.slice(-1)[0]?.thinking ?? "";
      return prior ? `${prior}\n\n` : "";
    })();
    try {
      /* Projeye özel Skills: aktif projede skillIds tanımlıysa global "enabled"
         yerine yalnızca o set kullanılır; aksi halde global aktif skills. */
      const projectSkillIds = activeProject?.skillIds;
      const allEnabledSkills = projectSkillIds && projectSkillIds.length > 0
        ? (store.config.skills ?? []).filter((s) => projectSkillIds.includes(s.id))
        : (store.config.skills ?? []).filter((s) => s.enabled);
      /* Alaka seçimi (K1): 5'ten fazla etkin skill varsa son kullanıcı
         mesajıyla anahtar-kelime örtüşmesine göre en alakalı 5'i seç —
         genChat.ts'in Stüdyo motorlarıyla PAYLAŞILAN tek kaynak (bkz.
         selectRelevantSkills, prompt.ts). */
      const lastUserText = String(chat?.messages.findLast?.((m) => m.role === "user")?.content ?? "");
      const activeSkills = selectRelevantSkills(allEnabledSkills, lastUserText);
      /* Sunucu-proxy üzerinden çağrı (tüm sağlayıcılar için ortak; Pollinations
         doğrudan tarayıcı çağrısı başarısız olursa yedek olarak da kullanılır.
         Sunucu Pollinations'ı anahtarsız destekler). */
      /* Ajan Ekibi/Derin Araştırma /api/chat İÇİNDE de birer araç olarak
         çalışabiliyor (dispatch_agents/deep_research, bkz. tools.ts) — ama bu
         araçlar yalnızca gerçek bir repo bağlıyken SUNULUYOR (body.tools &&
         body.repoCtx, bkz. api/chat/route.ts). /api/research ve /api/orchestrate
         repo GEREKTİRMEZ (yalnızca web/alt-ajan çalıştırır) — bu yüzden repo
         bağlı değilken (veya yalnız yerel köprü bağlıyken, ki o da gerçek bir
         repoCtx üretmez) bu iki uç Ekip/Araştırma'nın çalıştığı yoldur.
         Araçların tümünü repo'suz sohbete açmak ayrı bir karar olarak
         ERTELENDİ (mimari planın "Faz 6" notu).

         H3 (Tem 2026): kullanıcının kararına göre ajan ekibi artık DEPO
         GEREKTİRMİYOR — kapı autoPilot'taydı (`ctx.hasRepo && autoSwarm`) ve
         useSwarm'ı reposuz sohbette hep false yapıyordu, yani aşağıdaki
         /api/orchestrate dalına hiç girilmiyordu. Kapı kaldırıldı; uç zaten
         reposuz çalışmayı destekliyordu. */
      const endpoint = useResearch
        ? "/api/research"
        : useSwarm && !isContinuation ? "/api/orchestrate" : "/api/chat";
      const callViaServer = () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortCtl.signal,
        body: JSON.stringify({
          messages: apiMessages,
          /* Dayanıklılık: sekme yanıt bitmeden kapanırsa sunucu bu chatId'ye
             nihai yanıtı yazıp push bildirimi gönderir (yalnız /api/chat okur;
             gizli sohbette hiç gönderilmez — Supabase'e hiçbir şey gitmemeli). */
          chatId: !incognito ? chat?.id : undefined,
          baseUrl: active.baseUrl, model: active.model, apiKey: reqKey,
          provider: active.provider, systemPrompt: finalSystemPrompt,
          /* Çok-sağlayıcılı otomatik fallback: aktif model hata verirse sunucu
             sırayla bu adayları dener (kullanıcı duvara çarpmaz). Ayarlar'daki
             "kalite öncelikli" seçeneği açıksa ücretli/ücretsiz ayrımı yapmadan
             en güçlüden en zayıfa sıralanır. */
          fallbacks: buildChainFor(store.config, active.id),
          strictModel: store.config.strictModel,
          style: store.config.style,
          memories: store.config.memories,
          skills: activeSkills.map((s) => ({
            title: s.title, content: s.content, tags: s.tags, source: s.source, fileName: s.fileName,
          })),
          tools: toolsEnabled,
          webSearch: wantWeb,
          imageGen: wantImageGen,
          imageModel: imageModelPref ?? undefined,
          imageModels: imageModelChain.length ? imageModelChain : undefined,
          requireWriteApproval: store.config.requireWriteApproval,
          safeMode: store.config.safeMode,
          toolPermissions: store.config.toolPermissions,
          planApprovalMode: store.config.planApprovalMode,
          planApproved: planApprovedRef.current,
          blockNetworkTools: store.config.blockNetworkTools,
          /* Terminal varsa ajana run_command aracı sunulur (uzak WS veya WebContainer). */
          terminalAvailable: localActive || !!(store.config.terminalWsUrl?.trim()) || terminalSupported,
          /* L1 — analiz aracı: kod kullanıcının tarayıcısında (Pyodide/Web Worker)
             çalıştığı için bu istemci her zaman destekler; sunucu bunu görünce
             run_code aracını ajana sunar. */
          codeExec: true,
          temperature: activeProjectCfg?.temperature,
          maxTokens: activeProjectCfg?.maxTokens,
          effort: thinkingMode,
          searchContext: webSearchContext || undefined,
          repoCtx: toolsEnabled
            ? (localActive
                ? {
                    /* Bağlı deponun KİMLİĞİ köprü modunda da gönderilir.
                       Eskiden burada sabit "local/local" vardı: kullanıcının
                       Ayarlar'dan bağladığı depo sessizce atılıyor, ajan
                       yalnızca köprünün çalışma KÖKÜNÜ görüyordu. O kök çoğu
                       kurulumda birden çok projeyi barındırır ve kendisi git
                       deposu değildir — ajan da alâkasız bir projeyi "bağlı
                       depo" sanıp onun remote'unu bildiriyordu. "GitLab bağlı
                       değil / model repoyu göremiyor" raporlarının gerçek
                       sebebi buydu. */
                    owner: repo?.owner ?? "local",
                    repo: repo?.repo ?? "local",
                    branch: repo?.branch ?? "main",
                    provider: "local",
                    bridgeUrl: store.config.localBridgeUrl,
                    bridgeToken: store.config.localBridgeToken,
                    /* Projenin köprü kökü altındaki klasörü — ajanın görüşünü
                       o klasöre hapseder. Elle belirtilmediyse bağlı deponun
                       adı kullanılır (ör. "craft-coder"). */
                    bridgeDir: store.config.localBridgeDir?.trim() || repo?.repo || undefined,
                    /* Depo hem token'la (GitHub/GitLab) HEM köprüyle aynı anda
                       bağlıysa: sunucu bunu kullanıp depoyu köprünün diskine
                       gerçekten klonlar/günceller (bkz. api/chat/route.ts
                       ensureBridgeRepo) — token bağlantısı ARTIK sessizce
                       görmezden gelinmez, köprünün GERÇEK içeriğini besler. */
                    gitSource: repo ? { provider: repoIsGitLab ? "gitlab" as const : "github" as const, token: repoToken } : undefined,
                  }
                : repo
                  ? {
                      owner: repo.owner,
                      repo: repo.repo,
                      branch: repo.branch,
                      token: repoToken,
                      provider: repoIsGitLab ? "gitlab" : "github",
                    }
                  : undefined)
            : undefined,
          mcpServers: filterMcpServersForModel(store.config.mcpServers ?? [], active.id).map((s) => ({
            url: s.url,
            headers: s.headers,
            enabled: s.enabled,
          })),
        }),
      });

      /* Pollinations: tarayıcıdan doğrudan çağrı yapılır (her kullanıcı kendi IP'sini kullanır,
         sunucu IP'si paylaşıldığında oluşan rate-limit sorunu önlenir). CORS açık. */
      let res: Response;
      /* Pollinations'ı yalnızca DÜZ sohbette doğrudan tarayıcıdan çağır (hızlı +
         kullanıcının kendi IP'si). Araç-kullanımı/web-arama/görsel-üretimi
         TOOL-LOOP gerektirir → bunlar sunucu-proxy'ye gider (yoksa araçlar
         sessizce çalışmaz, model repodan/araçlardan habersiz kalır). */
      if (active.provider === "pollinations" && !toolsEnabled && !wantWeb && !wantImageGen) {
        /* Bağlam blokları sunucu (/api/chat) ile ORTAK tek kaynaktan gelir →
           Pollinations kullanıcıları da aynı, eksiksiz bağlamı alır. PLATFORM_KNOWLEDGE
           eklenir ki bu sağlayıcıdaki model de platformun farkında olsun. */
        const sysContent = finalSystemPrompt + "\n\n" + PLATFORM_KNOWLEDGE + buildContextSections({
          style: store.config.style,
          memories: store.config.memories,
          skills: activeSkills,
          searchContext: webSearchContext || undefined,
        });
        /* `referrer`: Pollinations anonim (referrer'sız) istekleri en agresif
           kısıtlar. Sabit bir referrer eklemek daha yüksek limitli kovaya alır. */
        const makePolBody = (modelName: string) => JSON.stringify({
          model: modelName,
          messages: [{ role: "system", content: sysContent }, ...apiMessages],
          stream: true,
          referrer: "craft-coder",
        });
        /* Cycle through models on 429: try each for up to 2 attempts before moving on.
           Order: selected → openai → mistral → llama (least to most likely available) */
        /* Pollinations eski API'sinde artık tek anonim model var (openai-fast;
           takma adı openai) — mistral/llama 404 döndürüyor, kuyruktan çıkarıldı.
           Görselli mesajda da aynı uca gidilir; model görseli desteklemiyorsa
           sunucu-proxy fallback zinciri devreye girer. */
        const startModel = active.model === "openai-fast" ? "openai" : active.model;
        const POL_FALLBACKS = ["openai"].filter((m) => m !== startModel);
        const polQueue = [startModel, ...POL_FALLBACKS];
        let polModel = polQueue.shift()!;
        let polAttempt = 0;
        const POL_WAIT = 3000;
        /* Opsiyonel ücretsiz Pollinations token'ı (Ayarlar'da model anahtarı
           alanına yapıştırılırsa) limiti yükseltir; yoksa anonim denenir. */
        const polHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (reqKey) polHeaders["Authorization"] = `Bearer ${reqKey}`;
        try {
          while (true) {
            res = await fetch(`${active.baseUrl}/chat/completions`, {
              method: "POST",
              headers: polHeaders,
              signal: abortCtl.signal,
              body: makePolBody(polModel),
            });
            if (res.status !== 429) break;
            if (polAttempt < 1) {
              polAttempt++;
              addToast(`Pollinations yoğun, ${POL_WAIT / 1000}s sonra tekrar deneniyor...`, "info");
              await new Promise<void>((resolve) => {
                const t = setTimeout(resolve, POL_WAIT);
                abortCtl.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
              });
              if (abortCtl.signal.aborted) throw new DOMException("Aborted", "AbortError");
            } else if (polQueue.length > 0) {
              polModel = polQueue.shift()!;
              polAttempt = 0;
              addToast(`Alternatif model deneniyor: ${polModel}...`, "info");
            } else {
              break;
            }
          }
          /* Doğrudan çağrı 429 dışı bir hatayla döndüyse (ör. CORS politikası,
             5xx, kimlik katmanı) sunucu-proxy'ye düş — orada anahtarsız çalışır. */
          if (!res.ok && res.status !== 429) {
            res = await callViaServer();
          }
        } catch (err) {
          /* İptal edildiyse yukarı fırlat; ağ/CORS hatasıysa sunucu-proxy'ye düş. */
          if ((err as Error)?.name === "AbortError") throw err;
          res = await callViaServer();
        }
      } else {
        /* Kararlılık: akış başlamadan önce geçici hatalarda (ağ kopması veya
           5xx) otomatik yeniden dene (en çok 2 kez, üstel bekleme). İptal'e
           saygılı; 4xx/429 yeniden denenmez (kalıcı/akış altında ele alınır). */
        const backoff = (n: number) => new Promise<void>((r) => {
          const t = setTimeout(r, 1000 * 2 ** (n - 1));
          abortCtl.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
        });
        let attempt = 0;
        for (;;) {
          try {
            res = await callViaServer();
            if (!res.ok && res.status >= 500 && attempt < 2 && !abortCtl.signal.aborted) {
              attempt++;
              addToast(`Sağlayıcı hatası (${res.status}) — yeniden deneniyor (${attempt}/2)…`, "info");
              await backoff(attempt);
              if (abortCtl.signal.aborted) break;
              continue;
            }
            break;
          } catch (err) {
            if ((err as Error)?.name === "AbortError") throw err;
            if (attempt < 2 && !abortCtl.signal.aborted) {
              attempt++;
              addToast(`Bağlantı hatası — yeniden deneniyor (${attempt}/2)…`, "info");
              await backoff(attempt);
              if (abortCtl.signal.aborted) throw err;
              continue;
            }
            throw err;
          }
        }
      }

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        if (res.status === 429) {
          if (active.provider === "pollinations") {
            throw new Error(
              `⏱️ Pollinations (ücretsiz) şu an yoğun ve isteğini sınırladı [${active.model}]. ` +
              `Birkaç dakika sonra tekrar dene **ya da** kesintisiz kullanım için Ayarlar → Modeller'den ücretsiz bir anahtar ekle ` +
              `(Google Gemini günde 1.5M istek, Groq veya OpenRouter ücretsiz modeller).`,
            );
          }
          throw new Error(`⏱️ İstek limiti aşıldı [${active.provider} / ${active.model}]: 30-60 saniye bekle ve tekrar dene.`);
        }
        throw new Error(detail || `Hata ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      reveal = createReveal((visible) => useStore.getState().updateLastContent(visible));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            /* tool event */
            if (parsed.tool_event) {
              const ev = parsed.tool_event;
              if (ev.phase === "start") {
                useStore.getState().appendToolCallToLast({
                  id: ev.id, name: ev.name, arguments: ev.arguments || "{}", status: "pending",
                  startedAt: Date.now(),
                });
                fireHooks("preToolUse");
              } else if (ev.phase === "end") {
                /* Sunucu hata sonuçlarını ayrı bir alan olarak DEĞİL, kendi kabul
                   ettiği "Hata:"/"MCP hata:"/"Bilinmeyen araç:" önekli metin
                   olarak döner (bkz. api/chat/route.ts executeTool) — burada
                   aynı sözleşmeyle status'u "error" olarak işaretleriz ki
                   MessageBubble görsel olarak ayırt edebilsin. */
                const resultText = String(ev.result ?? "");
                const isError = /^(Hata:|MCP hata:|Bilinmeyen araç:)/.test(resultText);
                useStore.getState().updateToolCallOnLast(ev.id, {
                  result: ev.result, status: isError ? "error" : "done",
                  endedAt: Date.now(),
                });
                fireHooks("postToolUse");
              }
              continue;
            }
            /* generate_image sonucu — görsel AYRI bir kanaldan gelir, model
               üzerinden GEÇMEZ. Eskiden sunucu `![...](data:image/...)`
               markdown'ını araç sonucu olarak modele veriyor, model de onu
               yanıtına kopyalamaya çalışıyordu; base64 yüz binlerce token
               olduğu için yarıda kesilip sohbete ham metin olarak dökülüyordu
               (kullanıcı ekran görüntüsü, Tem 2026). Artık doğrudan son
               asistan mesajının images[] alanına iliştirilir ve MessageBubble'ın
               GeneratedImage önizlemesiyle render edilir — "/gorsel" komutunun
               kullandığı AYNI yol. */
            if (parsed.image_event?.url) {
              const url = String(parsed.image_event.url);
              useStore.getState().addImageToLast(url);
              saveGeneratedImage(url, String(parsed.image_event.prompt ?? ""));
              continue;
            }
            /* ajan plan (update_plan) olayı */
            if (parsed.plan_event) {
              useStore.getState().setPlanOnLast(String(parsed.plan_event.plan ?? ""));
              continue;
            }
            /* Otomatik fallback: ya birincil model hata verdi ve sunucu ücretsiz
               bir alternatife geçti, ya da seçili model için kullanılabilir
               anahtar hiç yoktu ("no_key") — her iki durumda da kullanıcıyı
               şeffaflık için bilgilendir. */
            if (parsed.fallback_event) {
              const fp = String(parsed.fallback_event.provider ?? "");
              const fm = String(parsed.fallback_event.model ?? "");
              if (parsed.fallback_event.reason === "no_key") {
                const rp = String(parsed.fallback_event.requestedProvider ?? "");
                addToast(`Seçili model (${rp}) için kullanılabilir bir API anahtarı bulunamadı — ücretsiz ${fp}/${fm} kullanıldı. Ayarlar → Modeller'den anahtarını kontrol et.`, "error");
              } else {
                addToast(`Aktif model yanıt vermedi; ücretsiz alternatife geçildi: ${fp} / ${fm}`, "info");
              }
              continue;
            }
            /* Ajan Ekibi (Swarm) ilerleme olayı → todo paneli canlı güncelle */
            if (parsed.swarm_event) {
              useStore.getState().setSwarmOnLast(parsed.swarm_event as import("@/lib/types").SwarmState);
              continue;
            }
            /* run_command: ajan terminalde komut çalıştırmak istiyor → terminali
               aç ve komutu gönder. Çıktı craftai:terminal-output ile geri döner. */
            if (parsed.run_command_event) {
              const command = String(parsed.run_command_event.command ?? "").trim();
              const lcfg = useStore.getState().config;
              /* Tehlikeli komut kalkanı: katastrofik kalıpları (rm -rf /, fork bomb,
                 mkfs, curl|sh…) çalıştırmadan engelle; engellenen komutu "Terminal"
                 kutusunda göster ve sonucu ajana geri besle (loop sürer, ajan daha
                 güvenli komutla devam eder). */
              const danger = command && lcfg.commandGuard !== false ? matchDangerousCommand(command) : null;
              if (danger) {
                addToast(`⛔ Güvenlik: komut engellendi (${danger})`, "error");
                useStore.getState().addCommandRun(command);
                window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command, output: `⛔ Güvenlik politikası bu komutu engelledi: ${danger}. Komut ÇALIŞTIRILMADI. Gerçekten gerekliyse kullanıcıdan açık onay iste; aksi halde daha güvenli bir komutla devam et.` } }));
              } else {
                /* Terminali ARKAPLANDA hazırla; komut arkaplanda çalışır, ilerleme
                   sohbetteki "Terminal" todo kutusunda görünür, çıktı AI'ya döner. */
                runInTerminal(String(parsed.run_command_event.command ?? ""));
              }
              continue;
            }
            /* run_code (L1 — analiz aracı): kod SUNUCUDA çalıştırılmaz; burada,
               kullanıcının tarayıcısında izole çalışır (Pyodide / DOM'suz Web
               Worker). Çıktı "Kod çalıştırma" kutusunda canlı görünür ve
               craftai:code-output ile ajana geri beslenir (run_command ile
               birebir aynı desen). */
            if (parsed.run_code_event) {
              const language = String(parsed.run_code_event.language ?? "javascript");
              const code = String(parsed.run_code_event.code ?? "");
              if (!code.trim()) continue;
              const label = `${language === "python" ? "Python" : "JavaScript"} kodu çalıştırılıyor`;
              useStore.getState().addCommandRun(label, "code");
              void (async () => {
                let res: { output: string; error?: string };
                try {
                  res = language === "python"
                    ? await (await import("@/lib/python")).runPython(code)
                    : await (await import("@/lib/jsRunner")).runJs(code);
                } catch (err) {
                  res = { output: "", error: (err as Error).message || "Çalıştırıcı başlatılamadı." };
                }
                const shown = [res.output, res.error ? `HATA: ${res.error}` : ""].filter(Boolean).join("\n") || "(çıktı yok)";
                useStore.getState().setCommandOutput(label, shown, res.error ? "error" : "done");
                window.dispatchEvent(new CustomEvent("craftai:code-output", { detail: { language, code, output: shown } }));
              })();
              continue;
            }
            /* bitiş nedeni: "length" ⇒ token sınırında kesildi → şerit + oto-devam */
            if (parsed.finish_event) {
              const reason = String(parsed.finish_event.reason ?? "");
              if (reason === "length") cutAtLength = true;
              useStore.getState().setFinishReasonOnLast(reason && reason !== "stop" ? reason : undefined);
              continue;
            }
            /* Sağlayıcının bildirdiği GERÇEK token kullanımı → tahmini ezer. */
            if (parsed.usage_event) {
              const p = Number(parsed.usage_event.prompt) || 0;
              const c = Number(parsed.usage_event.completion) || 0;
              if (p || c) realUsage = { prompt: p, completion: c };
              continue;
            }
            /* checkpoint: ajan bir dosyayı değiştirdi → eski içeriği sakla (geri al).
               previous === null ⇒ dosya bu turda oluşturuldu (geri al = sil). */
            if (parsed.checkpoint_event) {
              const { path, previous } = parsed.checkpoint_event;
              if (typeof path === "string" && (typeof previous === "string" || previous === null)) {
                setCheckpoints((prev) =>
                  prev.some((c) => c.path === path) ? prev : [...prev, { path, previous }],
                );
                if (!turnCheckpoints.some((c) => c.path === path)) {
                  turnCheckpoints.push({ path, previous });
                }
                /* Sidecar: yazılan dosyayı canlı olarak editörde aç. */
                void showWrittenFile(path);
              }
              continue;
            }
            /* toplu commit tamamlandı */
            if (parsed.batch_commit_event) {
              const ev = parsed.batch_commit_event;
              if (ev?.result?.startsWith("✅")) {
                addToast(`${ev.result}`, "success");
              }
              continue;
            }
            /* yıkıcı işlem önerisi (sil/yeniden adlandır) → onay bekler */
            if (parsed.pending_action_event) {
              const ev = parsed.pending_action_event;
              if (ev?.kind === "delete" && ev.path) {
                setPendingActions((prev) => addPendingAction(prev, { id: ev.id, kind: "delete", path: ev.path, reason: ev.reason }));
              } else if (ev?.kind === "rename" && ev.path && ev.newPath) {
                setPendingActions((prev) => addPendingAction(prev, { id: ev.id, kind: "rename", path: ev.path, newPath: ev.newPath, reason: ev.reason }));
              }
              continue;
            }
            /* ask_user anketi: ajan tıklanabilir soru sordu → kart göster, yanıt bekle. */
            if (parsed.ask_user_event?.questions) {
              setPendingSurvey(parsed.ask_user_event.questions as SurveyQuestion[]);
              continue;
            }
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            const reasoning = (parsed.choices?.[0]?.delta as Record<string, unknown>)?.reasoning as string | undefined;
            if (reasoning) { thinkingFull += reasoning; useStore.getState().updateLastThinking(thinkingFull); }
            if (delta) { full += delta; reveal.push(full); }
          } catch { /* parçalı satır */ }
        }
      }
      /* Akış bitti: animasyonun geri kalanı için kullanıcıyı bekletme, kalan
         metni tek seferde yaz. Bundan sonraki updateLastContent çağrıları
         (muhakeme ayıklama vb.) doğrudan store'a gider. */
      reveal.finish();
      if (!full) useStore.getState().updateLastContent("_(Model boş yanıt döndürdü.)_");

      /* Muhakeme sızıntısını ayır: <think>/<thinking>/<reasoning> etiketleri +
         harmony kanalları (analysis→düşünce, final→içerik) + artık kontrol
         token'ları. Yalnız temizlenmiş bir içerik kaldıysa uygula (boşa düşürme). */
      {
        const { content: cleanContent, thinking } = splitReasoning(full);
        if (cleanContent && cleanContent !== full.trim()) useStore.getState().updateLastContent(cleanContent);
        if (thinking) useStore.getState().updateLastThinking(thinkingFull ? `${thinkingFull}\n\n${thinking}` : thinking);
      }

      /* Skills kullanım sayacını artır (sadece başarılı yanıtta) */
      if (full && activeSkills.length > 0) {
        useStore.getState().incrementSkillUsage(activeSkills.map((s) => s.id));
      }

      /* AI'nın yazdığı dosyayı otomatik IDE'de aç + multi-commit bar */
      const autoFiles = extractAllFileFences(full);
      if (autoFiles.length > 0) {
        /* Tümünü sekme olarak aç (ilki aktif), birden fazla dosya yazıldıysa da
           hepsi sekme şeridinde görünsün. */
        for (const af of autoFiles) openInEditor(af);
        openInEditor(autoFiles[0]);
        /* Git & PR artık ayrı bir buton değil (Ağu 2026 kullanıcı kararı:
           "Claude'deki gibi otomatik olsun") — ajan dosya yazdığında git
           bağlamı (diff/commit/PR) kendiliğinden görünür olur, kullanıcının
           elle "aç" demesi gerekmez. Yalnız gerçek bir repo bağlıyken (yerel
           köprüde git kavramı yok). */
        if (repo) setGitPanelOpen(true);
      }
      setPendingCommit(autoFiles.length >= 2 ? autoFiles : null);

      /* Otomasyonlar (Claude Code hooks benzeri): afterResponse her yanıttan
         sonra, afterWrite yalnızca ajan dosya yazınca çalışır. Eşleşen komutlar
         sıralı (&&) tek seferde terminale gönderilir. */
      {
        const wroteFiles = autoFiles.length > 0 || turnCheckpoints.length > 0;
        const due = (store.config.automations ?? [])
          .filter((a) => a.enabled && a.command.trim())
          .filter((a) => a.event === "afterResponse" || (a.event === "afterWrite" && wroteFiles))
          .map((a) => a.command.trim());
        if (due.length > 0) runInTerminal(due.join(" && "));
      }

      /* Güvenli oto-çalıştır: yalnızca allowlist'teki komut otomatik terminale
         gönderilir (çıktı AI'ya beslenir → güvenli oto-düzelt). Diğerleri elle. */
      if (useStore.getState().config.autoRunCommands) {
        const allow = useStore.getState().config.commandAllowlist ?? DEFAULT_COMMAND_ALLOWLIST;
        const bashM = /```(?:bash|sh|shell|zsh)\n([\s\S]*?)```/.exec(full);
        const cmd = bashM?.[1]?.trim().split("\n")[0]?.trim();
        if (cmd && isCommandAllowed(cmd, allow)) {
          window.dispatchEvent(new CustomEvent("craftai:terminal-run", { detail: { command: cmd } }));
          addToast(`▶ Otomatik çalıştırıldı: ${cmd}`, "info");
        }
      }

      /* Yanıttaki HER önizlenebilir kodu (HTML/CSS/JS, React/JSX/TSX, SVG, mermaid)
         canvas'ta otomatik CANLI önizle. Önizlenemeyen kod varsa mevcut önizleme korunur. */
      const previewArtifact = buildPreview(full);
      if (previewArtifact) useStore.getState().setArtifact(previewArtifact);

      /* Token: sağlayıcı gerçek usage döndürdüyse onu kullan (kesin); yoksa
         karakter-tabanlı tahmine düş. */
      let tokenIn: number, tokenOut: number;
      if (realUsage) {
        tokenIn = realUsage.prompt;
        tokenOut = realUsage.completion;
      } else {
        /* Gerçek tokenizer (gpt-tokenizer, tembel yüklenir) ile doğru say. */
        const { countTokens } = await import("@/lib/tokenizer");
        const inputText = apiMessages.map((m) => typeof m.content === "string" ? m.content : "").join("\n");
        tokenIn = (await countTokens(inputText)) + (await countTokens(coderSystemPrompt));
        tokenOut = await countTokens(full.slice(priorLen));
      }
      useStore.getState().updateLastTokens(tokenIn, tokenOut);
      /* geri-al noktalarını mesaja yaz → persistCurrent ile sohbetle kaydedilir,
         sayfa yenilense bile son turun "Geri Al" imkânı kaybolmaz */
      if (turnCheckpoints.length) useStore.getState().setCheckpointsOnLast(turnCheckpoints);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        /* Kullanıcı durdurdu: hiç içerik gelmediyse boş asistan baloncuğunu kaldır. */
        if (!full) useStore.getState().popLastMessage();
      } else if (usedStrongest) {
        /* En güçlü model hata verdi (kredisi/anahtarı yok olabilir) → başarısız
           baloncuğu kaldır, AKTİF modele dön ve aynı turu bir kez daha dene.
           Kullanıcı hata görmez; noStrongest=true sonsuz döngüyü engeller. */
        useStore.getState().popLastMessage();
        useStore.getState().addToast("En güçlü model yanıt vermedi (kredi/anahtar?), aktif modele dönülüyor…", "info");
        await callApi(overrideAgent, { ...opts, noStrongest: true });
      } else {
        useStore.getState().updateLastContent(`**Hata:** ${friendlyError((err as Error).message)}`, { isError: true });
        void runHooks(false, "error");
      }
    } finally {
      /* Hata/abort yolunda bekleyen kare kalmasın: iptal edilen bir turun
         animasyonu, hata mesajını yazdıktan SONRA üstüne yazamamalı. */
      reveal?.cancel();
      coderAbort = null;
      useStore.getState().setStreaming(false);
      await useStore.getState().persistCurrent();
      /* Claude tarzı otomatik başlık: ilk tur bitince kısa AI başlığı üret
         (sessiz; yalnız başlık hâlâ varsayılan kırpma ise, sohbet başına 1 kez). */
      void (async () => {
        try {
          const st = useStore.getState();
          const chat = st.current();
          if (!chat || chat.incognito || chat.messages.length > 2) return;
          const firstUser = chat.messages.find((m) => m.role === "user");
          const raw = typeof firstUser?.content === "string" ? firstUser.content : "";
          const isDefault = chat.title === "Yeni sohbet" || (!!raw && chat.title === raw.slice(0, 48));
          if (!isDefault) return;
          const last = chat.messages[chat.messages.length - 1];
          const { quickComplete } = await import("@/lib/quickComplete");
          const { sanitizeAiTitle } = await import("@/lib/chatTitle");
          /* Aday, gerçekten başlık gibi görünmüyorsa (cevaba başlayan "Tabii,
             işte…:" cümlesi, 7+ kelime, vb.) null döner ve kullanıcı metninden
             gelen mevcut başlık KORUNUR. Eski kod ≤60 karakter olan her ilk
             satırı kabul ediyor, zayıf modellerde sohbet listesini "Tabii," ile
             dolduruyordu — bkz. lib/chatTitle.ts ve testi. */
          const t = sanitizeAiTitle(await quickComplete(
            `Konuşma:\nKullanıcı: ${raw.slice(0, 500)}\nAsistan: ${String(last?.content ?? "").slice(0, 500)}`,
            "Bu konuşma için 3-5 kelimelik, kısa ve net bir Türkçe başlık üret. SADECE başlığı döndür — tırnak, nokta, açıklama yok.",
          ));
          if (t) st.renameChat(chat.id, t);
        } catch { /* sessiz — mevcut başlık kalır */ }
      })();
      if (useStore.getState().config.soundEnabled) {
        const { playReady, notifyReady } = await import("@/lib/sounds");
        playReady();
        notifyReady("UMAI", "Yanıt hazır.");
      }
      void extractMemory();
      fireHooks("onStop");
    }
    /* Otomatik devam (Claude Code gibi): yanıt token sınırında kesildiyse aynı
       baloncuk içinden kendiliğinden sürdür — kullanıcı tıklamasına gerek yok.
       Sonsuz döngüye karşı en çok 8 ardışık otomatik devam. */
    const depth = opts?.depth ?? 0;
    if (cutAtLength && useStore.getState().config.autoContinue !== false && depth < 8 && !abortCtl.signal.aborted) {
      useStore.getState().addToast("Yanıt sınırda kesildi — kaldığı yerden devam ediliyor…", "info");
      await callApi(overrideAgent, { continuation: true, depth: depth + 1 });
    } else if (!abortCtl.signal.aborted) {
      /* Tur tamamlandı (sınırda kesilmedi) → olay kancalarını çalıştır. */
      await runHooks(turnCheckpoints.length > 0);
      await runAutoVerify(turnCheckpoints.length > 0);
    }
  /* callApi reads the rest of its inputs live via useStore.getState() during
     streaming, so it deliberately keeps a minimal dep set — recreating it on
     every config change would break in-flight requests. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.systemPrompt, extractMemory, runHooks, runAutoVerify]);

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0 && attachedFiles.length === 0) || streaming) return;
    const store = useStore.getState();

    /* "/gorsel <brief>" — LLM'e / model seçimine hiç İHTİYAÇ DUYMADAN ANINDA
       görsel üretimi (Pollinations, ücretsiz/anahtarsız) — bu yüzden aşağıdaki
       "aktif model var mı" kapısından ÖNCE ele alınır. Eski Stüdyo > Görüntü
       yüzeyinin yerini alır — aynı üretim artık doğrudan genel sohbette. */
    const imgDetected = findAgentByCommand(text);
    const imgAgent = imgDetected ?? activeAgent;
    const imgPromptText = imgDetected ? stripCommand(text) : text;
    if (imgAgent?.id === "image-gen" && imgPromptText.trim()) {
      if (!store.currentId) store.newChat(incognito);
      const imgPrompt = imgPromptText.trim();
      setInput("");
      setActiveAgent(null);
      store.pushMessage({ role: "user", content: imgPrompt });
      const seed = Math.floor(Math.random() * 1_000_000);

      /* BYOK: kullanıcının anahtarı olan görüntü-yetenekli sağlayıcı varsa
         (Gemini/OpenAI/xAI/HF, /api/image proxy'siyle) onunla üret; anahtar
         yoksa VEYA üretim başarısız olursa Pollinations tabanına düş —
         metindeki fallback zinciriyle aynı "istek asla düşmez" sözleşmesi. */
      const { pickImageProvider, generateImageBYOK, compressDataUrl, IMAGE_PROVIDER_LABEL, buildImageFallbackChain } = await import("@/lib/imageGen");
      let url = "";
      let providerNote = "";
      const byok = await pickImageProvider(store.config).catch(() => null);
      /* Ayarlar'daki "görsel yedek zinciri" açıksa tek adayla yetinmeyip
         eklediğin diğer görüntü-yetenekli modelleri de (en iyiden en kötüye)
         sırayla dener; kapalıyken (varsayılan) davranış değişmez — yalnız
         pickImageProvider'ın seçtiği TEK aday denenir. */
      const attempts = byok ? [byok] : [];
      if (store.config.imageFallbackChain) {
        const rest = await buildImageFallbackChain(store.config, byok?.provider).catch(() => []);
        attempts.push(...rest);
      }
      for (const attempt of attempts) {
        const label = IMAGE_PROVIDER_LABEL[attempt.provider];
        store.pushMessage({ role: "assistant", content: `🎨 ${label} ile üretiliyor…` });
        try {
          const raw = await generateImageBYOK(imgPrompt, attempt.provider, attempt.apiKey, undefined, attempt.model);
          url = await compressDataUrl(raw);
          providerNote = ` _(${label})_`;
          useStore.getState().popLastMessage(); // "üretiliyor…" yer tutucusu
          break;
        } catch (e) {
          useStore.getState().popLastMessage();
          const isLast = attempt === attempts[attempts.length - 1];
          addToast(`${label} üretimi başarısız (${friendlyError((e as Error).message)})${isLast ? " — Pollinations'a düşüldü." : " — sıradaki deneniyor…"}`, "info");
        }
      }
      if (!url) url = pollinationsImageUrl(imgPrompt, { seed });

      store.pushMessage({
        role: "assistant",
        content: `**"${imgPrompt}"** için oluşturdum:${providerNote}`,
        images: [url],
      });
      /* Kütüphane kaydı — kota kuralı addMediaAsset'te tek yerde (imageGen.ts);
         generate_image aracı da AYNI yardımcıyı kullanır. */
      saveGeneratedImage(url, imgPrompt, seed);
      void store.persistCurrent();
      return;
    }

    /* Skill kaydetme — LLM'e HİÇ gitmez, bu yüzden "önce model seç" kapısının
       ÜSTÜNDE (Ö4): model eklememiş bir kullanıcı da skill indirebilmeli,
       eskiden Ayarlar açılıp komut sessizce düşüyordu. Artık URL cümlenin
       içinde olabilir ve "bunu skill olarak kaydet" de anlaşılır
       (parseSkillIntent — saf, testli). */
    const skillIntent = parseSkillIntent(text);
    if (skillIntent) {
      if (!store.currentId) store.newChat(incognito);
      setInput("");
      store.pushMessage({ role: "user", content: text });
      if (skillIntent.kind === "import") {
        try {
          const { title, chars } = await importSkillFromUrl(skillIntent.url);
          store.pushMessage({
            role: "assistant",
            content: `✓ **"${title}"** skill'i eklendi (${chars.toLocaleString("tr-TR")} karakter).\n\nBundan sonra her yeni sohbette otomatik geçerli — Skills panelinden yönetebilirsin.`,
          });
        } catch (e) {
          store.pushMessage({
            role: "assistant",
            content: `✗ Skill indirilemedi: ${friendlyError((e as Error).message)}\n\nİpucu: GitHub'da dosyanın **Raw** linkini kullan.`,
          });
        }
      } else {
        /* "bunu skill olarak kaydet" → son asistan yanıtı. Kırpma YOK:
           eskiden mini-form içeriği 4000 karakterde kesiyordu, uzun bir
           workflow yarım kaydediliyordu. */
        const last = [...(store.current()?.messages ?? [])].reverse().find((m) => m.role === "assistant" && m.content.trim());
        if (!last) {
          store.pushMessage({ role: "assistant", content: "Kaydedilecek bir önceki yanıt bulamadım. Önce bir cevap üretmemi iste, sonra \"bunu skill olarak kaydet\" de." });
        } else {
          const skill = skillFromText(last.content, "sohbet", ["sohbet"]);
          store.addSkill(skill);
          store.pushMessage({
            role: "assistant",
            content: `✓ **"${skill.title}"** skill olarak kaydedildi (${skill.content.length.toLocaleString("tr-TR")} karakter).\n\nSkills panelinden düzenleyebilir, kapatabilirsin.`,
          });
        }
      }
      void store.persistCurrent();
      return;
    }

    if (!store.activeModel()) { store.setSettingsOpen(true); return; }
    if (!store.currentId) store.newChat(incognito);

    /* Karşılaştırma modu: normal tool-loop/akış yerine aynı mesajı 2-3
       modelle PARALEL çalıştırır (Fusion'ın pickDraftModels/fillSelfConsistency
       sezgisiyle AYNI model seçimi), sonuçları MessageBubble'da yan yana
       gösterir — kullanıcı hangisini tutacağını seçer (pickCompareResult).
       v1 kapsamı: yalnız metin (ekler/araçlar bu modda desteklenmez). */
    if (compareMode && text.trim()) {
      setInput("");
      store.pushMessage({ role: "user", content: text });
      store.pushMessage({ role: "assistant", content: "" });
      store.setStreaming(true);
      try {
        const active = store.activeModel()!;
        const freeModelNames = await fetchTextModels();
        const picks = pickDraftModels(store.config.models, active, 3, store.strongestModel(), freeModelNames);
        const slots = fillSelfConsistency(picks, active, 3);
        const candidates = await Promise.all(slots.map(async (s) => ({
          label: s.profile.id.includes("#sc") ? `${s.profile.label} (T${s.temperature})` : s.profile.label,
          baseUrl: s.profile.baseUrl, model: s.profile.model, provider: s.profile.provider,
          apiKey: await usableApiKey(s.profile),
        })));
        const results = await runCompare({ userText: text, candidates });
        useStore.getState().popLastMessage();
        useStore.getState().pushMessage({ role: "assistant", content: "", compareResults: results });
      } catch (e) {
        useStore.getState().popLastMessage();
        useStore.getState().pushMessage({
          role: "assistant",
          content: `Karşılaştırma başarısız: ${friendlyError((e as Error).message)}`,
          isError: true,
        });
      } finally {
        useStore.getState().setStreaming(false);
        void useStore.getState().persistCurrent();
      }
      return;
    }
    setPendingCommit(null);
    hookRunsRef.current = 0; // yeni kullanıcı mesajı → afterEdit döngü sayacını sıfırla
    verifyRunsRef.current = 0; // otonom doğrulama tur sayacını da sıfırla
    if (store.config.soundEnabled) import("@/lib/sounds").then((m) => m.playSend());
    trackEvent("chat_message_sent");

    /* slash command algıla */
    const detected = findAgentByCommand(text);
    const agent = detected ?? activeAgent;
    const userText = detected ? stripCommand(text) : text;

    /* Dosya ekleri (DeepSeek dosya yükleme davranışı): içerik NET çerçeveyle
       mesaja gömülür — model bunun kullanıcının YÜKLEDİĞİ dosya olduğunu,
       repoda aramaması gerektiğini ve yanıtı bu içeriğe dayandıracağını bilir. */
    const FILE_CHAR_CAP = 24000;
    let fullText = userText;
    if (attachedFiles.length > 0) {
      const ctx = attachedFiles
        .map((f) => {
          const cut = f.content.length > FILE_CHAR_CAP;
          return `### 📎 ${f.path}\n\`\`\`${getExt(f.path)}\n${f.content.slice(0, FILE_CHAR_CAP)}${cut ? `\n… (dosya uzun — ilk ${FILE_CHAR_CAP.toLocaleString("tr-TR")} karakter gösteriliyor)` : ""}\n\`\`\``;
        })
        .join("\n\n");
      fullText =
        `[EKLİ DOSYALAR — kullanıcı bu dosyaları sohbete yükledi. İçerikleri TAM olarak aşağıda; ` +
        `bunlar repoda DEĞİL, araçlarla arama/okuma YAPMA. Yanıtını doğrudan bu içeriğe dayandır.]\n\n${ctx}\n\n` +
        `[KULLANICININ MESAJI]\n${userText || "Ekli dosyaları incele ve kısaca özetle."}`;
    } else if (!userText && pendingImages.length > 0) {
      /* Yalnız görsel gönderimi: boş metin bazı sağlayıcılarda reddedilir;
         ayrıca modele net bir görev verir. */
      fullText = "Ekteki görseli incele ve açıkla.";
    }

    store.pushMessage({
      role: "user",
      content: fullText,
      images: pendingImages.length ? [...pendingImages] : undefined,
      agentId: agent?.id,
    });
    store.maybeSetTitle(userText || attachedFiles[0]?.path || agent?.label || "Kod analizi");
    /* Erken kayıt: soru, akış tamamlanmadan da kalıcı olsun — sekme dondurulup
       yeniden yüklense bile kaybolmaz. */
    void store.persistCurrent();
    setInput("");
    setPendingImages([]);
    setAttachedFiles([]);
    setActiveAgent(null);
    await callApi(agent);
  };

  const stop = () => { coderAbort?.abort(); coderAbort = null; };

  /* modelId verilirse bu tur O modelle üretilir (N2) — verilmezse eskisi gibi
     aktif model kullanılır. */
  const regenerate = async (modelId?: string) => {
    if (streaming) return;
    const store = useStore.getState();
    const chat = store.current();
    if (!chat || chat.messages.length < 2) return;
    /* Eski yanıt artık kaybolmuyor: yeniden üretmeden önce (varsa kendi dal
       geçmişiyle) bekleyen dal listesine alınır; yeni yanıt tamamlanınca bu
       liste son mesaja işlenir — MessageBubble'daki "‹ n/m ›" sürüm okları
       kullanıcı mesajı düzenlemesinde olduğu gibi asistan yanıtında da çalışır. */
    let pendingBranches: ChatMessage[][] | null = null;
    /* Konumsal "son mesaj" DEĞİL: akış sırasında araya gizli bir bağlam
       mesajı (terminal/kod çıktısı, role:"user") girmişse `last.role` asistan
       olmuyordu → dal saklanmadan ve pop edilmeden devam ediliyor, ardından
       akış mevcut asistan yanıtının ÜZERİNE yazıyordu: eski cevap sürüm
       geçmişine alınmadan kayboluyordu (‹1/2› okları hiç çıkmıyordu).
       popLastMessage zaten son ASİSTANI siliyor; hedef seçimi de onunla
       aynı kuralı kullanmalı. */
    const li = lastAssistantIndex(chat.messages);
    if (li >= 0) {
      pendingBranches = stashAsPendingBranches(chat.messages[li]);
      store.popLastMessage();
    }
    await callApi(undefined, modelId ? { modelId } : undefined);
    if (pendingBranches) useStore.getState().mergeRegenerateBranches(pendingBranches);
  };

  /* Keep the previous answer; ask the model to pick up where it left off.
     Useful when the stream was stopped, hit a token cap, or got truncated. */
  /* Devam et (Claude Code tarzı): sohbete görünür mesaj eklemeden, kesilen
     asistan yanıtını AYNI baloncuğun içinden sürdürür. */
  const continueLast = async () => {
    if (streaming) return;
    const store = useStore.getState();
    const chat = store.current();
    const last = chat?.messages[chat.messages.length - 1];
    if (!chat || !last || last.role !== "assistant" || !last.content) return;
    await callApi(undefined, { continuation: true });
  };

  const editAndResend = async (index: number, content: string) => {
    /* Non-destructive: eski sürümü dal olarak korur, yeni dalı açıp regenere eder. */
    useStore.getState().editMessageBranch(index, content);
    await callApi();
  };

  const allFiles = useMemo(() => (tree ? getAllFiles(tree) : []), [tree]);
  /* Hassas veri uyarısı — yazılan istemde API anahtarı/kredi kartı/IBAN olursa. */
  const sensitiveHits = useMemo(() => detectSensitive(input), [input]);
  /* Bütçe uyarısı — Ayarlar → Kullanım'da belirlenen aylık USD bütçesine göre. */
  const budgetStatus = useMemo(
    () => calcBudgetStatus(chats, config.models.find((m) => m.id === config.activeModelId)?.model, config.monthlyBudgetUsd),
    [chats, config.models, config.activeModelId, config.monthlyBudgetUsd],
  );
  const filteredFiles = useMemo(
    () => fuzzyFiles(allFiles, repoSearch),
    [allFiles, repoSearch],
  );
  const attachedPaths = attachedFiles.map((f) => f.path);

  return (
    <div
      className="relative flex flex-col h-full min-h-0 bg-bg"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        /* only fire when the cursor actually leaves the outer container */
        if (e.target === e.currentTarget) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        for (const f of Array.from(e.dataTransfer.files)) readFileIntoInput(f);
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 z-40 rounded-2xl border-2 border-dashed border-brand/60 bg-brand/5 grid place-items-center backdrop-blur-sm animate-in fade-in duration-150">
          <div className="text-center px-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand/15 grid place-items-center text-brand text-2xl shadow-lg shadow-brand/10">
              ↓
            </div>
            <p className="text-sm font-extrabold text-ink">Dosyaları buraya bırak</p>
            <p className="text-xs text-muted/60 mt-1">PDF · görsel · kod · metin · notebook — çoklu dosya</p>
          </div>
        </div>
      )}
      {/* Header — Claude tarzı 2 bölge: sol (sidebar+marka) · sağ (rozetler +
         tek ⋯ menü). Model seçici artık burada değil — composer'ın alt
         satırında (bkz. "Alt durum çubuğu"), Claude'daki gibi giriş
         alanının parçası. Az kullanılan eylemler (Editör/Skills) ⋯
         menüsünün "Hızlı eylemler" bölümüne taşındı — normal (görünür)
         sohbet için tek giriş noktası artık yalnız Sidebar. "Gizli sohbet"
         bunun istisnası: farklı bir yetenek (incognito) sunduğundan,
         Sidebar'da hiç karşılığı olmayan ⋯ menüsündeki tek yolu kalıyor
         (Ctrl/Cmd+Shift+N kısayolu da var, bkz. app/page.tsx). */}
      <div
        className="brand-rule shrink-0 flex items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-3 bg-surface/60 backdrop-blur-sm overflow-x-auto scrollbar-none"
        style={{ height: "calc(3rem + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            title={`Yan panel (${mod}+B)`}
            className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors shrink-0"
          >
            <PanelLeft size={16} />
          </button>

          {/* Marka rozeti yalnız masaüstünde: mobilde zaten uygulama içindesin. */}
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-brand/15 border border-brand/25 grid place-items-center shrink-0">
              <Code2 size={13} className="text-brand" />
            </div>
            <span className="text-sm font-semibold text-ink shrink-0">UMAI</span>
            {repo && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-bgsoft border border-line/60 text-muted/70 font-mono truncate">
                {repo.owner}/{repo.repo}
                <span className="text-muted/40">:</span>
                <span className="text-brand/80">{repo.branch}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 min-w-0 shrink-0">
          {/* Token + maliyet — masaüstünde görünür (ayrıntı Ayarlar → Kullanım'da).
              Gösterilecek token yoksa UsageBadge'in KENDİSİ null döner (bkz.
              nothingToShow) — burada ayrıca mesaj sayısına bakmıyoruz ki koşul
              tek kaynakta kalsın. */}
          {config.models.length > 0 && (
            <div className="hidden sm:block shrink-0">
              <UsageBadge
                chat={current ?? {}}
                pendingTokens={
                  estimateTokens(input) + attachedFiles.reduce((a, f) => a + estimateTokens(f.content), 0)
                }
              />
            </div>
          )}
          {incognito && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/30 shrink-0">
              <VenetianMask size={9} /> Gizli
            </span>
          )}
          {/* Ajan modu — Claude Code'daki Normal/Auto-accept/Plan üçlüsüne
             paralel, her zaman görünür (yalnızca araçlar açıkken anlamlı). */}
          {toolsEnabled && <AgentModeButton />}
          {/* Efor seçici — Ağu 2026 kullanıcı kararı: ⋯ menüsünden çıkıp
             AgentModeButton'la aynı stilde her zaman görünen kendi pill'i
             oldu (tek tık, sekmesiz). */}
          <EffortHeaderButton />
          {/* Terminal — yalnız admin (Ağu 2026 kullanıcı kararı). Git & PR
             BİLEREK burada yok: artık Claude Code'daki gibi otomatik —
             ajan bir dosya yazdığında git bağlamı (bkz. aşağıdaki
             `setGitPanelOpen(true)` çağrısı, "AI'nın yazdığı dosyayı..."
             bloğunda) kendiliğinden açılıyor, elle "aç" denecek bir buton
             yok. Dosyalar/Sunucu (workspace) burada değil ama artık
             ERİŞİLEBİLİR: Sidebar → "Araçlar" menüsünden açılıyorlar
             (Ö8, Tem 2026 kullanıcı isteği). Durum store'da (leftPanel). */}
          {isAdmin && (
            <button
              onClick={() => { setTerminalMounted(true); setTerminalOpen((v) => !v); }}
              title={terminalOpen ? "Terminal'i kapat" : `Terminal${terminalSupported ? "" : " (masaüstü Chrome/Edge gerekir)"}`}
              className={`w-8 h-8 rounded-lg grid place-items-center transition-colors shrink-0 ${
                terminalOpen ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"
              }`}
            >
              <Terminal size={15} />
            </button>
          )}
          {/* Gizli sohbet — Ağu 2026 kullanıcı kararı: ⋯ menüsü tamamen
             kalktığı için kendi ikonu oldu (herkese açık). Tools/Güvenli/
             Karşılaştır de kalktı: Tools zaten repo bağlanınca kendiliğinden
             açılıyordu (bkz. store.ts setRepo — "Claude Code tarzı otomatik
             aç"; elle kapatma/açma artık Ayarlar → Genel'de), Güvenli zaten
             yalnız Ayarlar'da yaşıyordu (bkz. önceki commit). Karşılaştır'ın
             (compareMode) otomatikleştirilebilecek bir metin sinyali yok —
             ⋯ ile birlikte tetikleyicisi kaldırıldı, state/mantık (send()
             içindeki compareMode dalı) dokunulmadan duruyor. */}
          <button
            onClick={() => useStore.getState().newChat(true)}
            title="Gizli sohbet başlat"
            className="w-8 h-8 rounded-lg grid place-items-center text-muted hover:text-ink hover:bg-bgsoft transition-colors shrink-0"
          >
            <VenetianMask size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">

        {/* Files panel (left) — mobilde içeriği ezmesin diye overlay */}
        {filesOpen && (
          <div className="absolute sm:relative inset-y-0 left-0 z-30 w-64 sm:w-56 max-w-[85%] shrink-0 flex flex-col border-r border-line/60 bg-surface sm:bg-surface/40 shadow-2xl sm:shadow-none overflow-hidden">
            <div className="px-3 py-2 border-b border-line/40 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted/50">
                {repo ? `${repo.owner}/${repo.repo}` : "Dosyalar"}
              </span>
              <div className="flex items-center gap-1">
                {repo && tree && (
                  <button
                    onClick={async () => {
                      setLoadingAll(true);
                      try {
                        const store = useStore.getState();
                        const activeRepo = store.config.activeRepo || "";
                        const treeItems = store.tree ? getTreeItems(store.tree) : [];
                        let allItems: { path: string; content: string }[] = [];
                        const prov = resolveRepoProvider(store.repo, activeRepo);
                        const token = await store.tokenForRepo(activeRepo, prov);
                        allItems = prov === "gitlab"
                          ? await fetchAllGitLabFiles(repo.owner, repo.repo, repo.branch, treeItems, token)
                          : await fetchAllFiles(repo.owner, repo.repo, repo.branch, treeItems, token);
                        if (allItems.length > 0) {
                          setAttachedFiles(allItems.map(f => ({ path: f.path, content: f.content })));
                          addToast(`${allItems.length} dosya yüklendi`, "success");
                        }
                      } catch { addToast("Yükleme başarısız", "error"); }
                      finally { setLoadingAll(false); }
                    }}
                    disabled={loadingAll}
                    title="Tüm dosyaları bağlama ekle (max 50)"
                    className="text-muted/40 hover:text-brand transition-colors disabled:opacity-30"
                  >
                    <ArrowDown size={10} className={loadingAll ? "animate-bounce" : ""} />
                  </button>
                )}
                {repo && (
                  <button onClick={() => connectRepo()} disabled={connecting} title="Yenile" className="text-muted/40 hover:text-brand transition-colors">
                    <RefreshCw size={10} className={connecting ? "animate-spin" : ""} />
                  </button>
                )}
                {/* Alan paneli — tek tık sekme: her iki kaynak da varsa panelı
                   kapatıp menüden tekrar açmaya gerek kalmadan diğerine geç. */}
                {localActive && (
                  <button
                    onClick={() => { setLeftPanel(switchLeftPanel("workspace")); if (!wsTree && !wsLoading) loadWorkspace(); }}
                    title="Sunucu (workspace)'a geç"
                    className="text-muted/40 hover:text-brand transition-colors"
                  >
                    <Server size={10} />
                  </button>
                )}
                <button onClick={() => setLeftPanel(null)} className="text-muted/40 hover:text-muted transition-colors">
                  <X size={11} />
                </button>
              </div>
            </div>

            {tree && (
              <div className="px-2 py-1.5 border-b border-line/40 shrink-0">
                <div className="relative flex items-center gap-1">
                  <div className="relative flex-1">
                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/40" />
                    <input
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      onKeyDown={(e) => { if (semanticMode && e.key === "Enter") runSemanticSearch(repoSearch); }}
                      placeholder={semanticMode ? "Anlamca ara, Enter…" : "Bulanık ara…"}
                      className="w-full bg-bgsoft/60 rounded-lg pl-6 pr-2 py-1.5 text-[11px] outline-none focus:ring-1 ring-brand/30 placeholder:text-muted/30"
                    />
                  </div>
                  <button
                    onClick={() => { setSemanticMode((v) => !v); setRagHits([]); }}
                    title={semanticMode ? "Anlamsal arama açık (kelime aramasına dön)" : "Anlamsal arama (AI gömme)"}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${semanticMode ? "bg-brand/15 text-brand" : "text-muted/50 hover:text-ink hover:bg-bgsoft/60"}`}
                  >
                    <Sparkles size={12} />
                  </button>
                </div>
                {semanticMode && ragProgress && (
                  <div className="mt-1.5 px-0.5">
                    <div className="flex items-center justify-between text-[9px] text-muted/50 mb-0.5">
                      <span>İndeksleniyor…</span>
                      <span className="tabular-nums">{ragProgress.done}/{ragProgress.total}</span>
                    </div>
                    <div className="h-1 rounded-full bg-bgsoft overflow-hidden">
                      <div className="h-full bg-brand transition-all" style={{ width: `${ragProgress.total ? (ragProgress.done / ragProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {!tree && connecting ? (
                /* Profesyonel iskelet: ağaç yüklenirken titreşimli satırlar. */
                <div className="stagger px-2 py-1.5 space-y-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12 + 4}px`, "--i": i } as React.CSSProperties}>
                      <div className="w-3 h-3 rounded shimmer shrink-0" />
                      <div className="h-3 rounded shimmer" style={{ width: `${45 + ((i * 7) % 40)}%` }} />
                    </div>
                  ))}
                </div>
              ) : !tree ? (
                <div className="px-3 py-6 text-center">
                  <FolderGit2 size={22} className="mx-auto mb-2 text-muted/20" />
                  <p className="text-[10px] text-muted/40 leading-relaxed mb-2">
                    {config.activeRepo ? config.activeRepo : "Depo seç veya ekle"}
                  </p>
                  {!connecting && (
                    <div className="flex flex-col gap-1.5 items-center">
                      {config.activeRepo ? (
                        <button onClick={() => connectRepo()} className="text-[10px] px-3 py-1.5 rounded-lg bg-brand text-[#111110] font-semibold hover:bg-branddim transition-colors flex items-center gap-1">
                          <FolderGit2 size={10} /> Bağlan
                        </button>
                      ) : null}
                      <button onClick={() => setSettingsOpen(true)} className="text-[10px] px-2 py-1 rounded-lg bg-brand/10 border border-brand/25 text-brand font-medium hover:bg-brand/20 transition-colors">
                        Ayarlar
                      </button>
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t border-line/30">
                    <button onClick={() => fileRef.current?.click()} className="text-[10px] text-muted/60 hover:text-ink transition-colors flex items-center gap-1 mx-auto">
                      <Paperclip size={10} /> Yerel dosya yükle
                    </button>
                  </div>
                </div>
              ) : semanticMode ? (
                <div className="py-1">
                  {ragBusy && !ragProgress ? (
                    <div className="px-3 py-4 text-center text-[10px] text-muted/50 flex items-center justify-center gap-1.5">
                      <RefreshCw size={11} className="animate-spin text-brand" /> Anlamca aranıyor…
                    </div>
                  ) : ragHits.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[10px] text-muted/40 leading-relaxed">
                      <Sparkles size={18} className="mx-auto mb-2 text-muted/20" />
                      Anlamsal arama: ne aradığını <em>doğal dille</em> yaz, Enter&apos;a bas.
                      <br />İlk aramada depo indekslenir (model indirilir).
                    </div>
                  ) : (
                    ragHits.map((h, i) => {
                      const isAttached = attachedPaths.includes(h.path);
                      return (
                        <button
                          key={`${h.path}-${h.line}-${i}`}
                          onClick={() => { const f = getAllFiles(tree).find((x) => x.path === h.path); if (f) attachRepoFile(f); }}
                          className={`w-full flex flex-col gap-0.5 px-3 py-1.5 text-left rounded transition-colors ${isAttached ? "bg-brand/10" : "hover:bg-bgsoft/50"}`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {fetchingFile === h.path ? <RefreshCw size={10} className="animate-spin shrink-0 text-brand" /> : <FileIcon name={h.path.split("/").pop() || h.path} size={10} />}
                            <span className="truncate flex-1 text-muted/90">{h.path}</span>
                            <span className="text-[8px] text-muted/40">:{h.line}</span>
                            <span className="text-[8px] font-mono text-brand/60 tabular-nums shrink-0">{(h.score * 100).toFixed(0)}%</span>
                          </div>
                          <div className="text-[9px] text-muted/40 font-mono truncate pl-4">{h.text.trim().slice(0, 80)}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : repoSearch ? (
                <div className="py-1">
                  {filteredFiles.slice(0, 50).map((f) => {
                    const isAttached = attachedPaths.includes(f.path);
                    return (
                      <button
                        key={f.path}
                        onClick={() => attachRepoFile(f)}
                        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-left rounded transition-colors ${
                          isAttached ? "bg-brand/10 text-brand" : "text-muted/80 hover:text-ink hover:bg-bgsoft/50"
                        }`}
                      >
                        {fetchingFile === f.path ? <RefreshCw size={10} className="animate-spin shrink-0 text-brand" /> : <FileIcon name={f.name} size={10} />}
                        <span className="truncate flex-1">{f.path}</span>
                        {isAttached && <span className="text-[9px] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <FileTreeNode
                  node={tree}
                  onSelect={attachRepoFile}
                  attached={attachedPaths}
                  onContextMenu={(f, e) => setTreeMenu({ x: e.clientX, y: e.clientY, file: f })}
                />
              )}
            </div>

            <div className="px-2 py-2 border-t border-line/40 shrink-0">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-line/60 hover:border-brand/40 text-[11px] text-muted hover:text-ink transition-colors"
              >
                <Paperclip size={11} /> Dosya ekle
              </button>
            </div>
          </div>
        )}

        {/* Sunucu (Hibrit köprü) workspace gezgini — ajanların çalıştığı gerçek dizin.
            Repo panelinden bağımsız; yalnız localMode'da açılır. */}
        {wsOpen && (
          <div className="absolute sm:relative inset-y-0 left-0 z-30 w-64 sm:w-56 max-w-[85%] shrink-0 flex flex-col border-r border-line/60 bg-surface sm:bg-surface/40 shadow-2xl sm:shadow-none overflow-hidden">
            <div className="px-3 py-2 border-b border-line/40 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted/50 flex items-center gap-1.5">
                <Server size={11} className="text-brand/70" /> Sunucu • workspace
              </span>
              <div className="flex items-center gap-1">
                <button onClick={loadWorkspace} disabled={wsLoading} title="Yenile" className="text-muted/40 hover:text-brand transition-colors disabled:opacity-30">
                  <RefreshCw size={10} className={wsLoading ? "animate-spin" : ""} />
                </button>
                {repo && (
                  <button
                    onClick={() => setLeftPanel(switchLeftPanel("files"))}
                    title="Dosyalar (depo)'a geç"
                    className="text-muted/40 hover:text-brand transition-colors"
                  >
                    <FolderOpen size={10} />
                  </button>
                )}
                <button onClick={() => setLeftPanel(null)} className="text-muted/40 hover:text-muted transition-colors">
                  <X size={11} />
                </button>
              </div>
            </div>

            {wsTree && wsPaths.length > 0 && (
              <div className="px-2 py-1.5 border-b border-line/40 shrink-0">
                <div className="relative">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input
                    value={wsSearch}
                    onChange={(e) => setWsSearch(e.target.value)}
                    placeholder="Workspace'te ara…"
                    className="w-full bg-bgsoft/60 rounded-lg pl-6 pr-2 py-1.5 text-[11px] outline-none focus:ring-1 ring-brand/30 placeholder:text-muted/30"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-1.5">
              {wsLoading ? (
                <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted/60">
                  <Loader2Icon size={12} className="animate-spin" /> Yükleniyor…
                </div>
              ) : !wsTree ? (
                <div className="px-2 py-3 text-[11px] text-muted/50">
                  Workspace&apos;i yüklemek için{" "}
                  <button onClick={loadWorkspace} className="text-brand hover:underline">tıkla</button>.
                </div>
              ) : wsPaths.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-muted/50">Workspace boş.</div>
              ) : wsSearch ? (
                <div className="py-1">
                  {wsPaths
                    .filter((p) => p.toLowerCase().includes(wsSearch.toLowerCase()))
                    .slice(0, 100)
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => openWorkspaceFile({ name: p.split("/").pop() || p, path: p })}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-left rounded transition-colors text-muted/80 hover:text-ink hover:bg-bgsoft/50"
                      >
                        {wsFetching === p
                          ? <RefreshCw size={10} className="animate-spin shrink-0 text-brand" />
                          : <FileIcon name={p.split("/").pop() || p} size={10} />}
                        <span className="truncate flex-1">{p}</span>
                      </button>
                    ))}
                </div>
              ) : (
                <FileTreeNode node={wsTree} onSelect={openWorkspaceFile} attached={[]} onContextMenu={openWsMenu} />
              )}
            </div>

            {/* Sağ tık menüsü — sil / skill / snippet. Repo panelindeki sağ tık
                deseniyle aynı (onContextMenu prop'u FileTreeNode'da zaten var). */}
            {wsMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWsMenu(null)} onContextMenu={(e) => { e.preventDefault(); setWsMenu(null); }} />
                <div
                  className="fixed z-50 min-w-44 rounded-xl border border-line bg-surface elev-2 overflow-hidden text-[11px]"
                  style={{ left: wsMenu.x, top: wsMenu.y }}
                >
                  <div className="px-3 py-1.5 text-[10px] text-muted/50 truncate border-b border-line/40">{wsMenu.path}</div>
                  <button onClick={() => { const p = wsMenu.path; setWsMenu(null); void wsSaveAs(p, "skill"); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bgsoft/70 text-left text-ink/85 transition-colors">
                    <BookMarked size={12} /> Skill olarak kaydet
                  </button>
                  <button onClick={() => { const p = wsMenu.path; setWsMenu(null); void wsSaveAs(p, "snippet"); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bgsoft/70 text-left text-ink/85 transition-colors">
                    <BookOpen size={12} /> Snippet olarak kaydet
                  </button>
                  <button onClick={() => { const p = wsMenu.path; setWsMenu(null); void wsDeleteFile(p); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red/10 text-left text-red transition-colors border-t border-line/40">
                    <Trash2 size={12} /> Sunucudan sil
                  </button>
                </div>
              </>
            )}

            {/* Yükleme: metin dosyaları (köprünün /fs/write ucu UTF-8 metin yazar). */}
            <input
              ref={wsUploadRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { void wsUploadFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
            />

            {/* Ö10 — kaynak ŞEFFAFLIĞI: bu panel Hibrit Köprü'nün workspace
                KÖKÜNÜ listeler. Terminalden indirilen bir dosya, terminal
                sunucusunun çalışma dizini bu kökle aynı değilse burada
                GÖRÜNMEZ; kullanıcı boşuna aramasın diye açıkça yazılıyor. */}
            <div className="px-3 py-1.5 border-t border-line/40 shrink-0 text-[9px] leading-snug text-muted/40">
              Kaynak: Hibrit Sunucu workspace kökü. Terminalden indirdiğin dosya
              burada yoksa terminalin çalışma dizini bu kökten farklıdır.
            </div>

            <div className="px-3 py-2 border-t border-line/40 shrink-0 text-[10px] text-muted/40 flex items-center justify-between gap-2">
              <span>{wsPaths.length > 0 ? `${wsPaths.length} dosya` : "—"}</span>
              <button onClick={wsUpload} className="text-muted/60 hover:text-brand transition-colors flex items-center gap-1" title="Sunucuya dosya yükle">
                <ArrowUp size={9} /> Yükle
              </button>
            </div>
          </div>
        )}

        {/* Main: chat */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

          {/* Token budget warning banner */}
          {current && config.maxContext > 0 && (() => {
            const tokenIn = current.totalInTokens ?? 0;
            const pct = Math.min(100, (tokenIn / config.maxContext) * 100);
            if (pct < 80) return null;
            const isDanger = pct >= 95;
            return (
              <div className={`shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b ${
                isDanger
                  ? "bg-red/5 border-red/20 text-red"
                  : "bg-yellow/5 border-yellow/20 text-yellow"
              }`}>
                {isDanger ? <OctagonAlert size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                <span>
                  Bağlam dolumu {pct.toFixed(0)}% — {isDanger
                    ? "Limit aşılmak üzere, yeni sohbet başlatmanı öneririm."
                    : "Sohbet uzuyor, yakında limit dolabilir."}
                </span>
              </div>
            );
          })()}

          {/* Messages */}
          {/* overscroll-contain: sayfa geri-çekme zinciri kesilir; overflow-anchor
             kapalı: tarayıcının kaydırma-çapası akışta zıplama yapmasın (yapışma
             mantığı stickRef ile bizde). */}
          <SelectionQuoteBar containerRef={scrollRef} onQuote={quoteSelection} />
          <div ref={scrollRef} onScroll={onMessagesScroll} className="flex-1 overflow-y-auto overscroll-contain" style={{ overflowAnchor: "none" }}>
            {messages.length === 0 ? (
              <EmptyChat />
            ) : (
              <div className="max-w-3xl mx-auto px-5 py-6">
                {messages.map((m, i) => {
                  const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                  const isLast = i === messages.length - 1;
                  return (
                    /* cv-msg: ekran dışı eski mesajları sanallaştırır (akıcı
                       kaydırma). Son mesaj akış/paneller için hariç tutulur. */
                    <div
                      key={i}
                      className={[!isLast && "cv-msg", m.role === "user" && i > 0 && "mt-1 pt-4 border-t border-line/15"].filter(Boolean).join(" ") || undefined}
                    >
                      <MessageBubble
                        index={i}
                        message={m}
                        chatId={current?.id}
                        showRegenerate={isLastAssistant && !streaming}
                        onRegenerate={regenerate}
                        onContinue={isLastAssistant && m.content ? continueLast : undefined}
                        streamingNow={isLastAssistant && streaming}
                        animateIn={i >= enterFrom}
                        onEdit={m.role === "user" ? editAndResend : undefined}
                        /* Geri sarma yalnız kullanıcı mesajlarında ve SON mesaj
                           dışında anlamlı (sona sarmak hiçbir şey yapmaz).
                           Akış sürerken kapalı: yarıda kesilmiş bir turu geri
                           sarmak tutarsız duruma yol açardı. */
                        onRewind={
                          m.role === "user" && !streaming && !rewinding && i < messages.length - 1
                            ? rewindTo
                            : undefined
                        }
                        onSwitchVersion={
                          m.branches && m.branches.length > 1
                            ? (bIdx: number) => useStore.getState().switchMessageVersion(i, bIdx)
                            : undefined
                        }
                        onChecklistToggle={isLastAssistant && !streaming ? () => handleChecklistAutoContinue(i) : undefined}
                        onPickCompare={m.compareResults ? (rIdx: number) => useStore.getState().pickCompareResult(i, rIdx) : undefined}
                        onPostToPr={m.role === "assistant" && m.content && repo ? () => {
                          setPostPrMessageIndex(i);
                          setPostPrNumber("");
                          setPostPrModalOpen(true);
                        } : undefined}
                      />
                      {isLastAssistant && !streaming && pendingCommit && pendingCommit.length > 0 && repo && (
                        <div className="ml-11 max-w-2xl">
                          <MultiCommitBar
                            files={pendingCommit}
                            onClose={() => setPendingCommit(null)}
                            onOpenInEditor={(f) => openInEditor(f)}
                          />
                        </div>
                      )}
                      {isLastAssistant && !streaming && config.planApprovalMode && m.plan && (
                        <div className="ml-11 max-w-2xl mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-brand/30 bg-brand/5 text-xs">
                          <ListChecks size={13} className="text-brand shrink-0" />
                          <span className="text-muted flex-1">Plan hazır. Onaylarsan ajan uygulamaya başlar.</span>
                          <button
                            onClick={async () => {
                              planApprovedRef.current = true;
                              /* Claude Code'daki gibi: onaylayınca Plan modundan çıkılır
                                 (Oto'ya döner) — her turda yeniden plan istemek yerine
                                 kullanıcı isterse Ajan modu düğmesinden tekrar açar. */
                              const store = useStore.getState();
                              store.saveConfig({ ...store.config, planApprovalMode: false });
                              store.pushMessage({ role: "user", content: "Planı onaylıyorum, uygula." });
                              try { await callApi(); } finally { planApprovedRef.current = false; }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand text-[#111110] hover:bg-branddim font-semibold transition-colors shrink-0"
                          >
                            <Check size={12} /> Onayla &amp; Uygula
                          </button>
                        </div>
                      )}
                      {isLastAssistant && !streaming && pendingActions.length > 0 && repo && (
                        <div className="ml-11 max-w-2xl mt-2 rounded-xl border border-red/40 bg-red/5 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-red/20 text-xs">
                            <Trash2 size={13} className="text-red shrink-0" />
                            <span className="font-semibold text-red">Onay gerekli — ajan {pendingActions.length} yıkıcı işlem öneriyor</span>
                          </div>
                          <div className="divide-y divide-line/40">
                            {pendingActions.map((a) => (
                              <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate font-mono">
                                    {a.kind === "delete" ? `Sil: ${a.path}` : `Taşı: ${a.path} → ${a.newPath}`}
                                  </span>
                                  {a.reason && <span className="block truncate text-muted/60">{a.reason}</span>}
                                </span>
                                <button
                                  onClick={() => resolvePendingAction(a, true)}
                                  disabled={resolvingAction === a.id}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red/15 text-red hover:bg-red/25 font-semibold disabled:opacity-50 transition-colors shrink-0"
                                >
                                  {resolvingAction === a.id ? <Loader2Icon size={12} className="animate-spin" /> : <Check size={12} />}
                                  Onayla
                                </button>
                                <button
                                  onClick={() => resolvePendingAction(a, false)}
                                  disabled={resolvingAction === a.id}
                                  className="px-2.5 py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft font-semibold disabled:opacity-50 transition-colors shrink-0"
                                >
                                  Reddet
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isLastAssistant && !streaming && pendingSurvey && (
                        <SurveyCard
                          questions={pendingSurvey}
                          onSubmit={(answers, surveyQuestions) => {
                            setPendingSurvey(null);
                            const lines = answers.map((a, i) => `**${surveyQuestions[i].header}:** ${a}`);
                            useStore.getState().pushMessage({ role: "user", content: lines.join("\n") });
                            void callApi();
                          }}
                        />
                      )}
                      {isLastAssistant && !streaming && checkpoints.length > 0 && repo && (
                        <div className="ml-11 max-w-2xl mt-2 rounded-xl border border-line/50 bg-bgsoft/30 text-xs overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <RotateCcw size={13} className="text-yellow shrink-0" />
                            {checkpoints.length === 1 ? (
                              <span className="text-muted flex-1 min-w-0 truncate">
                                Ajan 1 dosyayı değiştirdi ({checkpoints[0].path})
                              </span>
                            ) : (
                              <button
                                onClick={() => setCheckpointsExpanded((v) => !v)}
                                className="flex items-center gap-1 text-muted hover:text-ink flex-1 min-w-0 text-left transition-colors"
                              >
                                <span className="truncate">Ajan {checkpoints.length} dosyayı değiştirdi</span>
                                <ChevronDown size={12} className={`shrink-0 transition-transform ${checkpointsExpanded ? "rotate-180" : ""}`} />
                              </button>
                            )}
                            <button
                              onClick={undoCheckpoints}
                              disabled={undoing}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow/10 text-yellow hover:bg-yellow/20 font-semibold disabled:opacity-50 transition-colors shrink-0"
                            >
                              {undoing ? <Loader2Icon size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                              {undoing ? "Geri alınıyor…" : "Geri Al"}
                            </button>
                            <button
                              onClick={() => {
                                setCheckpoints([]);
                                setCheckpointsExpanded(false);
                                useStore.getState().setCheckpointsOnLast([]);
                                void useStore.getState().persistCurrent();
                              }}
                              className="text-muted/50 hover:text-ink p-1 rounded transition-colors shrink-0"
                              title="Kapat"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {checkpoints.length > 1 && checkpointsExpanded && (
                            <ul className="px-3 pb-2.5 pt-0.5 space-y-1 border-t border-line/30">
                              {checkpoints.map((c) => (
                                <li key={c.path} className="text-muted/70 font-mono text-[11px] truncate">{c.path}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Terminal — bir kez boot olur, ARKAPLANDA mount kalır; kapatınca
              yalnızca gizlenir (unmount olmaz) → ajan komutları hep çalışır. */}
          {terminalMounted && (
            <div className={terminalOpen ? "" : "hidden"}>
              <ErrorBoundary variant="inline" label="Terminal çöktü">
                <RealTerminal onClose={() => setTerminalOpen(false)} />
              </ErrorBoundary>
            </div>
          )}

          {/* Composer */}
          <div
            className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-3xl mx-auto px-5 relative">

              {/* En alta in butonu (kullanıcı yukarı kaydırdıysa) — kaç yeni
                  mesaj geldiğini gösteren küçük bir rozet ile. */}
              {showScrollDown && messages.length > 0 && (
                <button
                  onClick={scrollToBottom}
                  title="En alta in"
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-surface border border-line shadow-lg grid place-items-center text-muted hover:text-ink hover:border-brand/40 transition-colors animate-fade-in"
                >
                  <ArrowDown size={16} />
                  {messages.length > lastSeenCountRef.current && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand text-bg text-[10px] font-bold grid place-items-center">
                      {messages.length - lastSeenCountRef.current}
                    </span>
                  )}
                </button>
              )}

              {/* Slash menu */}
              {slashOpen && (
                <SlashMenu
                  query={slashQuery}
                  onSelect={(a) => {
                    setActiveAgent(a);
                    setInput("");
                    setSlashOpen(false);
                    taRef.current?.focus();
                  }}
                  onClose={() => setSlashOpen(false)}
                />
              )}

              {/* Mention menu — ekli dosyalar + tüm proje ağacı */}
              {mentionOpen && (attachedFiles.length > 0 || allFiles.length > 0) && (
                <MentionMenu
                  query={mentionQuery}
                  items={[
                    ...attachedFiles.map((f) => ({ path: f.path, attached: true })),
                    ...allFiles
                      .filter((f) => !attachedFiles.some((a) => a.path === f.path))
                      .map((f) => ({ path: f.path, attached: false })),
                  ]}
                  onSelect={(item) => {
                    const ta = taRef.current;
                    if (!ta) return;
                    const pos = ta.selectionStart;
                    const before = input.slice(0, pos);
                    const after = input.slice(pos);
                    const atIdx = before.lastIndexOf("@");
                    if (atIdx === -1) return;
                    const newText = before.slice(0, atIdx) + `@${item.path} ` + after;
                    setInput(newText);
                    setMentionOpen(false);
                    /* Henüz ekli değilse repo dosyasının içeriğini çekip ekle ki
                       model dosyayı bağlamda görsün. */
                    if (!item.attached) {
                      const repoFile = allFiles.find((f) => f.path === item.path);
                      if (repoFile) void attachRepoFile(repoFile);
                    }
                    setTimeout(() => {
                      ta.focus();
                      const newPos = atIdx + item.path.length + 2;
                      ta.setSelectionRange(newPos, newPos);
                    }, 0);
                  }}
                  onClose={() => setMentionOpen(false)}
                />
              )}

              {/* Active agent badge */}
              {activeAgent && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs">
                    <span>{activeAgent.icon}</span>
                    <code className="font-mono font-bold">{activeAgent.command}</code>
                    <span className="text-brand/70">{activeAgent.label}</span>
                    <button
                      onClick={() => setActiveAgent(null)}
                      className="hover:text-red transition-colors ml-1"
                      title="Agent'ı kaldır"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              )}

              {/* Attached files */}
              {attachedFiles.length > 0 && (
                <div className="flex gap-2 mb-2.5 flex-wrap">
                  {attachedFiles.map((f) => (
                    <div key={f.path} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-bgsoft border border-line text-muted">
                      <FileIcon name={f.path.split("/").pop() ?? ""} size={11} />
                      <span className="max-w-[180px] truncate font-mono">{f.path.split("/").pop()}</span>
                      <button onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.path !== f.path))} className="text-muted/60 hover:text-red transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pendingImages.length > 0 && (
                <div className="flex gap-2 mb-2.5 flex-wrap">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative group/img">
                      {/* User-attached preview is a base64 data URI; next/image can't optimize it. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-16 h-16 object-cover rounded-xl border border-line shadow-sm" />
                      <button onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))} aria-label="Görseli kaldır" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red text-white grid place-items-center text-xs [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/img:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* TEK dosya girişi (kullanıcı kararı, Tem 2026): önceden "Dosya
                  ekle" / "Görsel ekle" / "Fotoğraf çek" diye üç ayrı öğe vardı,
                  oysa üçü de zaten AYNI huniye (readFileIntoInput) giriyordu —
                  ayrım kullanıcıya hiçbir şey kazandırmıyordu. accept listesine
                  image/* eklendi; görsel/belge ayrımını huni zaten dosya
                  türünden yapıyor. "Fotoğraf çek" kaldırıldı: tek bir input hem
                  belge listesi sunup hem native kamerayı açamaz (`capture`
                  yalnız media-only accept ile çalışır) ve mobilde OS dosya
                  seçici zaten "Fotoğraf Çek" seçeneğini kendisi sunuyor. */}
              <input ref={fileRef} type="file" multiple accept="image/*,.txt,.md,.markdown,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.json,.jsonl,.yaml,.yml,.toml,.html,.htm,.css,.scss,.sql,.sh,.bash,.go,.rs,.java,.kt,.swift,.dart,.c,.cpp,.h,.hpp,.rb,.php,.pdf,.docx,.xlsx,.pptx,.ipynb,.csv,.tsv,.xml,.svg,.log,.ini,.conf,.env,.tex,.srt,.vtt,.vue,.svelte,.lua,.pl,.r,.scala,.gradle,.properties,.bat,.ps1,text/plain" className="hidden"
                onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) readFileIntoInput(f); e.target.value = ""; }} />

              {/* Yüzen composer — camsı zemin, gölge odak halkasıyla vurgu rengini izler */}
              <div className="composer-glow flex items-end gap-2 bg-surface/85 backdrop-blur-xl border border-line rounded-[20px] pl-4 pr-2 py-2.5 sm:py-2">
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInput(v);
                    const pos = e.target.selectionStart;
                    const before = v.slice(0, pos);
                    const slashMatch = before.match(/(^|\n)(\/\w*)$/);
                    if (slashMatch) { setSlashQuery(slashMatch[2]); setSlashOpen(true); }
                    else setSlashOpen(false);
                    const mentionMatch = before.match(/(^|\s)@(\S*)$/);
                    if (mentionMatch && (attachedFiles.length > 0 || allFiles.length > 0)) {
                      setMentionQuery(mentionMatch[2]); setMentionOpen(true);
                    } else setMentionOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (slashOpen || mentionOpen) return;
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  onPaste={(e) => {
                    /* Panodan görsel (ekran görüntüsü/kopyalanan resim) — dosya
                       seçiciyle AYNI yolu (readFileIntoInput) kullanır. */
                    const imageItems = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
                    if (imageItems.length) {
                      e.preventDefault();
                      for (const item of imageItems) {
                        const file = item.getAsFile();
                        if (file) readFileIntoInput(file);
                      }
                      return;
                    }
                    /* Claude tarzı: çok uzun yapıştırma composer'ı şişirmesin —
                       otomatik metin eki olur (bağlama aynı şekilde girer). */
                    const text = e.clipboardData.getData("text");
                    if (text.length > 4000) {
                      e.preventDefault();
                      const name = `yapistirilan-${attachedFiles.length + 1}.txt`;
                      setAttachedFiles((prev) => [...prev, { path: name, content: text }]);
                      addToast(`Uzun metin "${name}" olarak eklendi 📎`, "success");
                    }
                  }}
                  rows={1}
                  placeholder={
                    activeAgent
                      ? activeAgent.placeholder
                      : attachedFiles.length > 0
                      ? `${attachedFiles.length} dosya eklendi — sor veya / yaz…`
                      : "Mesajınızı yazın…"
                  }
                  /* Boş sohbette composer belirgin şekilde DAHA DOLGUN durur
                     (~3 satır). Tek satırlık ince bir kutu "buraya yaz" demiyor;
                     ChatGPT/Claude'un boş ekranındaki davetkâr yükseklik buradan
                     geliyor. Sohbet başlayınca tek satıra döner — o noktada
                     ekranı mesajlara bırakmalı.
                     min-height CSS'i, auto-grow'un inline verdiği daha küçük
                     `height` değerini geçer; ikisi çakışmaz. */
                  className={`flex-1 bg-transparent resize-none outline-none text-[15px] sm:text-[15px] leading-relaxed max-h-[240px] py-1 placeholder:text-muted/45 ${
                    emptyChat ? "min-h-[68px] sm:min-h-[76px]" : ""
                  }`}
                />

                {!streaming && (
                  <VoiceButton
                    onTranscript={(text, isFinal) => {
                      /* interim: replace tail; final: append + space */
                      setInput((cur) => {
                        if (isFinal) return (cur + (cur && !cur.endsWith(" ") ? " " : "") + text).trimStart();
                        return cur;
                      });
                    }}
                  />
                )}
                {/* Dosya & görsel ekleme — TEK düğme, menü yok (kullanıcı kararı).
                    Doğrudan dosya seçiciyi açar; görsel de belge de aynı yerden
                    eklenir. Web araması Otomatik Pilot ile kendiliğinden çalışır
                    (manuel toggle yok). */}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl text-muted hover:text-ink hover:bg-hover active:scale-95 grid place-items-center transition-all"
                  title="Dosya veya görsel ekle"
                  aria-label="Dosya veya görsel ekle"
                >
                  <Paperclip size={16} />
                </button>
                {streaming ? (
                  <button onClick={stop} className="shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-red hover:bg-red/80 active:bg-red/70 text-white grid place-items-center transition-all hover:scale-105 active:scale-95" title="Durdur">
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    /* S5 — gönderme geri bildirimi: basma anında küçülme +
                       gönderildiğinde marka renginde tek bir dalga. Girdinin
                       kaydedildiği an gözle de hissedilsin. */
                    onClick={() => { setSendPulse(true); send(); }}
                    onAnimationEnd={() => setSendPulse(false)}
                    disabled={!input.trim() && pendingImages.length === 0 && attachedFiles.length === 0}
                    className={`shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-brand hover:bg-branddim active:bg-branddim text-[#111110] grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 press-fx${sendPulse ? " send-pulse" : ""}`}
                  >
                    <ArrowUp size={17} />
                  </button>
                )}
              </div>

              {/* Alt durum çubuğu — sol: model seçici (Claude'daki gibi giriş
                  alanının bir parçası, artık ayrı bir üst header'da değil).
                  Sağ: aktif mod rozetleri. */}
              <div className="flex flex-wrap items-center justify-between gap-y-1 mt-2 px-0.5">
                <ModelSwitcher />
                <StatusBar
                  safeMode={config.safeMode}
                  web={lastPilot?.web}
                  autoPilot={config.autoPilot}
                  pilotReasons={lastPilot?.reasons}
                  autoSwarm={config.autoSwarm}
                  swarm={lastPilot?.swarm}
                  research={lastPilot?.research}
                  toolsEnabled={toolsEnabled}
                  learningMode={config.learningMode}
                  activeAgentLabel={activeAgent?.command}
                  sensitiveHits={sensitiveHits}
                  budget={budgetStatus}
                />
              </div>
            </div>
          </div>

          {/* Boş sohbette composer'ı dikey olarak ORTALAR. Kaydırma alanı (flex-1)
              ile bu boşluk (flex-1) ekranı eşit paylaşır → composer tam ortaya
              gelir, EmptyChat karşılaması da (justify-end ile) hemen üstüne
              yaslanır. Önceden karşılama ~%40'ta, composer en altta duruyor ve
              arada koca bir ölü boşluk kalıyordu — ekranı "demo" gösteren asıl
              şey buydu. Mesaj gelir gelmez boşluk kaybolur, composer alta döner. */}
          {messages.length === 0 && (
            /* Bu boşluk aynı zamanda "daha güçlü model bağla" köprüsünü barındırır.
               Köprü ÖNCE EmptyChat'in içindeydi (karşılama ile composer arasında)
               ama açılınca büyüyüp composer'ın arkasına taşıyordu — seçenek listesi
               yarıdan kesiliyordu. Composer'ın ALTINDAki bu alanda yer bol ve
               gerekirse kendi içinde kayabiliyor. */
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-5 pt-1">
              <ConnectStrongerModel />
            </div>
          )}
        </div>

        <RightPanel
          editorFile={editorFile}
          editorOpen={editorOpen}
          openTabs={openTabs}
          onSelectTab={selectTab}
          onCloseTab={closeTab}
          onEditorDirtyChange={setActiveDirty}
          onCloseEditor={() => {
            if (activeDirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Editör kapatılsın mı?")) return;
            setEditorOpen(false);
            setOpenTabs([]);
            setActiveDirty(false);
          }}
          onAskAI={(_text, context) => {
            useStore.getState().setPendingInput(context);
          }}
          gitOpen={gitPanelOpen}
          onCloseGit={() => setGitPanelOpen(false)}
          onReviewPr={() => setPrModalOpen(true)}
          artifact={artifact}
        />
      </div>

      {/* PR / MR Review Modal */}
      {/* Dosya ağacı sağ-tık menüsü */}
      {treeMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setTreeMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setTreeMenu(null); }}
          />
          <div
            className="fixed z-50 min-w-[180px] bg-surface border border-line rounded-xl shadow-2xl py-1 text-[12px] animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.min(treeMenu.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 200),
              top: Math.min(treeMenu.y, (typeof window !== "undefined" ? window.innerHeight : 9999) - 150),
            }}
          >
            <div className="px-3 py-1.5 text-[10px] text-muted/60 truncate border-b border-line/40 mb-1">{treeMenu.file.path}</div>
            <button
              onClick={() => { openTreeFile(treeMenu.file); setTreeMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bgsoft/60 transition-colors"
            >
              <Code2 size={13} className="text-muted" /> Editörde aç
            </button>
            <button
              onClick={() => { attachRepoFile(treeMenu.file); setTreeMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bgsoft/60 transition-colors"
            >
              <Paperclip size={13} className="text-muted" />
              {attachedPaths.includes(treeMenu.file.path) ? "Sohbetten çıkar" : "Sohbete ekle"}
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(treeMenu.file.path)
                  .then(() => addToast("Yol kopyalandı", "success"))
                  .catch(() => { /* yok say */ });
                setTreeMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bgsoft/60 transition-colors"
            >
              <Copy size={13} className="text-muted" /> Yolu kopyala
            </button>
          </div>
        </>
      )}

      {prModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPrModalOpen(false)}>
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitPullRequest size={16} className="text-brand" />
                <h3 className="font-bold text-sm">PR / MR İnceleme</h3>
              </div>
              <button onClick={() => setPrModalOpen(false)} className="text-muted hover:text-ink"><X size={16} /></button>
            </div>
            <p className="text-xs text-muted mb-3">
              {repoIsGitLab ? "GitLab MR" : "GitHub PR"} numarasını gir. AI diff&apos;i okuyup kod incelemesi yapacak.
            </p>
            <input
              value={prNumber}
              onChange={(e) => setPrNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="#123"
              className="input-mono w-full mb-3"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void handlePrReview(); }}
            />
            <button
              onClick={() => void handlePrReview()}
              disabled={!prNumber || prLoading}
              className="w-full flex items-center justify-center gap-2 bg-brand text-[#111110] text-sm font-semibold py-2.5 rounded-xl hover:bg-branddim disabled:opacity-50 transition-colors"
            >
              {prLoading ? <Loader2Icon size={14} className="animate-spin" /> : <><GitPullRequest size={14} /> İncele</>}
            </button>
          </div>
        </div>
      )}

      {postPrModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPostPrModalOpen(false)}>
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitPullRequest size={16} className="text-brand" />
                <h3 className="font-bold text-sm">Yorumu {repoIsGitLab ? "MR'a" : "PR'a"} gönder</h3>
              </div>
              <button onClick={() => setPostPrModalOpen(false)} className="text-muted hover:text-ink"><X size={16} /></button>
            </div>
            <p className="text-xs text-muted mb-3">
              Bu yanıt, gerçek bir yorum olarak {repoIsGitLab ? "GitLab MR" : "GitHub PR"}&apos;a yazılacak — geri alınamaz.
            </p>
            <input
              value={postPrNumber}
              onChange={(e) => setPostPrNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="#123"
              className="input-mono w-full mb-3"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void handlePostToPr(); }}
            />
            <button
              onClick={() => void handlePostToPr()}
              disabled={!postPrNumber || postPrLoading}
              className="w-full flex items-center justify-center gap-2 bg-brand text-[#111110] text-sm font-semibold py-2.5 rounded-xl hover:bg-branddim disabled:opacity-50 transition-colors"
            >
              {postPrLoading ? <Loader2Icon size={14} className="animate-spin" /> : <><GitPullRequest size={14} /> Yorumu gönder</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  async function handlePrReview() {
    if (!prNumber || !repo) return;
    setPrLoading(true);
    try {
      const store = useStore.getState();
      const token = await store.tokenForRepo(activeRepoStr, repoIsGitLab ? "gitlab" : "github");
      const res = await fetch("/api/pr-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: repoIsGitLab ? "gitlab" : "github",
          owner: repo.owner,
          repo: repo.repo,
          prNumber: parseInt(prNumber, 10),
          token,
        }),
      });
      const data = await res.json() as { diff?: string; error?: string };
      if (!res.ok || !data.diff) {
        useStore.getState().addToast(data.error ?? "PR bulunamadı", "error");
        return;
      }
      const reviewPrompt = `Aşağıdaki ${repoIsGitLab ? "GitLab MR" : "GitHub PR"} #${prNumber} diff'ini detaylı olarak incele:\n\n\`\`\`diff\n${data.diff}\n\`\`\`\n\nŞu başlıklar altında incele: 🐛 Hatalar, 🔒 Güvenlik, ⚡ Performans, ✅ En İyi Pratikler. Her bulgu için ciddiyet (düşük/orta/yüksek) belirt.`;
      useStore.getState().setPendingInput(reviewPrompt);
      setPrModalOpen(false);
      setPrNumber("");
    } catch (e) {
      useStore.getState().addToast((e as Error).message, "error");
    } finally {
      setPrLoading(false);
    }
  }

  /* "PR incele"nin (yalnız sohbete yazar) aksine, seçilen bir asistan yanıtını
     GERÇEK bir yorum olarak GitHub/GitLab'a geri yazar — tek yönlü inceleme
     akışını tamamlar. */
  async function handlePostToPr() {
    if (!postPrNumber || !repo || postPrMessageIndex === null) return;
    const msg = messages[postPrMessageIndex];
    if (!msg?.content) return;
    setPostPrLoading(true);
    try {
      const store = useStore.getState();
      const token = await store.tokenForRepo(activeRepoStr, repoIsGitLab ? "gitlab" : "github");
      if (!token) { store.addToast("Önce bir GitHub/GitLab hesabı bağla.", "error"); return; }
      const res = await fetch("/api/pr-review/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: repoIsGitLab ? "gitlab" : "github",
          owner: repo.owner,
          repo: repo.repo,
          prNumber: parseInt(postPrNumber, 10),
          token,
          body: msg.content,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        store.addToast(data.error ?? "Yorum gönderilemedi", "error");
        return;
      }
      store.addToast("Yorum PR'a gönderildi.", "success");
      setPostPrModalOpen(false);
      setPostPrNumber("");
      setPostPrMessageIndex(null);
    } catch (e) {
      useStore.getState().addToast((e as Error).message, "error");
    } finally {
      setPostPrLoading(false);
    }
  }
}

function getTreeItems(node: import("@/lib/types").TreeNode): { path: string; type: string }[] {
  const items: { path: string; type: string }[] = [];
  for (const f of node.files) items.push({ path: f.path, type: "blob" });
  for (const child of Object.values(node.dirs)) items.push(...getTreeItems(child));
  return items;
}

/* ── Token + cost rozeti ── */
/* Görev paneli (update_plan) artık yalnız MessageBubble.tsx'te render edilir
   (bkz. oradaki PlanPanel) — burada AYRICA bir TaskPanel daha vardı, aynı
   `m.plan` verisini FARKLI bir ayrıştırıcıyla ikinci kez çiziyordu (aktif
   turda ikisi aynı anda görünüyordu). Tek doğruluk kaynağı için silindi. */

/* Sağlayıcıların ücretsiz katman limitleri (canlı uç yoksa gösterilen bilgi). */
const FREE_TIER_INFO: Partial<Record<string, string>> = {
  gemini: "Ücretsiz: ~15 istek/dakika, günde 1.500 istek (model bazlı). Her gün 00:00 PT'de sıfırlanır.",
  groq: "Ücretsiz: dakikalık token + istek limiti. Her dakika başında yenilenir.",
  openrouter: "Ücretsiz modeller (:free): günlük istek limiti. Gün başında sıfırlanır. Ücretli kredide canlı bakiye gösterilir.",
  pollinations: "Ücretsiz ve gömülü — sınır pratikte yok.",
  hf: "Ücretsiz katman: saatlik kredi. Saat başı yenilenir.",
  cerebras: "Ücretsiz: günlük token limiti. Gün başında sıfırlanır.",
  mistral: "Ücretsiz katman: aylık token kotası.",
  ollama: "Yerel — sınır yok (kendi donanımın).",
};

interface UsageQuota {
  supported: boolean;
  creditRemaining?: number;
  creditUsed?: number;
  currency?: string;
  limit?: number;
  remaining?: number;
  isFreeTier?: boolean;
  resetText?: string;
  label?: string;
  note?: string;
}

/* Token + maliyet rozeti — tıklanınca canlı kota pop-up'ı açar. */
function UsageBadge({ chat, pendingTokens = 0 }: { chat: { totalInTokens?: number; totalOutTokens?: number }; pendingTokens?: number }) {
  const config = useStore((s) => s.config);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const tokenIn = chat.totalInTokens ?? 0;
  const tokenOut = chat.totalOutTokens ?? 0;
  const total = tokenIn + tokenOut;
  const activeModel = config.models.find((m) => m.id === config.activeModelId);
  /* Gösterecek bir şey yoksa rozet hiç ÇİZİLMEZ. "0 tok" bir bilgi değil, yalnız
     üst çubuğu dolduran bir jargon parçasıydı; ilk gerçek token akışıyla (ya da
     kullanıcı yazmaya başlayınca, pendingTokens) kendiliğinden belirir.
     Koşul burada duruyor ki her çağrı yerinde tekrar edilmesin. */
  const nothingToShow = total === 0 && pendingTokens === 0;
  const cost = activeModel ? calculateCost(activeModel.model, tokenIn, tokenOut) : null;
  const hasPrice = activeModel ? getModelPrice(activeModel.model) !== null : false;
  const pct = config.maxContext > 0 ? Math.min(100, (tokenIn / config.maxContext) * 100) : 0;
  const warn = pct >= 80;
  const danger = pct >= 95;

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ left: r.right, top: r.bottom + 6 });
    }
    setOpen((o) => !o);
  };

  /* Tüm hook'lar yukarıda çağrıldı — bu erken çıkış hook sırasını bozmaz. */
  if (nothingToShow) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`flex items-center gap-1 sm:gap-1.5 text-[10px] font-mono px-1.5 sm:px-2 py-1 rounded-lg border mr-0.5 sm:mr-1 transition-colors hover:border-brand/40 ${
          danger ? "border-red/40 bg-red/5 text-red"
          : warn ? "border-yellow/40 bg-yellow/5 text-yellow"
          : "border-line/40 text-muted/70"
        }`}
        title={pendingTokens > 0
          ? `Bu sohbet: ${total.toLocaleString()} token · Göndereceğin: ~${pendingTokens.toLocaleString()} token. Detay için tıkla.`
          : "Token & kota detayı için tıkla"}
      >
        <span className="relative w-3 h-3" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-current opacity-15" />
          <span className="absolute inset-0 rounded-full bg-current" style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }} />
        </span>
        <span>{total.toLocaleString()}<span className="hidden sm:inline"> tok</span></span>
        {pendingTokens > 0 && (
          <span className="hidden sm:inline text-brand/80" title="Göndermeden önce tahmini ek token">+~{pendingTokens.toLocaleString()}</span>
        )}
        {cost !== null && hasPrice && (
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="opacity-40">·</span>
            <span className={danger || warn ? "" : "text-brand/80"}>{formatCost(cost)}</span>
          </span>
        )}
      </button>
      {open && pos && <UsageModal chat={chat} pos={pos} onClose={() => setOpen(false)} />}
    </>
  );
}

function UsageModal({ chat, pos, onClose }: { chat: { totalInTokens?: number; totalOutTokens?: number }; pos: { left: number; top: number }; onClose: () => void }) {
  const config = useStore((s) => s.config);
  const activeModel = config.models.find((m) => m.id === config.activeModelId);
  const [quota, setQuota] = useState<UsageQuota | null>(null);
  const [loading, setLoading] = useState(!!activeModel);

  const tokenIn = chat.totalInTokens ?? 0;
  const tokenOut = chat.totalOutTokens ?? 0;
  const total = tokenIn + tokenOut;
  const pct = config.maxContext > 0 ? Math.min(100, (tokenIn / config.maxContext) * 100) : 0;
  const cost = activeModel ? calculateCost(activeModel.model, tokenIn, tokenOut) : null;
  const price = activeModel ? getModelPrice(activeModel.model) : null;
  const provider = activeModel?.provider ?? "";
  const freeInfo = FREE_TIER_INFO[provider];

  useEffect(() => {
    if (!activeModel) return;
    let alive = true;
    fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: activeModel.provider, baseUrl: activeModel.baseUrl, apiKey: activeModel.apiKey }),
    })
      .then((r) => r.json())
      .then((d: UsageQuota) => { if (alive) setQuota(d); })
      .catch(() => { if (alive) setQuota({ supported: false }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeModel]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <div
        style={{ position: "fixed", left: pos.left, top: pos.top, transform: "translateX(-100%)" }}
        className="z-[71] w-[300px] max-h-[72vh] overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 animate-modal-content"
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line/60 sticky top-0 bg-surface">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-brand" />
            <h3 className="font-bold text-xs">Kullanım & Kota</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors"><X size={14} /></button>
        </div>

        <div className="p-3 space-y-3 text-sm">
          {/* Aktif model */}
          <div className="flex items-center justify-between">
            <span className="text-muted text-xs">Aktif model</span>
            <span className="font-mono text-xs font-semibold truncate max-w-[180px]">{activeModel?.label || activeModel?.model || "—"}</span>
          </div>

          {/* Bu oturum */}
          <div className="rounded-xl border border-line/60 bg-bgsoft/40 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/50">Bu sohbet</div>
            <div className="flex justify-between text-xs"><span className="text-muted">Girdi</span><span className="font-mono">{tokenIn.toLocaleString()} tok</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted">Çıktı</span><span className="font-mono">{tokenOut.toLocaleString()} tok</span></div>
            <div className="flex justify-between text-xs font-semibold border-t border-line/40 pt-2"><span>Toplam</span><span className="font-mono">{total.toLocaleString()} tok</span></div>
            {cost !== null && price && (
              <div className="flex justify-between text-xs"><span className="text-muted">Tahmini maliyet</span><span className="font-mono text-brand">{formatCost(cost)}</span></div>
            )}
            {/* Bağlam doluluğu */}
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-muted/60 mb-1">
                <span>Bağlam penceresi</span><span className="font-mono">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-bgsoft overflow-hidden">
                <div className={`h-full transition-all ${pct >= 95 ? "bg-red" : pct >= 80 ? "bg-yellow" : "bg-brand"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Hesap durumu (canlı kota) */}
          <div className="rounded-xl border border-line/60 bg-bgsoft/40 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/50">Hesap durumu</div>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted/60 py-1">
                <Loader2Icon size={13} className="animate-spin" /> Sağlayıcıdan çekiliyor…
              </div>
            ) : quota?.supported ? (
              <>
                {quota.creditRemaining !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Kalan kredi</span>
                    <span className="font-mono font-semibold text-green">{quota.currency === "USD" ? "$" : ""}{quota.creditRemaining.toFixed(4)} {quota.currency !== "USD" ? quota.currency : ""}</span>
                  </div>
                )}
                {quota.creditUsed !== undefined && (
                  <div className="flex justify-between text-xs"><span className="text-muted">Harcanan</span><span className="font-mono">${quota.creditUsed.toFixed(4)}</span></div>
                )}
                {quota.isFreeTier !== undefined && (
                  <div className="flex justify-between text-xs"><span className="text-muted">Katman</span><span className="font-mono">{quota.isFreeTier ? "Ücretsiz" : "Ücretli"}</span></div>
                )}
                {quota.note && <p className="text-[11px] text-muted/60 leading-relaxed pt-1">{quota.note}</p>}
              </>
            ) : (
              <p className="text-[11px] text-muted/60 leading-relaxed">
                {freeInfo ?? "Bu sağlayıcı canlı bakiye/kota uçları sunmuyor."}
                {quota?.note && <span className="block mt-1 text-muted/40">{quota.note}</span>}
              </p>
            )}
          </div>

          {/* Fiyat tablosu */}
          {price && (
            <div className="flex items-center justify-between text-[11px] text-muted/60">
              <span>Fiyat (1M token)</span>
              <span className="font-mono">girdi ${price.inputPerMTok} · çıktı ${price.outputPerMTok}</span>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
