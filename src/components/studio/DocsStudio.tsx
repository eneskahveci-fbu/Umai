"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Download, FileCode, FileText, FolderOpen, Lightbulb, Loader2,
  Plus, Save, SpellCheck, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { consumeSurfaceHandoff, consumeSurfaceOpenItem } from "@/lib/surfaceNav";
import { SavedItemsModal } from "./SavedItemsModal";
import { ExportMenu } from "./ExportMenu";
import { CrossTypeRelated } from "./CrossTypeRelated";
import type { CraftDoc, DocBlock, DocBlockType } from "@/lib/types";
import {
  continueDoc, DOC_BLOCK_TYPES, docToHtml, docToMarkdown, generateDoc,
  MAX_DOC_BLOCKS, newBlock,
} from "@/lib/docs";
import { downloadTemplate, pickTemplateFile } from "@/lib/templateShare";
import { useStudioProject } from "@/lib/useStudioProject";
import { applyIssue, proofread, type ProofIssue } from "@/lib/proofread";

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
  const addToast = useStore((s) => s.addToast);
  const { saved, save, remove } = useStudioProject<CraftDoc>("craftDocs", 40);

  const [view, setView] = useState<"home" | "work">("home");
  const [brief, setBrief] = useState("");
  const [doc, setDoc] = useState<CraftDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [contBusy, setContBusy] = useState(false);
  const [contText, setContText] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);
  /* Yazım Asistanı: doğrulanmış öneriler + uygulanacakları blok id'leri. */
  const [proofBusy, setProofBusy] = useState(false);
  const [proofRows, setProofRows] = useState<{ issue: ProofIssue; blockId: string }[] | null>(null);

  /* Hub'dan taşınan brief'i al (tek stüdyo hissi). */
  useEffect(() => {
    const b = consumeSurfaceHandoff("docs");
    if (b) {
      const t = setTimeout(() => setBrief(b), 0);
      return () => clearTimeout(t);
    }
    /* ⌘K birleşik arama: belirli bir dokümanı doğrudan açarak gelinmiş olabilir. */
    const openId = consumeSurfaceOpenItem("docs");
    if (openId) {
      const doc = (useStore.getState().config.craftDocs ?? []).find((d) => d.id === openId);
      if (doc) {
        const t = setTimeout(() => { setDoc(doc); setView("work"); }, 0);
        return () => clearTimeout(t);
      }
    }
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
    setDoc(save(doc, "Doküman kaydedildi."));
  };

  /* ── Yazım Asistanı (Grammarly'den ilham) ─────────────────────────────
     Metin taşıyan bloklar denetlenir (kod/görsel/ayraç hariç); öneriler
     validateIssues'tan DOĞRULANMIŞ gelir, yine de uygulama anında blok
     metni değişmişse applyIssue null döner ve öneri düşürülür. */
  const PROOF_TYPES: DocBlockType[] = ["h1", "h2", "h3", "p", "bullet", "todo", "quote", "callout"];

  const runProofread = async () => {
    if (!doc || proofBusy) return;
    const segBlocks = doc.blocks.filter((b) => PROOF_TYPES.includes(b.type) && b.text.trim());
    if (!segBlocks.length) { addToast("Denetlenecek metin yok.", "info"); return; }
    setProofBusy(true);
    try {
      const issues = await proofread(segBlocks.map((b) => b.text));
      if (!issues.length) { setProofRows(null); addToast("Sorun bulunamadı — metin temiz.", "success"); }
      else setProofRows(issues.map((issue) => ({ issue, blockId: segBlocks[issue.blockIndex].id })));
    } catch (e) {
      addToast(`Denetim başarısız: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setProofBusy(false); }
  };

  const dropProofRow = (row: { issue: ProofIssue; blockId: string }) => {
    setProofRows((rows) => {
      const next = (rows ?? []).filter((r) => r !== row);
      return next.length ? next : null;
    });
  };

  const applyProofRow = (row: { issue: ProofIssue; blockId: string }) => {
    if (!doc) return;
    const block = doc.blocks.find((b) => b.id === row.blockId);
    const next = block ? applyIssue(block.text, row.issue) : null;
    if (next === null) addToast("Metin değişmiş — öneri uygulanamadı.", "info");
    else patchBlock(row.blockId, { text: next });
    dropProofRow(row);
  };

  const applyAllProof = () => {
    if (!doc || !proofRows) return;
    let blocks = doc.blocks;
    let applied = 0;
    for (const row of proofRows) {
      const block = blocks.find((b) => b.id === row.blockId);
      const next = block ? applyIssue(block.text, row.issue) : null;
      if (next !== null) {
        blocks = blocks.map((b) => (b.id === row.blockId ? { ...b, text: next } : b));
        applied++;
      }
    }
    patchDoc({ ...doc, blocks });
    setProofRows(null);
    addToast(`${applied}/${proofRows.length} öneri uygulandı.`, "success");
  };

  const openDoc = (d: CraftDoc) => { setDoc(d); setView("work"); setSavedOpen(false); };
  const removeDoc = remove;

  const blockInput = (b: DocBlock) => {
    const common = "w-full bg-transparent outline-none placeholder:text-muted/40";
    switch (b.type) {
      case "h1":
        return <input value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Başlık 1" className={`${common} text-xl font-extrabold tracking-tight`} />;
      case "h2":
        return <input value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Başlık 2" className={`${common} text-base font-bold`} />;
      case "h3":
        return <input value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Başlık 3" className={`${common} text-sm font-bold`} />;
      case "callout":
        return (
          <div className="flex items-start gap-2 bg-brand/5 border border-brand/20 rounded-lg px-3 py-2">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-brand" />
            <textarea value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Bilgi kutusu" rows={2} className={`${common} text-sm resize-none`} />
          </div>
        );
      case "image":
        return (
          <div className="space-y-1.5">
            <input
              value={b.text}
              onChange={(e) => patchBlock(b.id, { text: e.target.value })}
              placeholder="https://… (görsel URL'i)"
              className={`${common} text-xs font-mono bg-bgsoft border border-line rounded-lg px-3 py-2`}
            />
            {/^https?:\/\//i.test(b.text) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.text} alt="" loading="lazy" className="max-w-full max-h-64 rounded-lg border border-line/60" />
            )}
          </div>
        );
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

  const slimActionsRow = view === "work" && doc && (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line/60">
      <button onClick={() => { setDoc(null); setView("home"); setBrief(""); }} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink shrink-0">+ Yeni</button>
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <button onClick={() => setSavedOpen(true)} title="Projelerim" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
        <button onClick={saveDoc} title="Kaydet" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
        <button onClick={() => void runProofread()} title="Yazım denetimi (AI)" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors disabled:opacity-40" disabled={proofBusy}>
          {proofBusy ? <Loader2 size={15} className="animate-spin" /> : <SpellCheck size={15} />}
        </button>
        <button
          onClick={() => pickTemplateFile((t) => { if (t.kind === "doc") openDoc(t.data); else addToast("Bu dosya bir doküman şablonu değil.", "error"); }, (m) => addToast(m, "error"))}
          title="Şablon içe aktar (.json)"
          className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"
        ><Download size={15} className="rotate-180" /></button>
        <ExportMenu
          options={[
            { key: "md", label: "Markdown indir", icon: <Download size={14} className="text-brand" />, onSelect: () => doc && download(`${safeFileName(doc.title, "dokuman")}.md`, docToMarkdown(doc), "text/markdown;charset=utf-8") },
            { key: "html", label: "Bağımsız HTML indir", icon: <FileCode size={14} className="text-brand" />, onSelect: () => doc && download(`${safeFileName(doc.title, "dokuman")}.html`, docToHtml(doc), "text/html;charset=utf-8") },
            { key: "template", label: "Şablon olarak dışa aktar (.json)", icon: <Sparkles size={14} className="text-brand" />, onSelect: () => doc && downloadTemplate({ kind: "doc", data: doc }, doc.title), separatorBefore: true },
          ]}
        />
      </div>
    </div>
  );

  const content = (
    <>
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
            {/* Yazım Asistanı önerileri */}
            {proofRows && (
              <div className="mb-5 rounded-xl border border-brand/25 bg-brand/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-brand/80 flex items-center gap-1.5">
                    <SpellCheck size={12} /> Yazım denetimi — {proofRows.length} öneri
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={applyAllProof} className="text-[11px] px-2 py-1 rounded-lg bg-brand text-[#111110] font-semibold hover:bg-branddim transition-colors">Tümünü uygula</button>
                    <button onClick={() => setProofRows(null)} aria-label="Kapat" className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink"><X size={12} /></button>
                  </div>
                </div>
                {proofRows.map((row, i) => (
                  <div key={`${row.blockId}-${i}`} className="flex items-start gap-2 text-[12px] bg-surface border border-line/60 rounded-lg px-2.5 py-2">
                    <span className="shrink-0 text-[9.5px] uppercase tracking-wide font-bold text-muted/50 border border-line rounded px-1 py-0.5 mt-0.5">
                      {row.issue.kind === "dilbilgisi" ? "Dilbilgisi" : row.issue.kind === "noktalama" ? "Noktalama" : row.issue.kind === "uslup" ? "Üslup" : "Yazım"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="line-through text-red/80">{row.issue.find}</span>
                      {" → "}
                      <span className="text-green font-medium">{row.issue.replace}</span>
                      {row.issue.reason && <span className="block text-[10.5px] text-muted/60 mt-0.5">{row.issue.reason}</span>}
                    </span>
                    <button onClick={() => applyProofRow(row)} aria-label="Öneriyi uygula" title="Uygula" className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-green shrink-0"><Check size={13} /></button>
                    <button onClick={() => dropProofRow(row)} aria-label="Öneriyi yoksay" title="Yoksay" className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink shrink-0"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {doc.blocks.map((b) => (
                <div key={b.id} className="group/blk flex items-start gap-1.5 -mx-2 px-2 py-0.5 rounded-lg hover:bg-bgsoft/40 transition-colors">
                  <div className="flex-1 min-w-0 pt-0.5">{blockInput(b)}</div>
                  {/* Blok kontrolleri — yalnız üzerine gelince (sakin görünüm). */}
                  <div className="flex items-center gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/blk:opacity-100 transition-opacity shrink-0">
                    <select
                      value={b.type}
                      onChange={(e) => patchBlock(b.id, { type: e.target.value as DocBlockType })}
                      className="bg-bgsoft border border-line rounded-md px-1 py-0.5 text-[10px] text-muted outline-none cursor-pointer"
                      aria-label="Blok türü"
                    >
                      {DOC_BLOCK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button onClick={() => moveBlock(b.id, -1)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink hover:bg-bgsoft transition-colors" title="Yukarı"><ArrowUp size={12} /></button>
                    <button onClick={() => moveBlock(b.id, 1)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink hover:bg-bgsoft transition-colors" title="Aşağı"><ArrowDown size={12} /></button>
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

            {/* "İlgili" (Obsidian-lite) — yalnız kayıtlı bir dokümanda, çapraz-tip
                (sohbet/anket/defter dahil) arar. */}
            {saved.some((d) => d.id === doc.id) && (
              <div className="mt-6 border-t border-line/60 pt-4">
                <CrossTypeRelated kind="doc" id={doc.id} />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Kayıtlı dokümanlar */}
      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Kayıtlı dokümanlar"
        icon={FileText}
        items={saved}
        getKey={(d) => d.id}
        renderRow={(d) => (
          <>
            <div className="text-sm font-semibold truncate">{d.title}</div>
            <div className="text-[11px] text-muted/60">{d.blocks.length} blok · {new Date(d.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openDoc}
        onDelete={(d) => removeDoc(d.id)}
        onExportTemplate={(d) => downloadTemplate({ kind: "doc", data: d }, d.title)}
        emptyLabel="Henüz kayıtlı doküman yok."
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

