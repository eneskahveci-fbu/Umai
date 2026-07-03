"use client";

import { ArrowUp, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { skillsByCategory, STUDIO_DIRECTIONS } from "@/lib/studioConstants";
import { allDesignSystems } from "@/lib/designSystems";

const selectCls =
  "flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand/60 cursor-pointer";

/* Stüdyo giriş ekranı — Open Design / Claude Design sadeliği: tek brief kartı,
   tür/sistem/yön kompakt seçicilerle kartın içinde. Varsayılan ✦ Otomatik tür
   (brief'ten craft seçer); ayrıntı ızgaraları yok. Mobil-öncelikli. */
export function StudioHome({
  brief, setBrief,
  skillId, setSkillId,
  directionId, setDirectionId,
  designSystemId, setDesignSystemId,
  onBrowseSystems, onOpenTemplates, onOpenProjects, projectCount,
  busy, onGenerate,
}: {
  brief: string; setBrief: (s: string) => void;
  skillId: string | null; setSkillId: (s: string) => void;
  directionId: string | null; setDirectionId: (s: string) => void;
  designSystemId: string; setDesignSystemId: (s: string) => void;
  onBrowseSystems: () => void;
  onOpenTemplates: () => void;
  onOpenProjects: () => void;
  projectCount: number;
  busy: boolean;
  onGenerate: () => void;
}) {
  const config = useStore((s) => s.config);
  const systems = allDesignSystems(config);
  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-20 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">Ne tasarlayalım?</h1>
          <p className="text-muted text-sm mt-1.5 text-balance">Bir brief yaz — türü, düzeni ve gerisini craft halleder.</p>
        </div>

        {/* Brief kartı: metin + kompakt seçiciler + üret, hepsi tek yüzeyde. */}
        <div className="rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onGenerate(); } }}
            rows={4}
            placeholder="Örn: SaaS analitik aracı için landing sayfası — koyu tema, fiyatlandırma bölümü… ya da '5 slaytlık yatırımcı sunumu'."
            className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[104px]"
          />
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pt-1">
            <select
              value={skillId ?? "auto"}
              onChange={(e) => setSkillId((e.target.value === "auto" ? null : e.target.value) as string)}
              aria-label="Çıktı türü"
              className={selectCls}
            >
              <option value="auto">✦ Otomatik tür</option>
              {skillsByCategory().map((g) => (
                <optgroup key={g.category} label={g.category}>
                  {g.skills.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={designSystemId}
              onChange={(e) => {
                if (e.target.value === "__browse") { onBrowseSystems(); return; }
                setDesignSystemId(e.target.value);
              }}
              aria-label="Tasarım sistemi"
              className={selectCls}
            >
              {systems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__browse">＋ Göz at / içe aktar…</option>
            </select>
            <select
              value={directionId ?? ""}
              onChange={(e) => setDirectionId(e.target.value)}
              aria-label="Tasarım yönü"
              className={`${selectCls} hidden sm:block`}
            >
              {STUDIO_DIRECTIONS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={onGenerate}
              disabled={busy || !brief.trim()}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} />} Üret
            </button>
          </div>
        </div>

        {/* Sessiz bağlantılar — kalabalık yok, ihtiyacı olan bulur. */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted/80">
          <button onClick={onOpenTemplates} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
            <Sparkles size={13} className="text-brand" /> Hazır şablonlar
          </button>
          {projectCount > 0 && (
            <button onClick={onOpenProjects} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
              <FolderOpen size={13} className="text-brand" /> Projelerim ({projectCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
