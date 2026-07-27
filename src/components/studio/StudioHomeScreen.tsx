"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowUp, BarChart3, BookOpen, Clock, Code2, FileText,
  Layers, ListChecks, Network, Paperclip, Palette, Presentation, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSurfaceNav, type Surface } from "@/lib/surfaceNav";
import { DesignSystemPicker, ModelPicker, TemplatePicker, ImagePreviewStrip } from "./ComposerExtras";
import type { StudioTemplate } from "@/lib/studioTemplates";
import type { StudioProject } from "@/lib/types";
import { recentProjects, relativeTime } from "@/lib/studioProjectState";
import { VoiceButton } from "../VoiceButton";
import { CardPreview } from "./CardPreview";

/* Stüdyo anasayfası — claude.ai'yi açınca gelen ilk ekrana birebir paralel:
   ortalanmış karşılama + TEK büyük prompt kutusu + biçim/araç kartları ızgarası
   (Claude'un gerçek şablon galerisine yakın büyük kartlar — Umai renklerinde).
   İki kart TÜRÜ var:
     - "prefill": composer'a örnek bir brief doldurur, kullanıcı Gönder'e basınca
       AYNI tek tuval (DesignStudio) tek seferlik bir HTML/SVG artifact üretir
       (Tasarım/Kod/Doküman/Diyagram/Sunum — var olan davranış, dokunulmadı).
     - "tool": kalıcı/durumlu GERÇEK bir stüdyo yüzeyine (Anket/Defter/Kroki/
       Kartlar) doğrudan gider — bunlar kaydetme/koşullu mantık/aralıklı tekrar
       gibi tek-seferlik üretimle ASLA karşılanamayacak özellikler taşıdığından
       tek tuval üzerinden değil kendi tam sayfalarında açılırlar (eskiden
       Sidebar → "Araçlar" açılır listesindeydi, artık buradan erişiliyor).
   Hazır şablon vitrini (kategori sekmeli galeri) kaldırıldı (Tem 2026
   kullanıcı kararı) — biçim/araç kartları tek başlangıç noktası. */

interface QuickCard {
  label: string;
  desc: string;
  icon: LucideIcon;
}
interface PrefillCard extends QuickCard { kind: "prefill"; brief: string; preview: string }
interface ToolCard extends QuickCard { kind: "tool"; surface: Surface }

const PREFILL_CARDS: PrefillCard[] = [
  { kind: "prefill", label: "Tasarım", icon: Palette, desc: "Landing, dashboard, mobil ekran", preview: "design",
    brief: "Bir SaaS analitik aracı için modern bir landing sayfası tasarla — net hero, 3 özellik ve güçlü bir CTA." },
  { kind: "prefill", label: "Kod", icon: Code2, desc: "Script, fonksiyon, küçük araç", preview: "code",
    brief: "Python ile bir CSV dosyasındaki yinelenen satırları temizleyip özet istatistik basan bir script yaz." },
  { kind: "prefill", label: "Doküman", icon: FileText, desc: "Tek seferlik RFC/özet sayfası", preview: "doc",
    brief: "Yeni bir ürün özelliği için kısa bir teknik tasarım dokümanı (RFC) yaz: amaç, yaklaşım, riskler." },
  { kind: "prefill", label: "Diyagram", icon: BarChart3, desc: "Mimari/akış görseli", preview: "diagram",
    brief: "Bir kullanıcı kayıt/giriş akışının mimari diyagramını çiz (istemci → API → veritabanı)." },
  { kind: "prefill", label: "Sunum", icon: Presentation, desc: "Kaydırmalı tek sayfa sunum", preview: "deck",
    brief: "Bir startup için 6 slaytlık kısa bir yatırımcı sunumu hazırla: kapak, problem, çözüm, pazar, ekip, CTA." },
];

const TOOL_CARDS: ToolCard[] = [
  { kind: "tool", label: "Anket", icon: ListChecks, surface: "forms", desc: "Koşullu mantık, kaydet" },
  { kind: "tool", label: "Defter", icon: BookOpen, surface: "notebook", desc: "Kaynaklı sohbet + sesli özet" },
  { kind: "tool", label: "Kroki", icon: Network, surface: "map", desc: "Zihin haritası" },
  { kind: "tool", label: "Kartlar", icon: Layers, surface: "cards", desc: "Aralıklı tekrar" },
];

