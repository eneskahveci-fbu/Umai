"use client";
import { useState } from "react";
import { Sparkles, Plus, Loader2, ChevronDown, Link2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { CATALOG_SKILLS, type CatalogSkill } from "@/lib/skillCatalog";

/** Açık kaynak skill içe-aktarma: (1) URL'den (GitHub raw, gist, herhangi bir
 *  CORS-açık kaynak) çeker, (2) gömülü kürate katalogdan tek tıkla ekler.
 *  İkisi de reaktif store.addSkill üzerinden çalışır → liste anında güncellenir. */
export default function SkillImport() {
  const addSkill = useStore((s) => s.addSkill);
  const addToast = useStore((s) => s.addToast);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const addCatalog = (c: CatalogSkill) => {
    addSkill({ title: c.title, content: c.content, tags: c.tags, enabled: true, source: "manual" });
    addToast(`Eklendi: ${c.title}`, "success");
  };

  const importUrl = async () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { addToast("Geçerli bir http(s) URL gir", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = (await res.text()).slice(0, 50000);
      if (!text.trim()) throw new Error("boş içerik");
      const name = decodeURIComponent(u.split("/").pop() || "").replace(/\.[a-z]+$/i, "") || "İçe aktarılan skill";
      addSkill({ title: name, content: text, tags: ["içe-aktarıldı"], enabled: true, source: "manual" });
      addToast(`İçe aktarıldı: ${name}`, "success");
      setUrl("");
    } catch (e) {
      addToast(`Getirilemedi (${(e as Error).message}). GitHub'da "Raw" linkini dene; CORS engeli olabilir.`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-5 py-2.5 border-b border-line/40 shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
      >
        <Sparkles size={13} className="text-brand" />
        İçe Aktar / Hazır Katalog
        <ChevronDown size={13} className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2.5 space-y-3">
          {/* URL'den içe aktar */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-bgsoft/60 rounded-lg px-2.5">
              <Link2 size={13} className="text-muted/60 shrink-0" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") importUrl(); }}
                placeholder="URL (GitHub raw, gist…) — skill olarak ekler"
                className="flex-1 min-w-0 bg-transparent py-2 text-xs outline-none placeholder:text-muted/35"
              />
            </div>
            <button
              onClick={importUrl}
              disabled={loading || !url.trim()}
              className="shrink-0 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="URL'den içe aktar"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </div>

          {/* Hazır katalog */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {CATALOG_SKILLS.map((c) => (
              <div key={c.title} className="flex items-center gap-2 bg-bgsoft/40 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-ink truncate">{c.title}</div>
                  <div className="text-[10px] text-muted/60 truncate">{c.tags.join(" · ")}</div>
                </div>
                <button
                  onClick={() => addCatalog(c)}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-md border border-line hover:border-brand/50 text-muted hover:text-ink transition-colors"
                >
                  Ekle
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
