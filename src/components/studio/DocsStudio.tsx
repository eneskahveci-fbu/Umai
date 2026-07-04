"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, Download, FileCode, FileText, FolderOpen, Loader2,
  Plus, Save, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { consumeSurfaceHandoff, useSurfaceNav } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./StudioSwitcher";
import type { CraftDoc, DocBlock, DocBlockType } from "@/lib/types";
import {
  continueDoc, DOC_BLOCK_TYPES, docToHtml, docToMarkdown, generateDoc,
  MAX_DOC_BLOCKS, newBlock,
} from "@/lib/docs";
import { downloadTemplate, pickTemplateFile } from "@/lib/templateShare";

/* Doküman Stüdyosu — Notion'dan İLHAM alan craft yorumu (klon değil):
   doküman = düzenlenebilir blok listesi. AI taslağı JSON bloklar olarak üretir;
   kullanıcı blok blok düzenler; Markdown ve bağımsız HTML olarak dışa aktarır.
   Ücretsiz ve anahtarsız çalışır (Pollinations tabanı). */

const SUGGESTIONS = [
  "Toplantı notu şablonu: haftalık ürün ekibi — gündem, kararlar, aksiyonlar",
  "PRD taslağı: mobil uygulamaya karanlık tema özelliği",
  "Ders notu: Türev nedir? — lise seviyesinde, örneklerle",
  "Onboarding rehberi: ekibe yeni katılan geliştirici için ilk hafta",
];