/* V2 — Kartlar artık TÜRÜNE göre ayrı. Eskiden 9 kart tek ızgaradaydı ve
   görsel olarak aynıydılar; oysa davranışları farklı: "biçim" kartları
   composer'ı doldurur (aynı sayfada kalırsın), "araç" kartları seni BAŞKA bir
   kalıcı yüzeye götürür. Aynı görünüp farklı davranmaları öngörülemezdi. */

/** Biçim kartı — mini görsel önizleme + ad. Composer'ı doldurur. */
function FormatCard({ card, onClick }: { card: PrefillCard; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-line/70 bg-surface hover:border-brand/50 hover:bg-bgsoft/40 transition-colors p-2.5 flex flex-col gap-2"
    >
      <CardPreview kind={card.preview} />
      <span className="min-w-0 px-0.5 pb-0.5">
        <span className="block text-[13px] font-semibold text-ink">{card.label}</span>
        <span className="block text-[11px] text-muted/75 leading-snug mt-0.5">{card.desc}</span>
      </span>
    </button>
  );
}

/* V4 — Araç kartları artık kompakt TEK SATIR. Eskiden biçim kartlarıyla aynı
   büyüklükteydiler; mobilde 9 büyük kart 5 satır ediyor ve composer ekrandan
   çıkıyordu. Bunlar birer "git" bağlantısı olduğundan büyük kart hak etmiyor. */
function ToolRow({ card, onClick }: { card: ToolCard; onClick: () => void }) {
  const Icon = card.icon;
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-line/70 bg-surface hover:border-brand/50 hover:bg-bgsoft/40 transition-colors px-2.5 py-2 flex items-center gap-2.5 min-w-0"
    >
      <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand grid place-items-center group-hover:bg-brand/15 transition-colors shrink-0">
        <Icon size={14} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-ink truncate">{card.label}</span>
        <span className="block text-[10.5px] text-muted/70 leading-snug truncate">{card.desc}</span>
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted/45 mb-2 px-0.5">{children}</h2>
  );
}

/* V1 — Son projeler. Claude Design'da açılışta son işlerin görünür; bizde
   kayıtlı projelere ulaşmanın TEK yolu üst çubuktaki klasör ikonuydu (üstelik
   kayıt yoksa o da gizleniyordu). Artık composer'ın hemen altında, tıkla-devam
   et. Yatay kaydırma: satır sayısı sabit kalır, mobilde dikey yer yemez (V4). */
