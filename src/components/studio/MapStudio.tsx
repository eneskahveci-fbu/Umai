"use client";

import { useEffect, useState } from "react";
import {
  Download, FolderOpen, GitBranch, Loader2, Network, Plus, Save, Sparkles, Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { consumeSurfaceHandoff, consumeSurfaceOpenItem } from "@/lib/surfaceNav";
import { SavedItemsModal } from "./SavedItemsModal";
import { ExportMenu } from "./ExportMenu";
import { safeFileName } from "./DocsStudio";
import type { CraftMap } from "@/lib/types";
import {
  addChild, countNodes, deleteNode, expandNode, findNode, generateMap, layoutMap,
  mapToMarkdown, mapToSvg, MAX_MAP_NODES, newNode, updateNodeText,
} from "@/lib/mindmap";
import { publishArtifact } from "@/lib/studioExport";
import { useStudioProject } from "@/lib/useStudioProject";

/* Kroki — zihin haritası stüdyosu: brief → AI ağaç → tıkla-düzenle SVG kroki.
   Yerleşim tek kaynaktan (lib/mindmap.ts layoutMap); dışa aktarılan SVG ile
   uygulama içi görünüm aynı geometriyi paylaşır. Ücretsiz ve anahtarsız
   (Pollinations tabanı). */

const SUGGESTIONS = [
  "Yeni ürün lansmanı planı: hedef kitle, kanallar, zaman çizelgesi, riskler",
  "React öğrenme yol haritası: temeller, hooks, durum yönetimi, test",
  "Tez konusu beyin fırtınası: yapay zekâ ve eğitim kesişimi",
  "Aile bütçesi kalemleri: gelirler, sabit giderler, tasarruf hedefleri",
];

export function MapStudio() {
  const open = useStore((s) => s.mapStudioOpen);
  const addToast = useStore((s) => s.addToast);
  const { saved, save, remove } = useStudioProject<CraftMap>("craftMaps", 40);

  const [view, setView] = useState<"home" | "work">("home");
  const [brief, setBrief] = useState("");
  const [map, setMap] = useState<CraftMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);

  useEffect(() => {
    const b = consumeSurfaceHandoff("map");
    if (b) {
      const t = setTimeout(() => setBrief(b), 0);
      return () => clearTimeout(t);
    }
    const openId = consumeSurfaceOpenItem("map");
    if (openId) {
      const m = (useStore.getState().config.craftMaps ?? []).find((x) => x.id === openId);
      if (m) {
        const t = setTimeout(() => { setMap(m); setView("work"); }, 0);
        return () => clearTimeout(t);
      }
    }
  }, []);

  if (!open) return null;

  const generate = async () => {
    const b = brief.trim();
    if (!b || busy) return;
    setBusy(true); setProgress(0);
    try {
      const m = await generateMap({ brief: b, onDelta: (t) => setProgress(t.length) });
      setMap(m); setView("work"); setSelectedId(null);
    } catch (e) {
      addToast(`Kroki üretilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setBusy(false); }
  };

  const patchRoot = (root: CraftMap["root"]) => { if (map) setMap({ ...map, root }); };

  const selected = map && selectedId ? findNode(map.root, selectedId) : null;

  const addBranch = () => {
    if (!map || !selectedId) return;
    if (countNodes(map.root) >= MAX_MAP_NODES) { addToast(`En fazla ${MAX_MAP_NODES} düğüm.`, "info"); return; }
    const child = newNode();
    const next = addChild(map.root, selectedId, child);
    if (next === map.root) { addToast("Bu dala eklenemedi (derinlik/dal sınırı).", "info"); return; }
    patchRoot(next);
    setSelectedId(child.id);
  };

  const removeBranch = () => {
    if (!map || !selectedId || selectedId === map.root.id) return;
    patchRoot(deleteNode(map.root, selectedId));
    setSelectedId(null);
  };

  const aiExpand = async () => {
    if (!map || !selectedId || expanding) return;
    setExpanding(true);
    try {
      const texts = await expandNode(map, selectedId);
      let root = map.root;
      for (const t of texts) root = addChild(root, selectedId, newNode(t));
      patchRoot(root);
    } catch (e) {
      addToast(`Dallandırılamadı: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setExpanding(false); }
  };

  const saveMap = () => { if (map) setMap(save(map, "Kroki kaydedildi.")); };

  const downloadBlob = (content: string, mime: string, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const publish = async () => {
    if (!map) return;
    const url = await publishArtifact(map.title || "kroki", mapToSvg(map), "svg");
    if (url) addToast("Yayınlandı — bağlantı kopyalandı.", "success");
    else addToast("Yayınlama başarısız.", "error");
  };

  const openMap = (m: CraftMap) => { setMap(m); setView("work"); setSavedOpen(false); setSelectedId(null); };

  const layout = map ? layoutMap(map.root) : null;

  const slimActionsRow = view === "work" && map && (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line/60">
      <button onClick={() => { setMap(null); setView("home"); setBrief(""); setSelectedId(null); }} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink shrink-0">+ Yeni</button>
      <input
        value={map.title}
        onChange={(e) => setMap({ ...map, title: e.target.value })}
        placeholder="Kroki başlığı"
        className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold"
        aria-label="Kroki başlığı"
      />
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <button onClick={() => setSavedOpen(true)} title="Projelerim" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
        <button onClick={saveMap} title="Kaydet" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
        <ExportMenu
          options={[
            { key: "svg", label: "SVG indir", icon: <Download size={14} className="text-brand" />, onSelect: () => downloadBlob(mapToSvg(map), "image/svg+xml;charset=utf-8", `${safeFileName(map.title, "kroki")}.svg`) },
            { key: "md", label: "Markdown taslak indir", icon: <Download size={14} className="text-brand" />, onSelect: () => downloadBlob(mapToMarkdown(map), "text/markdown;charset=utf-8", `${safeFileName(map.title, "kroki")}.md`) },
          ]}
        />
        <button onClick={() => void publish()} title="Yayınla — paylaşılabilir bağlantı" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-[#111110] text-xs font-semibold hover:bg-branddim transition-colors"><Network size={13} /> <span className="hidden sm:inline">Yayınla</span></button>
      </div>
    </div>
  );

  const content = (
    <>
      {view === "home" ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-20 flex flex-col gap-5">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">Neyi haritalayalım?</h1>
              <p className="text-muted text-sm mt-1.5 text-balance">Konuyu anlat — craft dalları kursun; tıkla-düzenle, SVG olarak indir/yayınla.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }}
                rows={4}
                placeholder="Örn: Kahve dükkânı açma planı — konum, menü, bütçe, izinler, pazarlama."
                className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[104px]"
              />
              <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                <span className="text-[11px] text-muted/50">Zihin haritası · SVG dışa aktarma · Ücretsiz</span>
                <button
                  onClick={() => void generate()}
                  disabled={busy || !brief.trim()}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Üret
                </button>
              </div>
            </div>
            {busy && <p className="text-center text-xs text-muted/60 animate-pulse">Dallar kurgulanıyor… ({progress} karakter)</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setBrief(s)} className="text-left text-[12.5px] leading-snug px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-muted hover:text-ink transition-colors">{s}</button>
              ))}
            </div>
            {saved.length > 0 && (
              <div className="flex items-center justify-center text-xs text-muted/80">
                <button onClick={() => setSavedOpen(true)} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
                  <FolderOpen size={13} className="text-brand" /> Kayıtlı krokiler ({saved.length})
                </button>
              </div>
            )}
          </div>
        </div>
      ) : map && layout ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Seçili düğüm araç çubuğu */}
          <div className="h-11 shrink-0 flex items-center gap-1.5 px-3 sm:px-4 border-b border-line/60 bg-bgsoft/40">
            {selected ? (
              <>
                <input
                  value={selected.text}
                  onChange={(e) => patchRoot(updateNodeText(map.root, selected.id, e.target.value))}
                  className="flex-1 min-w-0 max-w-sm bg-surface border border-line rounded-lg px-2.5 py-1 text-xs outline-none focus:border-brand/50"
                  aria-label="Düğüm metni"
                />
                <button onClick={addBranch} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-line text-muted hover:text-brand transition-colors" title="Alt dal ekle"><Plus size={12} /> Dal</button>
                <button onClick={() => void aiExpand()} disabled={expanding} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-line text-muted hover:text-brand transition-colors disabled:opacity-40" title="AI ile dallandır">
                  {expanding ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />} Dallandır
                </button>
                {selected.id !== map.root.id && (
                  <button onClick={removeBranch} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-line text-muted hover:text-red transition-colors" title="Dalı sil (alt dallarıyla)"><Trash2 size={12} /> Sil</button>
                )}
              </>
            ) : (
              <span className="text-[11px] text-muted/60">Bir düğüme tıkla: yeniden adlandır, dal ekle, AI ile dallandır.</span>
            )}
            <span className="ml-auto text-[10px] text-muted/40 tabular-nums shrink-0">{countNodes(map.root)}/{MAX_MAP_NODES} düğüm</span>
          </div>

          {/* Kroki tuvali — dışa aktarılan SVG ile aynı yerleşim (layoutMap). */}
          <div className="flex-1 min-h-0 overflow-auto bg-bgsoft/30">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              width={layout.width}
              height={layout.height}
              className="block mx-auto my-4 font-sans"
              role="img"
              aria-label={`Kroki: ${map.title}`}
            >
              {layout.edges.map((e) => (
                <path key={`${e.from}-${e.to}`} d={e.path} fill="none" className="stroke-line" strokeWidth={1.5} />
              ))}
              {layout.nodes.map((n) => {
                const isRoot = n.depth === 0;
                const isSel = n.id === selectedId;
                return (
                  <g key={n.id} onClick={() => setSelectedId(n.id)} className="cursor-pointer" role="button" aria-label={n.text} tabIndex={-1}>
                    <rect
                      x={n.x} y={n.y} width={n.w} height={n.h} rx={8}
                      className={isRoot ? "fill-brand" : n.depth === 1 ? "fill-brand/10" : "fill-surface"}
                      stroke={isSel ? "var(--brand, #5c9478)" : "var(--line, #d9d3c4)"}
                      strokeWidth={isSel ? 2 : 1}
                    />
                    <text
                      x={n.x + n.w / 2} y={n.y + n.h / 2 + 4}
                      textAnchor="middle" fontSize={12.5} fontWeight={isRoot ? 700 : 500}
                      className={isRoot ? "fill-[#111110]" : "fill-ink"}
                    >{n.text.length > 30 ? n.text.slice(0, 29) + "…" : n.text}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : null}

      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Kayıtlı krokiler"
        icon={Network}
        items={saved}
        getKey={(m) => m.id}
        renderRow={(m) => (
          <>
            <div className="text-sm font-semibold truncate">{m.title}</div>
            <div className="text-[11px] text-muted/60">{countNodes(m.root)} düğüm · {new Date(m.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openMap}
        onDelete={(m) => remove(m.id)}
        emptyLabel="Henüz kayıtlı kroki yok."
      />
    </>
  );

  return (
    <>
      {slimActionsRow}
      {content}
    </>
  );
}
