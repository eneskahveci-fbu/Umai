"use client";

import { useState } from "react";
import { ArrowUp, ChevronDown, LayoutTemplate, Sparkles } from "lucide-react";
import { TemplateGallery } from "./TemplateGallery";
import type { StudioTemplate } from "@/lib/studioTemplates";

/* Stüdyo anasayfası — claude.ai'yi açınca gelen ilk ekrana birebir paralel:
   ortalanmış karşılama + TEK büyük prompt kutusu + biçim öneren kısa çipler.
   19 şablonluk ızgara (TemplateGallery) burada İKİNCİL bir yol — varsayılan
   olarak kapalı, "Hazır şablonlar" ile açılır. Kullanıcı gönderince ana
   bileşen (DesignStudio) mevcut sohbet+ArtifactCanvas görünümüne geçer —
   tıpkı Claude'da bir isteğe Artifacts panelinin açılması gibi. */

interface QuickStart {
  label: string;
  icon: string;
  brief: string;
}

const QUICK_STARTS: QuickStart[] = [
  { label: "Tasarım", icon: "🎨", brief: "Bir SaaS analitik aracı için modern bir landing sayfası tasarla — net hero, 3 özellik ve güçlü bir CTA." },
  { label: "Kod", icon: "💻", brief: "Python ile bir CSV dosyasındaki yinelenen satırları temizleyip özet istatistik basan bir script yaz." },
  { label: "Doküman", icon: "📄", brief: "Yeni bir ürün özelliği için kısa bir teknik tasarım dokümanı (RFC) yaz: amaç, yaklaşım, riskler." },
  { label: "Diyagram", icon: "📊", brief: "Bir kullanıcı kayıt/giriş akışının mimari diyagramını çiz (istemci → API → veritabanı)." },
  { label: "Sunum", icon: "📽️", brief: "Bir startup için 6 slaytlık kısa bir yatırımcı sunumu hazırla: kapak, problem, çözüm, pazar, ekip, CTA." },
];

export function StudioHomeScreen({
  brief, setBrief, onSubmit, onPickTemplate, busy,
}: {
  brief: string;
  setBrief: (s: string) => void;
  onSubmit: (text: string) => void;
  onPickTemplate: (t: StudioTemplate) => void;
  busy: boolean;
}) {
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const submit = () => {
    const t = brief.trim();
    if (!t || busy) return;
    onSubmit(t);
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="font-serif text-[28px] sm:text-4xl font-medium tracking-tight text-ink text-balance">
              Bugün ne oluşturalım?
            </h1>
            <p className="text-muted text-sm mt-2 text-balance">
              Tasarım, kod, doküman, diyagram — ne istersen yaz, gerisini hallederim.
            </p>
          </div>

          {/* Büyük prompt kutusu — Claude'un anasayfa besteci kutusuna paralel */}
          <div className="w-full rounded-[24px] border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={3}
              placeholder="Bir şey iste — örn. 'bir fitness uygulaması için onboarding ekranı' ya da 'JSON'ı CSV'ye çeviren bir Python fonksiyonu'…"
              className="w-full bg-transparent resize-none outline-none px-5 pt-4 text-[15px] placeholder:text-muted/60 min-h-[76px]"
            />
            <div className="flex items-center justify-end gap-1.5 px-3 pb-3 pt-1">
              <button
                onClick={submit}
                disabled={busy || !brief.trim()}
                aria-label="Gönder"
                title="Gönder"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-brand text-bg disabled:opacity-30 hover:bg-branddim transition-colors"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>

          {/* Biçim önerileri — tek tıkla kutuyu doldurur (Claude'un kategori çipleri) */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {QUICK_STARTS.map((q) => (
              <button
                key={q.label}
                onClick={() => setBrief(q.brief)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-xs text-muted hover:text-ink transition-colors"
              >
                <span aria-hidden>{q.icon}</span> {q.label}
              </button>
            ))}
          </div>

          {/* Hazır şablonlar — ikincil yol, varsayılan kapalı */}
          <div className="w-full">
            <button
              onClick={() => setTemplatesOpen((v) => !v)}
              className="mx-auto flex items-center gap-1.5 text-xs text-muted/70 hover:text-ink transition-colors"
            >
              <LayoutTemplate size={13} />
              Hazır şablonlardan başla
              <ChevronDown size={13} className={`transition-transform ${templatesOpen ? "rotate-180" : ""}`} />
            </button>
            {templatesOpen && (
              <div className="mt-4 animate-fade-in">
                <TemplateGallery onPick={onPickTemplate} />
              </div>
            )}
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
