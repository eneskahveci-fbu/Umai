"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowDown, ArrowUp, BarChart3, Download, FolderOpen, GitBranch, Globe, ListChecks, Loader2,
  Plus, Save, Sparkles, Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { friendlyError } from "@/lib/friendlyError";
import { createClient } from "@/lib/supabase/client";
import { consumeSurfaceHandoff, consumeSurfaceOpenItem } from "@/lib/surfaceNav";
import { GenSkeleton } from "./GenSkeleton";
import { RecentWorksStrip } from "./RecentWorksStrip";
import { SavedItemsModal } from "./SavedItemsModal";
import { FormResponsesModal } from "./FormResponses";
import { ExportMenu } from "./ExportMenu";
import { safeFileName } from "./DocsStudio";
import type { CraftForm, FormQuestion, FormQuestionType } from "@/lib/types";
import { CONDITION_SOURCE_QTYPES, FORM_QUESTION_TYPES, formToHtml, generateForm, MAX_FORM_QUESTIONS, newQuestion, OPTION_QTYPES } from "@/lib/forms";
import { downloadTemplate, pickTemplateFile } from "@/lib/templateShare";
import { publishArtifact } from "@/lib/studioExport";
import { useStudioProject } from "@/lib/useStudioProject";
import { CrossTypeRelated } from "./CrossTypeRelated";

/* Anket Stüdyosu — Google Forms'tan İLHAM alan craft yorumu (klon değil):
   brief → yapılandırılmış soru listesi → canlı önizleme → BAĞIMSIZ HTML form.
   Dışa aktarılan form sunucusuz çalışır (yanıtlar dolduranın tarayıcısında,
   CSV indirilebilir); /api/publish ile tek tıkla paylaşılabilir bağlantı.
   Ücretsiz ve anahtarsız (Pollinations tabanı). */

const SUGGESTIONS = [
  "Atölye geri bildirim anketi: içerik, tempo, mekân memnuniyeti",
  "Ürün pazar araştırması: hangi özellik için ne kadar ödenir?",
  "Etkinlik kayıt formu: ad, e-posta, oturum tercihi, diyet kısıtı",
  "Çalışan nabız anketi: motivasyon, iş yükü, öneriler (anonim)",
];