function RecentStrip({ projects, onOpen }: { projects: StudioProject[]; onOpen: (p: StudioProject) => void }) {
  /* Referans an mount'ta BİR KEZ alınır: render sırasında Date.now() çağırmak
     saf olmayan bir işlem (React kuralı; eslint react-hooks/purity yakaladı) ve
     her yeniden çizimde etiketleri oynatırdı. */
  const [now] = useState(() => Date.now());
  if (projects.length === 0) return null;
  return (
    <div className="w-full">
      <SectionLabel>Son projeler</SectionLabel>
      <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-fade-x pb-1">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onOpen(p)}
            title={p.brief || p.name}
            className="group shrink-0 w-40 text-left rounded-xl border border-line/70 bg-surface hover:border-brand/50 hover:bg-bgsoft/40 transition-colors px-3 py-2.5"
          >
            <span className="block text-[12.5px] font-semibold text-ink truncate">{p.name || "Adsız tasarım"}</span>
            <span className="flex items-center gap-1 text-[10.5px] text-muted/60 mt-1">
              <Clock size={10} className="shrink-0" /> {relativeTime(p.updatedAt, now)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StudioHomeScreen({
  brief, setBrief, onSubmit, busy, onPickTemplate,
  designSystemId, onDesignSystemChange, fusionEnabled, onFusionChange,
  pendingImages, onAddImages, onRemoveImage,
  savedProjects = [], onOpenProject,
}: {
  brief: string;
  /* Gerçek dispatcher (parent useState setter'ı): functional updater'a izin verir —
     VoiceButton'ın art arda final transkriptlerinde bayat `brief` üzerine yazmasını
     önler (aksi halde ikinci sonuç ilkini düşürebiliyordu). */
  setBrief: Dispatch<SetStateAction<string>>;
  onSubmit: (text: string) => void;
  busy: boolean;
  onPickTemplate: (t: StudioTemplate) => void;
  designSystemId: string;
  onDesignSystemChange: (id: string) => void;
  fusionEnabled: boolean;
  onFusionChange: (v: boolean) => void;
  pendingImages: string[];
  onAddImages: (files: FileList) => void;
  onRemoveImage: (i: number) => void;
  /** V1 — "Son projeler" şeridi için kayıtlı tasarımlar. */
  savedProjects?: StudioProject[];
  onOpenProject?: (p: StudioProject) => void;
}) {
  const nav = useSurfaceNav();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const t = brief.trim();
    if (!t || busy) return;
    onSubmit(t);
  };

  return (
    /* V4 — dikey yoğunluk. Mobilde py-12 + gap-8 + 9 büyük kart, composer'ı
       ekrandan çıkarıyordu (kullanıcı ekran görüntüsü). Boşluklar mobilde
       daraltıldı, masaüstünde eskisi gibi ferah kaldı. */
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="min-h-full flex flex-col items-center px-4 sm:px-6 py-6 sm:py-12">
        <div className="w-full max-w-3xl flex flex-col items-center gap-5 sm:gap-8">
          <div className="text-center">
            <h1 className="font-serif text-[24px] sm:text-4xl font-medium tracking-tight text-ink text-balance">
              Bugün ne oluşturalım?
            </h1>
            <p className="text-muted text-[13px] sm:text-sm mt-1.5 sm:mt-2 text-balance">
              Tasarım, kod, doküman, diyagram — ne istersen yaz, gerisini hallederim.
            </p>
          </div>

          {/* Büyük prompt kutusu — ana sohbetin (CoderView) "Claude design"
              composer'ıyla BİREBİR aynı görsel dil: composer-glow, camsı
              zemin (bg-surface/85 backdrop-blur-xl). Alt kontrol satırı
              Claude Design'ın prompt kutusundaki seçeneklerle eşleşir: ataç,
              tasarım sistemi, model (çoklu). */}
          <div className="w-full max-w-2xl">
            <ImagePreviewStrip images={pendingImages} onRemove={onRemoveImage} />
            <div className="composer-glow rounded-[24px] border border-line bg-surface/85 backdrop-blur-xl transition-colors">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                rows={3}
                placeholder="Bir şey iste — örn. 'bir fitness uygulaması için onboarding ekranı' ya da 'JSON'ı CSV'ye çeviren bir Python fonksiyonu'…"
                className="w-full bg-transparent resize-none outline-none px-5 pt-4 text-[15px] leading-relaxed placeholder:text-muted/45 min-h-[76px]"
              />
              <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                {/* Tek satır, yatay kaydırma + sağda soluklaşma ipucu — çok
                    satıra bölünmek (eski flex-wrap) dar ekranda dağınık
                    duruyordu. Popover'lar yine ComposerExtras.tsx'teki align
                    hesabıyla ekran dışına taşmaz. */}
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
                      if (isFinal) setBrief((cur) => (cur ? `${cur} ` : "") + text);
                    }}
                  />
                </div>
                <button
                  onClick={submit}
                  disabled={busy || !brief.trim()}
                  aria-label="Gönder"
                  title="Gönder"
                  className="shrink-0 w-9 h-9 rounded-xl bg-brand hover:bg-branddim active:bg-branddim text-[#111110] grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  <ArrowUp size={17} />
                </button>
              </div>
            </div>
          </div>

          {onOpenProject && (
            <RecentStrip projects={recentProjects(savedProjects, 6)} onOpen={onOpenProject} />
          )}

          {/* V2/V3 — Biçim kartları: mini görsel önizleme + ad. Composer'ı
              doldurur, aynı sayfada kalırsın. */}
          <div className="w-full">
            <SectionLabel>Ne üretelim?</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {PREFILL_CARDS.map((c) => (
                <FormatCard key={c.label} card={c} onClick={() => setBrief(c.brief)} />
              ))}
            </div>
          </div>

          {/* V2/V4 — Araç kartları: kompakt satırlar. Bunlar BAŞKA bir kalıcı
              yüzeye götürür (Anket/Defter/Kroki/Kartlar) — biçim kartlarıyla
              aynı görünmeleri davranışlarını öngörülemez kılıyordu. */}
          <div className="w-full">
            <SectionLabel>Araçlar</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {TOOL_CARDS.map((c) => (
                <ToolRow key={c.label} card={c} onClick={() => nav.go(c.surface)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Boş sohbet paneli (iki-panel görünümde, sol sütun) için kompakt karşılama —
   ana giriş noktası artık StudioHomeScreen; bu yalnız takip mesajları
   başlamadan ÖNCE sol sütunun boş görünmemesi için ince bir yer tutucu. */
export function EmptyChatHint() {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-[220px] flex flex-col items-center gap-2 text-muted/50">
        <Sparkles size={20} />
        <p className="text-xs">Değişiklik iste, gerisini hallederim.</p>
      </div>
    </div>
  );
}