function download(name: string, content: string, mime: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function safeFileName(s: string, fallback: string): string {
  return (s || "").replace(/[^\wğüşöçıİĞÜŞÖÇ -]/g, "").trim() || fallback;
}

export function DocsStudio() {
  const open = useStore((s) => s.docsStudioOpen);
  const nav = useSurfaceNav();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const [view, setView] = useState<"home" | "work">("home");
  const [brief, setBrief] = useState("");
  const [doc, setDoc] = useState<CraftDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [contBusy, setContBusy] = useState(false);
  const [contText, setContText] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);

  /* Hub'dan taşınan brief'i al (tek stüdyo hissi). */
  useEffect(() => {
    const b = consumeSurfaceHandoff("docs");
    if (!b) return;
    const id = setTimeout(() => setBrief(b), 0);
    return () => clearTimeout(id);
  }, []);

  if (!open) return null;

  /* updatedAt damgası kaydetme anında vurulur (render saf kalır). */
  const patchDoc = (d: CraftDoc) => setDoc(d);
  const patchBlock = (id: string, patch: Partial<DocBlock>) => {
    if (!doc) return;
    patchDoc({ ...doc, blocks: doc.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  const generate = async () => {
    const b = brief.trim();
    if (!b || busy) return;
    setBusy(true); setProgress(0);
    try {
      const d = await generateDoc({ brief: b, onDelta: (t) => setProgress(t.length) });
      setDoc(d); setView("work");
    } catch (e) {
      addToast(`Doküman üretilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setBusy(false); }
  };

  const addBlockAfter = (afterId: string | null, type: DocBlockType = "p") => {
    if (!doc) return;
    if (doc.blocks.length >= MAX_DOC_BLOCKS) { addToast(`En fazla ${MAX_DOC_BLOCKS} blok.`, "info"); return; }
    const nb = newBlock(type, "");
    const blocks = [...doc.blocks];
    const i = afterId ? blocks.findIndex((b) => b.id === afterId) : blocks.length - 1;
    blocks.splice(i + 1, 0, nb);
    patchDoc({ ...doc, blocks });
  };

  const deleteBlock = (id: string) => {
    if (!doc || doc.blocks.length <= 1) return;
    patchDoc({ ...doc, blocks: doc.blocks.filter((b) => b.id !== id) });
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    if (!doc) return;
    const i = doc.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    patchDoc({ ...doc, blocks });
  };

  const continueWithAI = async () => {
    if (!doc || contBusy) return;
    setContBusy(true);
    try {
      const extra = await continueDoc(doc, contText.trim());
      patchDoc({ ...doc, blocks: [...doc.blocks, ...extra].slice(0, MAX_DOC_BLOCKS) });
      setContText("");
    } catch (e) {
      addToast(`Devam üretilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setContBusy(false); }
  };

  const saveDoc = () => {
    if (!doc) return;
    const stamped = { ...doc, updatedAt: Date.now() };
    setDoc(stamped);
    const existing = config.craftDocs ?? [];
    saveConfig({ ...config, craftDocs: [stamped, ...existing.filter((d) => d.id !== doc.id)].slice(0, 40) });
    addToast("Doküman kaydedildi.", "success");
  };

  const openDoc = (d: CraftDoc) => { setDoc(d); setView("work"); setSavedOpen(false); };
  const removeDoc = (id: string) =>
    saveConfig({ ...config, craftDocs: (config.craftDocs ?? []).filter((d) => d.id !== id) });

  const saved = config.craftDocs ?? [];

  const blockInput = (b: DocBlock) => {
    const common = "w-full bg-transparent outline-none placeholder:text-muted/40";
    switch (b.type) {
      case "h1":
        return <input value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Başlık 1" className={`${common} text-xl font-extrabold tracking-tight`} />;
      case "h2":
        return <input value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Başlık 2" className={`${common} text-base font-bold`} />;
      case "quote":
        return (
          <div className="border-l-[3px] border-brand/60 pl-3">
            <textarea value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Alıntı" rows={2} className={`${common} text-sm italic text-muted resize-none`} />
          </div>
        );
      case "code":
        return <textarea value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="kod" rows={3} className={`${common} font-mono text-xs bg-bgsoft border border-line rounded-lg px-3 py-2 resize-y`} />;
      case "divider":
        return <hr className="border-line/60 my-1" />;
      case "bullet":
        return (
          <div className="flex items-start gap-2">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
            <textarea value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Madde" rows={1} className={`${common} text-sm resize-none`} />
          </div>
        );
      case "todo":
        return (
          <div className="flex items-start gap-2">
            <input type="checkbox" checked={!!b.checked} onChange={(e) => patchBlock(b.id, { checked: e.target.checked })} className="mt-1 accent-[var(--tw-brand,#fbbf24)] shrink-0" />
            <textarea value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Yapılacak" rows={1} className={`${common} text-sm resize-none ${b.checked ? "line-through text-muted/60" : ""}`} />
          </div>
        );
      default:
        return <textarea value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Yazmaya başla…" rows={2} className={`${common} text-sm leading-relaxed resize-none`} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Üst bar */}
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        <div className="flex items-center gap-1.5 text-sm font-bold shrink-0">
          <FileText size={15} className="text-brand" /> <span className="hidden sm:inline">Doküman</span>
        </div>
        <StudioSwitcher active="docs" />
        {view === "work" && doc && (
          <>
            <button onClick={() => { setDoc(null); setView("home"); setBrief(""); }} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink ml-1 shrink-0">+ Yeni</button>
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <button onClick={saveDoc} title="Kaydet" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
              <button onClick={() => download(`${safeFileName(doc.title, "dokuman")}.md`, docToMarkdown(doc), "text/markdown;charset=utf-8")} title="Markdown indir" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Download size={15} /></button>
              <button onClick={() => download(`${safeFileName(doc.title, "dokuman")}.html`, docToHtml(doc), "text/html;charset=utf-8")} title="Bağımsız HTML indir (yazdır → PDF)" className="hidden sm:grid w-8 h-8 place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FileCode size={15} /></button>
            </div>
          </>
        )}
        <button onClick={() => nav.close()} className={`${view === "work" ? "" : "ml-auto"} w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0`} title="Kapat"><X size={16} /></button>
      </div>

      {view === "home" ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-20 flex flex-col gap-5">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">Ne yazalım?</h1>
              <p className="text-muted text-sm mt-1.5 text-balance">Konuyu anlat — craft blok blok kursun; sen düzenle, Markdown/HTML olarak al.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }}
                rows={4}
                placeholder="Örn: Yeni başlayanlar için Git rehberi — temel kavramlar, günlük komutlar, sık hatalar."
                className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[104px]"
              />
              <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                <span className="text-[11px] text-muted/50">Blok tabanlı · Markdown & HTML dışa aktarma · Ücretsiz</span>
                <button
                  onClick={() => void generate()}
                  disabled={busy || !brief.trim()}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Üret
                </button>
              </div>
            </div>
            {busy && <p className="text-center text-xs text-muted/60 animate-pulse">Doküman kurgulanıyor… ({progress} karakter)</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setBrief(s)} className="text-left text-[12.5px] leading-snug px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-muted hover:text-ink transition-colors">{s}</button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted/80">
              {saved.length > 0 && (
                <button onClick={() => setSavedOpen(true)} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
                  <FolderOpen size={13} className="text-brand" /> Kayıtlı dokümanlar ({saved.length})
                </button>
              )}
              <button
                onClick={() => pickTemplateFile((t) => { if (t.kind === "doc") openDoc(t.data); else addToast("Bu dosya bir doküman şablonu değil.", "error"); }, (m) => addToast(m, "error"))}
                className="inline-flex items-center gap-1.5 hover:text-ink transition-colors"
              >
                <Download size={13} className="text-brand rotate-180" /> Şablon içe aktar (.json)
              </button>
            </div>
          </div>
        </div>
      ) : doc ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            <input
              value={doc.title}
              onChange={(e) => patchDoc({ ...doc, title: e.target.value })}
              placeholder="Doküman başlığı"
              className="w-full bg-transparent outline-none text-2xl sm:text-3xl font-extrabold tracking-tight placeholder:text-muted/40 mb-6"
            />
            <div className="space-y-1.5">
              {doc.blocks.map((b) => (
                <div key={b.id} className="group/blk flex items-start gap-1.5 -mx-2 px-2 py-0.5 rounded-lg hover:bg-bgsoft/40 transition-colors">
                  <div className="flex-1 min-w-0 pt-0.5">{blockInput(b)}</div>
                  {/* Blok kontrolleri — yalnız üzerine gelince (sakin görünüm). */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/blk:opacity-100 transition-opacity shrink-0">
                    <select
                      value={b.type}
                      onChange={(e) => patchBlock(b.id, { type: e.target.value as DocBlockType })}
                      className="bg-bgsoft border border-line rounded-md px-1 py-0.5 text-[10px] text-muted outline-none cursor-pointer"
                      aria-label="Blok türü"
                    >
                      {DOC_BLOCK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button onClick={() => moveBlock(b.id, -1)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink" title="Yukarı"><ArrowUp size={12} /></button>
                    <button onClick={() => moveBlock(b.id, 1)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink" title="Aşağı"><ArrowDown size={12} /></button>
                    <button onClick={() => addBlockAfter(b.id)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-brand" title="Altına blok ekle"><Plus size={12} /></button>
                    <button onClick={() => deleteBlock(b.id)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-red" title="Sil"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => addBlockAfter(null)} className="mt-3 flex items-center gap-1.5 text-xs text-muted/60 hover:text-brand transition-colors">
              <Plus size={13} /> Blok ekle
            </button>

            {/* AI ile devam — dokümanın sonuna akışa uygun bloklar ekler. */}
            <div className="mt-8 border-t border-line/60 pt-4 flex gap-1.5">
              <input
                value={contText}
                onChange={(e) => setContText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void continueWithAI(); }}
                placeholder="AI ile devam et — örn: 'sık sorulan sorular bölümü ekle'"
                className="flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-brand/50"
              />
              <button onClick={() => void continueWithAI()} disabled={contBusy} className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg bg-brand/15 text-brand text-xs font-semibold hover:bg-brand/25 disabled:opacity-40 transition-colors">
                {contBusy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Devam et
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Kayıtlı dokümanlar */}
      {savedOpen && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-bg" onClick={() => setSavedOpen(false)}>
          <div className="w-full max-w-lg max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold flex items-center gap-1.5"><FileText size={14} className="text-brand" /> Kayıtlı dokümanlar</h2>
              <button onClick={() => setSavedOpen(false)} className="w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={14} /></button>
            </div>
            {saved.length === 0 && <p className="text-xs text-muted/60">Henüz kayıtlı doküman yok.</p>}
            {saved.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line/60 hover:border-brand/40 transition-colors">
                <button onClick={() => openDoc(d)} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate">{d.title}</div>
                  <div className="text-[11px] text-muted/60">{d.blocks.length} blok · {new Date(d.updatedAt).toLocaleDateString("tr-TR")}</div>
                </button>
                <button onClick={() => downloadTemplate({ kind: "doc", data: d }, d.title)} className="w-7 h-7 grid place-items-center rounded-lg text-muted/50 hover:text-brand" title="Şablon olarak dışa aktar (.json)"><Download size={13} /></button>
                <button onClick={() => removeDoc(d.id)} className="w-7 h-7 grid place-items-center rounded-lg text-muted/50 hover:text-red" title="Sil"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