export function FormsStudio() {
  const open = useStore((s) => s.formsStudioOpen);
  const addToast = useStore((s) => s.addToast);
  const { saved, save, remove, confirmDiscard, saveQuiet, recent } = useStudioProject<CraftForm>("craftForms", 40);

  const [view, setView] = useState<"home" | "work">("home");
  const [brief, setBrief] = useState("");
  const [form, setForm] = useState<CraftForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    const b = consumeSurfaceHandoff("forms");
    if (b) {
      const t = setTimeout(() => setBrief(b), 0);
      return () => clearTimeout(t);
    }
    /* ⌘K birleşik arama: belirli bir anketi doğrudan açarak gelinmiş olabilir. */
    const openId = consumeSurfaceOpenItem("forms");
    if (openId) {
      const f = (useStore.getState().config.craftForms ?? []).find((x) => x.id === openId);
      if (f) {
        const t = setTimeout(() => { setForm(f); setView("work"); setPreviewKey((k) => k + 1); }, 0);
        return () => clearTimeout(t);
      }
    }
  }, []);

  if (!open) return null;

  /* updatedAt damgası kaydetme anında vurulur (render saf kalır). */
  const patchForm = (f: CraftForm) => { setForm(f); setPreviewKey((k) => k + 1); };
  const patchQ = (id: string, patch: Partial<FormQuestion>) => {
    if (!form) return;
    patchForm({ ...form, questions: form.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  };

  const generate = async () => {
    const b = brief.trim();
    if (!b || busy) return;
    setBusy(true);
    try {
      const f = await generateForm({ brief: b });
      setForm(f); setView("work");
    } catch (e) {
      addToast(`Anket üretilemedi: ${friendlyError(e instanceof Error ? e.message : "bilinmeyen")}`, "error");
    } finally { setBusy(false); }
  };

  const addQ = () => {
    if (!form) return;
    if (form.questions.length >= MAX_FORM_QUESTIONS) { addToast(`En fazla ${MAX_FORM_QUESTIONS} soru.`, "info"); return; }
    patchForm({ ...form, questions: [...form.questions, newQuestion()] });
  };
  const deleteQ = (id: string) => {
    if (!form || form.questions.length <= 1) return;
    patchForm({ ...form, questions: form.questions.filter((q) => q.id !== id) });
  };
  const moveQ = (id: string, dir: -1 | 1) => {
    if (!form) return;
    const i = form.questions.findIndex((q) => q.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= form.questions.length) return;
    const qs = [...form.questions];
    [qs[i], qs[j]] = [qs[j], qs[i]];
    patchForm({ ...form, questions: qs });
  };

  const changeType = (q: FormQuestion, type: FormQuestionType) => {
    const patch: Partial<FormQuestion> = { type };
    if (OPTION_QTYPES.has(type) && (!q.options || q.options.length < 2)) {
      patch.options = ["Seçenek 1", "Seçenek 2"];
    }
    patchQ(q.id, patch);
  };

  /* Koşul kaynağı adayları: bu sorudan ÖNCEKİ tek-değerli seçim soruları. */
  const conditionSources = (qId: string): FormQuestion[] => {
    if (!form) return [];
    const i = form.questions.findIndex((x) => x.id === qId);
    return form.questions.slice(0, Math.max(0, i)).filter((x) => CONDITION_SOURCE_QTYPES.has(x.type));
  };

  const saveForm = () => {
    if (!form) return;
    setForm(save(form, "Anket kaydedildi."));
  };

  /* Merkezî yanıt toplama için form sahipliği kaydı (published_forms).
     Yalnız girişliyken mümkündür; başarısızlık SESSİZDİR — form her durumda
     sunucusuz (cihaz içi CSV) çalışır, yalnız merkezî toplama açılmaz. */
  const registerForm = async (f: CraftForm): Promise<boolean> => {
    try {
      const sb = createClient();
      if (!sb) return false;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return false;
      const { error } = await sb.from("published_forms").upsert({
        id: f.id,
        owner_id: user.id,
        title: f.title || "Anket",
        questions: f.questions.map((q) => ({ id: q.id, type: q.type, label: q.label, options: q.options ?? null })),
      });
      return !error;
    } catch { return false; }
  };

  const buildExportHtml = async (f: CraftForm): Promise<string> => {
    const collect = await registerForm(f);
    return formToHtml(f, collect ? { collect: { url: `${window.location.origin}/api/forms/respond` } } : undefined);
  };

  const exportHtml = async () => {
    if (!form) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([await buildExportHtml(form)], { type: "text/html;charset=utf-8" }));
    a.download = `${safeFileName(form.title, "anket")}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  /* Paylaşılabilir bağlantı — mevcut /api/publish altyapısı (Stüdyo ile aynı). */
  const publish = async () => {
    if (!form) return;
    const html = await buildExportHtml(form);
    const collecting = html.includes("/api/forms/respond");
    const url = await publishArtifact(form.title || "Umai anketi", html);
    if (url) addToast(collecting ? "Yayınlandı — bağlantı kopyalandı. Yanıtlar 'Yanıtlar' panelinde birikecek." : "Yayınlandı — bağlantı kopyalandı.", "success");
    else addToast("Yayınlama başarısız.", "error");
  };

  const openForm = (f: CraftForm) => { setForm(f); setView("work"); setSavedOpen(false); setPreviewKey((k) => k + 1); };

  /* X — giriş ekranına dönüş. "+ Yeni" ÖNCE onay ister, "← Galeri" ÖNCE
     sessizce kaydeder; eskiden yalnız yıkıcı setForm(null) vardı. */
  const toHome = () => { setForm(null); setView("home"); setBrief(""); };
  const newFormAction = () => { if (confirmDiscard(form, "Bu anket")) toHome(); };
  const backToGallery = () => { saveQuiet(form); toHome(); };
  const removeForm = remove;

  const slimActionsRow = view === "work" && form && (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line/60">
      <button onClick={backToGallery} title="Galeri — çalışman kaydedilir" className="flex items-center gap-1.5 text-xs px-2 py-2 sm:py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft shrink-0 transition-colors"><ArrowLeft size={14} /> <span className="hidden sm:inline font-semibold">Galeri</span></button>
      <button onClick={newFormAction} className="text-xs px-2.5 py-2 sm:py-1 rounded-lg border border-line text-muted hover:text-ink hover:bg-bgsoft shrink-0 transition-colors">+ Yeni</button>
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <button onClick={() => setSavedOpen(true)} title="Projelerim" className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
        <button onClick={saveForm} title="Kaydet" className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
        <button onClick={() => setResponsesOpen(true)} title="Yanıtlar — merkezî toplananlar" className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><BarChart3 size={15} /></button>
        <button
          onClick={() => pickTemplateFile((t) => { if (t.kind === "form") openForm(t.data); else addToast("Bu dosya bir anket şablonu değil.", "error"); }, (m) => addToast(m, "error"))}
          title="Şablon içe aktar (.json)"
          className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"
        ><Download size={15} className="rotate-180" /></button>
        <ExportMenu
          options={[
            { key: "html", label: "Bağımsız HTML indir", icon: <Download size={14} className="text-brand" />, onSelect: () => void exportHtml() },
            { key: "template", label: "Şablon olarak dışa aktar (.json)", icon: <Sparkles size={14} className="text-brand" />, onSelect: () => form && downloadTemplate({ kind: "form", data: form }, form.title), separatorBefore: true },
          ]}
        />
        <button onClick={() => void publish()} title="Yayınla — paylaşılabilir bağlantı" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-[#111110] text-xs font-semibold hover:bg-branddim transition-colors"><Globe size={13} /> <span className="hidden sm:inline">Yayınla</span></button>
      </div>
    </div>
  );

  const content = (
    <>
      {view === "home" ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-20 flex flex-col gap-5">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">Neyi ölçelim?</h1>
              <p className="text-muted text-sm mt-1.5 text-balance">Amacı anlat — Umai tarafsız soruları kursun; bağımsız HTML olarak paylaş, yanıtları CSV al.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }}
                rows={4}
                placeholder="Örn: Kafemizin yeni menüsü hakkında müşteri memnuniyeti anketi — lezzet, fiyat, servis hızı."
                className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[104px]"
              />
              <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                <span className="text-[11px] text-muted/50">Sunucusuz form · CSV yanıt · Ücretsiz</span>
                <button
                  onClick={() => void generate()}
                  disabled={busy || !brief.trim()}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Üret
                </button>
              </div>
            </div>
            {busy && (
              <div className="flex flex-col items-center gap-2.5">
                <GenSkeleton />
                <p className="text-center text-xs text-muted/60">Sorular kurgulanıyor…</p>
              </div>
            )}
            {/* X3 — son çalışmalar: aşağıdaki bağlantı yalnız modalı açıyordu
               (belirli bir işe dönmek iki tık). Şerit doğrudan açar. */}
            <RecentWorksStrip items={recent()} onOpen={openForm} emptyTitle="Adsız anket" />
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setBrief(s)} className="text-left text-[12.5px] leading-snug px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-muted hover:text-ink transition-colors">{s}</button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted/80">
              {saved.length > 0 && (
                <button onClick={() => setSavedOpen(true)} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
                  <FolderOpen size={13} className="text-brand" /> Tüm anketler ({saved.length})
                </button>
              )}
              <button
                onClick={() => pickTemplateFile((t) => { if (t.kind === "form") openForm(t.data); else addToast("Bu dosya bir anket şablonu değil.", "error"); }, (m) => addToast(m, "error"))}
                className="inline-flex items-center gap-1.5 hover:text-ink transition-colors"
              >
                <Download size={13} className="text-brand rotate-180" /> Şablon içe aktar (.json)
              </button>
            </div>
          </div>
        </div>
      ) : form ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Mobil: düzenle/önizle sekmesi */}
          <div className="lg:hidden shrink-0 flex items-center justify-center gap-1 py-2 border-b border-line/60">
            {(["edit", "preview"] as const).map((t) => (
              <button key={t} onClick={() => setMobileTab(t)} className={`px-3 py-1 rounded-lg text-xs font-semibold ${mobileTab === t ? "bg-brand/15 text-brand" : "text-muted"}`}>
                {t === "edit" ? "Düzenle" : "Önizle"}
              </button>
            ))}
          </div>

          {/* Editör */}
          <div className={`flex-1 min-w-0 min-h-0 overflow-y-auto ${mobileTab === "preview" ? "hidden lg:block" : ""}`}>
            <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-3">
              <input
                value={form.title}
                onChange={(e) => patchForm({ ...form, title: e.target.value })}
                placeholder="Anket başlığı"
                className="w-full bg-transparent outline-none text-xl font-extrabold tracking-tight placeholder:text-muted/40"
              />
              <textarea
                value={form.desc ?? ""}
                onChange={(e) => patchForm({ ...form, desc: e.target.value || undefined })}
                placeholder="Kısa açıklama (opsiyonel)"
                rows={2}
                className="w-full bg-transparent outline-none text-sm text-muted resize-none placeholder:text-muted/40"
              />
              {form.questions.map((q, i) => (
                <div key={q.id} className="group/q rounded-xl border border-line/60 hover:border-line bg-surface p-3 space-y-2 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-bold text-muted/50 pt-2 shrink-0 w-5">{i + 1}.</span>
                    <input
                      value={q.label}
                      onChange={(e) => patchQ(q.id, { label: e.target.value })}
                      placeholder="Soru metni"
                      className="flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50"
                    />
                  </div>
                  {OPTION_QTYPES.has(q.type) && (
                    <textarea
                      value={(q.options ?? []).join("\n")}
                      onChange={(e) => patchQ(q.id, { options: e.target.value.split("\n").filter((o) => o.trim()).slice(0, 10) })}
                      rows={Math.max(2, (q.options ?? []).length)}
                      placeholder={"Seçenek 1\nSeçenek 2"}
                      className="w-full ml-7 max-w-[calc(100%-1.75rem)] bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50 resize-none"
                    />
                  )}
                  {/* Koşullu görünürlük — önceki bir choice/dropdown sorusuna bağlanır. */}
                  {conditionSources(q.id).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 ml-7 text-[11px] text-muted">
                      <GitBranch size={11} className="shrink-0 text-muted/60" />
                      <span>Koşul:</span>
                      <select
                        value={q.showIf?.questionId ?? ""}
                        onChange={(e) => {
                          const srcId = e.target.value;
                          if (!srcId) { patchQ(q.id, { showIf: undefined }); return; }
                          const src = form.questions.find((x) => x.id === srcId);
                          patchQ(q.id, { showIf: { questionId: srcId, equals: src?.options?.[0] ?? "" } });
                        }}
                        className="bg-bgsoft border border-line rounded-lg px-2 py-1 outline-none cursor-pointer max-w-[180px] truncate"
                        aria-label="Koşul kaynağı"
                      >
                        <option value="">her zaman göster</option>
                        {conditionSources(q.id).map((src) => (
                          <option key={src.id} value={src.id}>&quot;{src.label.slice(0, 32)}&quot; şuysa:</option>
                        ))}
                      </select>
                      {q.showIf && (
                        <select
                          value={q.showIf.equals}
                          onChange={(e) => patchQ(q.id, { showIf: { questionId: q.showIf!.questionId, equals: e.target.value } })}
                          className="bg-bgsoft border border-line rounded-lg px-2 py-1 outline-none cursor-pointer max-w-[140px] truncate"
                          aria-label="Koşul değeri"
                        >
                          {(form.questions.find((x) => x.id === q.showIf!.questionId)?.options ?? []).map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 ml-7">
                    <select
                      value={q.type}
                      onChange={(e) => changeType(q, e.target.value as FormQuestionType)}
                      className="bg-bgsoft border border-line rounded-lg px-2 py-1 text-[11px] outline-none cursor-pointer"
                      aria-label="Soru türü"
                    >
                      {FORM_QUESTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer">
                      <input type="checkbox" checked={!!q.required} onChange={(e) => patchQ(q.id, { required: e.target.checked || undefined })} /> Zorunlu
                    </label>
                    {i < form.questions.length - 1 && (
                      <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer" title="Bu sorudan sonra yeni sayfa başlat (ilerleme çubuklu, İleri/Geri gezinmeli)">
                        <input type="checkbox" checked={!!q.pageBreakAfter} onChange={(e) => patchQ(q.id, { pageBreakAfter: e.target.checked || undefined })} /> Sayfa sonu
                      </label>
                    )}
                    <div className="ml-auto flex items-center gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/q:opacity-100 transition-opacity">
                      <button onClick={() => moveQ(q.id, -1)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink hover:bg-bgsoft transition-colors" title="Yukarı"><ArrowUp size={12} /></button>
                      <button onClick={() => moveQ(q.id, 1)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-ink hover:bg-bgsoft transition-colors" title="Aşağı"><ArrowDown size={12} /></button>
                      <button onClick={() => deleteQ(q.id)} className="w-6 h-6 grid place-items-center rounded text-muted/50 hover:text-red" title="Sil"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {form.questions.some((q) => q.pageBreakAfter) && (
                <p className="text-[10.5px] text-muted/50 leading-relaxed">
                  Bu ankette sayfa sonu(ları) var — dışa aktarılan formda ilerleme çubuğu ve İleri/Geri
                  gezinmesiyle çok sayfalı olarak açılır.
                </p>
              )}
              <button onClick={addQ} className="flex items-center gap-1.5 text-xs text-muted/60 hover:text-brand transition-colors">
                <Plus size={13} /> Soru ekle
              </button>

              {/* "İlgili" (Obsidian-lite) — yalnız kayıtlı bir ankette, çapraz-tip
                  (sohbet/doküman/defter dahil) arar. */}
              {saved.some((f) => f.id === form.id) && (
                <div className="mt-6 border-t border-line/60 pt-4">
                  <CrossTypeRelated kind="form" id={form.id} />
                </div>
              )}
            </div>
          </div>

          {/* Canlı önizleme — dışa aktarılacak HTML'in birebir kendisi. */}
          <div className={`flex-1 min-w-0 min-h-0 border-t lg:border-t-0 lg:border-l border-line/60 bg-bgsoft/40 ${mobileTab === "edit" ? "hidden lg:block" : ""}`}>
            <iframe key={previewKey} srcDoc={formToHtml(form)} title="Anket önizleme" sandbox="allow-scripts" className="w-full h-full border-0" />
          </div>
        </div>
      ) : null}

      {/* Kayıtlı anketler */}
      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Kayıtlı anketler"
        icon={ListChecks}
        items={saved}
        getKey={(f) => f.id}
        renderRow={(f) => (
          <>
            <div className="text-sm font-semibold truncate">{f.title}</div>
            <div className="text-[11px] text-muted/60">{f.questions.length} soru · {new Date(f.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openForm}
        onDelete={(f) => removeForm(f.id)}
        onExportTemplate={(f) => downloadTemplate({ kind: "form", data: f }, f.title)}
        emptyLabel="Henüz kayıtlı anket yok."
      />

      {/* Merkezî yanıt özeti (form_responses — yalnız form sahibi görür).
          Kapanış animasyonu oynayabilsin diye artık `form` var olduğu sürece
          mounted kalır; iç state açılışta kendi sıfırlanır (bkz. FormResponses.tsx). */}
      {form && <FormResponsesModal form={form} open={responsesOpen} onClose={() => setResponsesOpen(false)} />}
    </>
  );

  return (
    <>
      {slimActionsRow}
      {content}
    </>
  );
}
