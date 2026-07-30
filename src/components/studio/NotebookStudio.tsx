"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, FileText, FolderOpen, Globe, GraduationCap, HelpCircle, Link2, Loader2, Plus, Save, Send,
  Sparkles, Trash2, Users, Volume2, VolumeX,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { friendlyErrorFrom } from "@/lib/friendlyError";
import { SavedItemsModal } from "./SavedItemsModal";
import type { CraftNotebook, NotebookSource } from "@/lib/types";
import { streamChat } from "@/lib/genChat";
import { playPodcast, playTts, stopPodcast, stopTts, TTS_MAX_CHARS, TTS_VOICES } from "@/lib/pollinations";
import { parsePodcastScript } from "@/lib/podcast";
import { useStudioProject } from "@/lib/useStudioProject";
import { consumeSurfaceOpenItem } from "@/lib/surfaceNav";
import { CrossTypeRelated } from "./CrossTypeRelated";
import { RecentWorksStrip } from "./RecentWorksStrip";
import { parseCitations } from "@/lib/citations";

/* Defter — NotebookLM'den İLHAM alan craft yorumu (klonu değil): metin/URL
   kaynakları ekle → yalnız o kaynaklardan yanıtlayan sohbet ([1] [2] atıflı)
   → Pollinations TTS ile "sesli özet" (tekli ses) veya "podcast özeti" (iki
   sunuculu, dönüşümlü sesli diyalog — NotebookLM'in "audio overview"ından
   ilham). URL'ler mevcut /api/fetch-text proxy'sinden çekilir (SSRF
   korumalı). Ücretsiz ve anahtarsız çalışır. */

const MAX_SOURCES = 8;
const PER_SOURCE_CHARS = 8000;
const TOTAL_CONTEXT_CHARS = 24000;

interface NbMsg { role: "user" | "assistant"; content: string; }

function newSourceId(): string {
  return `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Sohbet sistem promptu: kaynaklara SADIK kal, [n] ile atıf ver. */
export function buildNotebookSystem(sources: NotebookSource[]): string {
  const on = sources.filter((s) => s.enabled && s.text.trim());
  let budget = TOTAL_CONTEXT_CHARS;
  const parts: string[] = [];
  on.forEach((s, i) => {
    const take = Math.min(PER_SOURCE_CHARS, budget);
    if (take <= 0) return;
    const text = s.text.slice(0, take);
    budget -= text.length;
    parts.push(`[${i + 1}] ${s.name}\n${text}`);
  });
  return (
    "Sen kaynak-temelli bir araştırma asistanısın. YALNIZCA aşağıdaki KAYNAKLARDAN yanıt ver; " +
    "kaynaklarda olmayan bilgiyi EKLEME, bilmiyorsan 'kaynaklarda yok' de. " +
    "Her iddianın sonuna köşeli parantezle kaynak numarası koy (ör. [1], [2]). " +
    "Türkçe, net ve öz yanıtla.\n\n=== KAYNAKLAR ===\n\n" + parts.join("\n\n---\n\n")
  );
}

export function NotebookStudio() {
  const open = useStore((s) => s.notebookStudioOpen);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);
  const { saved, save: saveNbItem, remove: removeNb, recent } = useStudioProject<CraftNotebook>("craftNotebooks", 20);

  const [nbId, setNbId] = useState<string>(() => `nb_${Date.now().toString(36)}`);
  const [title, setTitle] = useState("Yeni defter");
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [msgs, setMsgs] = useState<NbMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [speaking, setSpeaking] = useState(false);
  /* Sesli özet üretimi `busy`'den AYRI izlenir — normal bir soru sorulurken
     "Sesli özet" butonu ilgisiz şekilde grileşmesin (yalnız kendi üretimi
     sırasında disabled olsun). */
  const [narrating, setNarrating] = useState(false);
  /* Podcast özeti (2 sunuculu) — sesli özetin aynı ayrımıyla, KENDİ üretim/
     çalma durumunu izler ki tek-sesli özetten bağımsız disable/spinner davransın. */
  const [podcasting, setPodcasting] = useState(false);
  const [playingPodcast, setPlayingPodcast] = useState(false);
  /* Hızlı üretim (NotebookLM'in "Notebook guide" fikrinden ilham) — çalışma
     rehberi/SSS'in KENDİ üretim durumu, diğer eylemlerden bağımsız disable/
     spinner davransın diye ayrı izlenir (podcast/sesli özetin aynı deseni). */
  const [guideBusy, setGuideBusy] = useState(false);
  const [faqBusy, setFaqBusy] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [srcPanel, setSrcPanel] = useState(true);
  /* Tıklanabilir atıf → kaynağa atlama: kısa süreliğine vurgulanan kaynak id'si
     + (mobilde panel gizliyken) kaynak paneli açılana kadar bekleyen scroll hedefi. */
  const [flashSourceId, setFlashSourceId] = useState<string | null>(null);
  const sourceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingScrollRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  useEffect(() => () => { stopPodcast(); abortRef.current?.abort(); }, []);

  /* Kaynak paneli mobilde gizliyken bir atıfa tıklanırsa: önce paneli aç,
     görünür olduğu bir sonraki frame'de kaynağa kaydır (gizliyken scrollIntoView
     hiçbir şey yapmaz — display:none'ın layout kutusu yok). */
  useEffect(() => {
    if (srcPanel && pendingScrollRef.current) {
      const id = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => sourceRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }, [srcPanel]);

  /* ⌘K birleşik arama: belirli bir defteri doğrudan açarak gelinmiş olabilir. */
  useEffect(() => {
    const openId = consumeSurfaceOpenItem("notebook");
    if (!openId) return;
    const n = (useStore.getState().config.craftNotebooks ?? []).find((x) => x.id === openId);
    if (!n) return;
    const t = setTimeout(() => { setNbId(n.id); setTitle(n.title); setSources(n.sources); setMsgs([]); }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  /* buildNotebookSystem'in numaralandırdığı AYNI sırayla — atıf [n], bu
     dizinin n'inci öğesine karşılık gelir (yalnız etkin+dolu kaynaklar). */
  const enabledSources = sources.filter((s) => s.enabled && s.text.trim());
  const enabledCount = enabledSources.length;

  /** Sohbetteki [n] atıfına tıklanınca: kaynağı kısaca vurgula + görünür
      panele kaydır (mobilde panel gizliyken önce paneli aç). */
  const jumpToSource = (citationIndex: number) => {
    const src = enabledSources[citationIndex - 1];
    if (!src) return;
    setFlashSourceId(src.id);
    window.setTimeout(() => setFlashSourceId((cur) => (cur === src.id ? null : cur)), 1600);
    if (!srcPanel) { pendingScrollRef.current = src.id; setSrcPanel(true); }
    else sourceRefs.current.get(src.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const addPaste = () => {
    const t = pasteText.trim();
    if (!t) return;
    if (sources.length >= MAX_SOURCES) { addToast(`En fazla ${MAX_SOURCES} kaynak.`, "info"); return; }
    const name = t.split("\n")[0].slice(0, 48) || "Yapıştırılan metin";
    setSources((s) => [...s, { id: newSourceId(), name, text: t, enabled: true }]);
    setPasteText("");
  };

  const addUrl = async () => {
    const u = urlInput.trim();
    if (!u || fetching) return;
    if (sources.length >= MAX_SOURCES) { addToast(`En fazla ${MAX_SOURCES} kaynak.`, "info"); return; }
    setFetching(true);
    try {
      const res = await fetch(`/api/fetch-text?url=${encodeURIComponent(u)}`);
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error || `Hata ${res.status}`);
      const name = u.replace(/^https?:\/\//, "").slice(0, 48);
      setSources((s) => [...s, { id: newSourceId(), name, text: data.text!, url: u, enabled: true }]);
      setUrlInput("");
    } catch (e) {
      addToast(`URL getirilemedi: ${friendlyErrorFrom(e)}`, "error");
    } finally { setFetching(false); }
  };

  /* PDF: istemcide metni çıkar (pdf.js, veri sunucuya gitmez) — CoderView'daki
     dosya-ekleme akışıyla aynı mantık. */
  const addFile = async (f: File) => {
    if (sources.length >= MAX_SOURCES) { addToast(`En fazla ${MAX_SOURCES} kaynak.`, "info"); return; }
    if (f.size > 20_000_000) { addToast("PDF 20MB'den büyük.", "error"); return; }
    setPdfBusy(true);
    try {
      const { extractPdfText } = await import("@/lib/pdf");
      const text = await extractPdfText(f);
      setSources((s) => [...s, { id: newSourceId(), name: f.name, text, enabled: true }]);
    } catch (e) {
      addToast(`PDF okunamadı: ${friendlyErrorFrom(e)}`, "error");
    } finally { setPdfBusy(false); }
  };

  const ask = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || busy || narrating || podcasting || speaking || playingPodcast || guideBusy || faqBusy) return;
    if (!enabledCount) { addToast("Önce en az bir kaynak ekle.", "info"); return; }
    setInput("");
    setBusy(true);
    const history: NbMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      await streamChat({
        system: buildNotebookSystem(sources),
        messages: history,
        temperature: 0.3,
        signal: ac.signal,
        onDelta: (full) => setMsgs([...history, { role: "assistant", content: full }]),
      });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setMsgs([...history, { role: "assistant", content: `Hata: ${friendlyErrorFrom(e)}` }]);
      }
    } finally { setBusy(false); abortRef.current = null; }
  };

  /* Sesli özet — NotebookLM'in "audio overview" fikrinin craft yorumu:
     kaynaklardan kısa sohbet-tarzı özet üret, Pollinations TTS ile oku. */
  const audioSummary = async () => {
    if (speaking) { stopTts(); setSpeaking(false); return; }
    if (!enabledCount) { addToast("Önce en az bir kaynak ekle.", "info"); return; }
    if (busy || narrating || podcasting || playingPodcast || guideBusy || faqBusy) return;
    setNarrating(true);
    const history: NbMsg[] = [...msgs, { role: "user", content: "🔊 Sesli özet istendi" }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    try {
      const text = await streamChat({
        system: buildNotebookSystem(sources),
        messages: [{ role: "user", content: `Kaynakların ana fikirlerini sıcak, sohbet tarzında ve EN FAZLA ${Math.floor(TTS_MAX_CHARS * 0.9)} karakterde özetle — sesli dinleme için yazıyorsun; madde işareti ve atıf numarası kullanma, akıcı konuş.` }],
        temperature: 0.6,
        onDelta: (full) => setMsgs([...history, { role: "assistant", content: full }]),
      });
      if (text.trim()) {
        setSpeaking(true);
        playTts(text, config.ttsVoice || "nova", () => setSpeaking(false));
      }
    } catch (e) {
      const msg = friendlyErrorFrom(e);
      setMsgs([...history, { role: "assistant", content: `Hata: ${msg}` }]);
    } finally { setNarrating(false); }
  };

  /* Podcast özeti — NotebookLM'in "audio overview"ından ilham: iki sunucu
     (A/B) kaynaklar üzerine sohbet ediyormuş gibi dönüşümlü seslerle okunur. */
  const podcastSummary = async () => {
    if (playingPodcast) { stopPodcast(); setPlayingPodcast(false); return; }
    if (!enabledCount) { addToast("Önce en az bir kaynak ekle.", "info"); return; }
    if (busy || narrating || podcasting || speaking || guideBusy || faqBusy) return;
    setPodcasting(true);
    const history: NbMsg[] = [...msgs, { role: "user", content: "🎙️ Podcast özeti istendi" }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    try {
      const raw = await streamChat({
        system: buildNotebookSystem(sources),
        messages: [{ role: "user", content:
          "Kaynakların ana fikirlerini iki sunuculu (A ve B), sıcak ve doğal bir podcast " +
          "diyaloğu olarak yaz — biri sorup diğeri yanıtlasın, karşılıklı yorum yapsınlar. " +
          "SADECE 'A: ' veya 'B: ' ile başlayan satırlar üret (başka biçim/başlık kullanma), " +
          "madde işareti ve atıf numarası koyma, en az 6 en fazla 10 tur, her tur 1-2 kısa cümle." },
        ],
        temperature: 0.7,
        onDelta: (full) => setMsgs([...history, { role: "assistant", content: full }]),
      });
      let turns = parsePodcastScript(raw);
      if (!turns.length && raw.trim()) turns = [{ speaker: "A", text: raw.trim() }];
      if (!turns.length) {
        addToast("Podcast betiği üretilemedi.", "error");
        setMsgs([...history, { role: "assistant", content: "Hata: podcast betiği üretilemedi." }]);
        return;
      }
      setPlayingPodcast(true);
      const voiceA = config.ttsVoice || "nova";
      const voiceB = config.ttsVoiceB || "onyx";
      playPodcast(turns, (speaker) => (speaker === "B" ? voiceB : voiceA), undefined, () => setPlayingPodcast(false));
    } catch (e) {
      const msg = friendlyErrorFrom(e);
      setMsgs([...history, { role: "assistant", content: `Hata: ${msg}` }]);
    } finally { setPodcasting(false); }
  };

  /* Hızlı üretim — NotebookLM'in "Notebook guide" fikrinden ilham: kaynaklardan
     tek tıkla yapılandırılmış bir çıktı üretir. [n] atıflı olduğundan (bkz.
     buildNotebookSystem) sonuç doğrudan tıklanabilir atıf pillerine dönüşür. */
  const quickGenerate = async (kind: "guide" | "faq") => {
    if (!enabledCount) { addToast("Önce en az bir kaynak ekle.", "info"); return; }
    if (busy || narrating || podcasting || speaking || playingPodcast || guideBusy || faqBusy) return;
    const setKindBusy = kind === "guide" ? setGuideBusy : setFaqBusy;
    setKindBusy(true);
    const label = kind === "guide" ? "📘 Çalışma rehberi istendi" : "❓ SSS istendi";
    const instruction = kind === "guide"
      ? "Kaynaklardan kapsamlı bir ÇALIŞMA REHBERİ hazırla. Şu bölümleri kullan: " +
        "'## Ana Kavramlar' (madde madde, her maddenin sonunda [n] atıf), " +
        "'## Önemli Terimler' (terim — kısa tanım, [n] atıflı), " +
        "'## Anlama Soruları' (kaynağın kapsamına uygun sayıda — en az 3, en fazla 6 — " +
        "kısa-yanıtlı soru), ardından '## Yanıt Anahtarı' başlığı altında her sorunun kısa " +
        "yanıtı ([n] atıflı). Yalnız kaynaklardaki bilgiyi kullan; kaynaklar kısaysa daha az " +
        "madde/soru üret, KONU DIŞI veya İCAT EDİLMİŞ soru/madde EKLEME."
      : "Kaynaklardan bir SIKÇA SORULAN SORULAR (SSS) listesi hazırla: kaynağın kapsamına " +
        "uygun sayıda — en az 3, en fazla 8 — soru-cevap çifti. Her soruyu '### ' ile başlat, " +
        "cevabı 2-4 cümlede ver ve [n] ile atıfla. Yalnız kaynaklardaki bilgiyi kullan; " +
        "kaynaklar kısaysa daha az soru üret, kaynak dışı/alakasız/icat edilmiş bir soru " +
        "EKLEME (yalnızca kaynaklarda GERÇEKTEN yanıtı bulunan sorular sor).";
    const history: NbMsg[] = [...msgs, { role: "user", content: label }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    try {
      await streamChat({
        system: buildNotebookSystem(sources),
        messages: [{ role: "user", content: instruction }],
        temperature: 0.4,
        onDelta: (full) => setMsgs([...history, { role: "assistant", content: full }]),
      });
    } catch (e) {
      const msg = friendlyErrorFrom(e);
      setMsgs([...history, { role: "assistant", content: `Hata: ${msg}` }]);
    } finally { setKindBusy(false); }
  };

  const saveNb = () => {
    const nb: CraftNotebook = {
      id: nbId, title: title.trim() || "Defter", sources,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    saveNbItem(nb, "Defter kaydedildi.");
  };

  const openNb = (n: CraftNotebook) => {
    stopPodcast(); setSpeaking(false); setPlayingPodcast(false);
    setNbId(n.id); setTitle(n.title); setSources(n.sources); setMsgs([]); setSavedOpen(false);
  };

  /* X2 — "+ Yeni" eskiden kaynakları ve sohbeti ONAYSIZ siliyordu.
     Defter, diğer dört yüzeyden farklı olarak elinde hazır bir "öğe" tutmuyor
     (nbId/title/sources ayrı state'ler, öğe yalnız saveNb'de kuruluyor), bu
     yüzden hasUnsavedItem'ın zaman damgası karşılaştırması burada
     KULLANILAMAZ: render'da Date.now() çağırmak hem saf olmayan bir işlem
     (eslint react-hooks/purity) hem de kaydettikten hemen SONRA bile
     "kaydedilmemiş" derdi. Onun yerine ucuz bir içerik imzası: kaynak
     kimlikleri + uzunluk + etkinlik + başlık. */
  const savedNb = saved.find((n) => n.id === nbId);
  const nbSignature = (t: string, list: NotebookSource[]) =>
    `${t.trim()}∷${list.map((s) => `${s.id}:${s.text.length}:${s.enabled ? 1 : 0}`).join("|")}`;
  const nbUnsaved = sources.length > 0
    && (!savedNb || nbSignature(savedNb.title, savedNb.sources) !== nbSignature(title, sources));

  const resetNb = () => {
    stopPodcast(); setSpeaking(false); setPlayingPodcast(false);
    setNbId(`nb_${Date.now().toString(36)}`); setTitle("Yeni defter"); setSources([]); setMsgs([]);
  };
  const newNb = () => {
    if (nbUnsaved && !confirm("Bu defter kaydedilmedi. Devam edilirse kaybolacak. Devam edilsin mi?")) return;
    resetNb();
  };
  const backToGallery = () => { if (sources.length) saveNb(); resetNb(); };

  const slimActionsRow = (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line/60">
      <button onClick={backToGallery} title="Galeri — çalışman kaydedilir" className="flex items-center gap-1.5 text-xs px-2 py-2 sm:py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft shrink-0 transition-colors"><ArrowLeft size={14} /> <span className="hidden sm:inline font-semibold">Galeri</span></button>
      <button onClick={newNb} className="text-xs px-2.5 py-2 sm:py-1 rounded-lg border border-line text-muted hover:text-ink hover:bg-bgsoft shrink-0 transition-colors">+ Yeni</button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Defter adı"
        className="ml-auto hidden md:block w-40 bg-transparent text-xs text-muted focus:text-ink border-b border-transparent focus:border-line outline-none px-1 py-0.5"
      />
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setSavedOpen(true)} title="Kayıtlı defterler" className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
        <button onClick={saveNb} title="Defteri kaydet" className="w-9 h-9 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
      </div>
    </div>
  );

  const content = (
    <>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Kaynak paneli */}
        <div className={`shrink-0 lg:w-80 border-b lg:border-b-0 lg:border-r border-line/60 overflow-y-auto ${srcPanel ? "" : "hidden lg:block"}`}>
          <div className="p-3 space-y-3">
            {/* X3 — son çalışmalar. Defterin ayrı bir giriş ekranı yok (kaynak
               paneli hep açık), bu yüzden şerit YALNIZ boş defterde gösterilir:
               kaynak eklemeye başlayınca kaybolur, panelin işini bölmez. */}
            {sources.length === 0 && (
              <RecentWorksStrip items={recent(4)} onOpen={openNb} emptyTitle="Adsız defter" />
            )}
            <div className="text-[11px] font-bold text-muted/70 uppercase tracking-wide">Kaynaklar ({sources.length}/{MAX_SOURCES})</div>
            {sources.map((s) => {
              /* Panelde gösterilen numara, sohbetteki atıf numarasıyla (yalnız
                 etkin+dolu kaynaklar sırayla) eşleşmeli — devre dışı bir kaynak
                 numara ALMAZ, "—" gösterir (aksi halde atıf/panel numaraları kayar). */
              const onIdx = enabledSources.indexOf(s);
              return (
                <div
                  key={s.id}
                  ref={(el) => { if (el) sourceRefs.current.set(s.id, el); else sourceRefs.current.delete(s.id); }}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-xl border transition-colors ${flashSourceId === s.id ? "border-brand ring-2 ring-brand/40 bg-brand/5" : s.enabled ? "border-line/60" : "border-line/30 opacity-50"}`}
                >
                  <input type="checkbox" checked={s.enabled} onChange={(e) => setSources((arr) => arr.map((x) => x.id === s.id ? { ...x, enabled: e.target.checked } : x))} className="mt-0.5 shrink-0" title="Sohbete dahil et" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate flex items-center gap-1">
                      <span className="text-brand">{onIdx >= 0 ? `[${onIdx + 1}]` : "—"}</span>
                      {s.url && <Link2 size={10} className="text-muted/50 shrink-0" />}
                      <span className="truncate">{s.name}</span>
                    </div>
                    <div className="text-[10px] text-muted/50">{s.text.length.toLocaleString("tr-TR")} karakter</div>
                  </div>
                  <button onClick={() => setSources((arr) => arr.filter((x) => x.id !== s.id))} className="w-6 h-6 grid place-items-center rounded text-muted/40 hover:text-red shrink-0" title="Kaldır"><Trash2 size={12} /></button>
                </div>
              );
            })}

            {/* Kaynak ekleme */}
            <div className="rounded-xl border border-dashed border-line/60 p-2.5 space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={3}
                placeholder="Metin yapıştır (not, makale, transkript…)"
                className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50 resize-none"
              />
              <button onClick={addPaste} disabled={!pasteText.trim()} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-brand/15 text-brand text-xs font-semibold hover:bg-brand/25 disabled:opacity-40 transition-colors">
                <Plus size={13} /> Metni kaynak ekle
              </button>
              <div className="flex gap-1.5">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void addUrl(); }}
                  placeholder="https://… (URL'den getir)"
                  className="flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50"
                />
                <button onClick={() => void addUrl()} disabled={fetching || !urlInput.trim()} className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-line text-muted hover:text-brand hover:border-brand/50 disabled:opacity-40 transition-colors" title="URL içeriğini getir">
                  {fetching ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void addFile(f); e.target.value = ""; }}
              />
              <button onClick={() => fileRef.current?.click()} disabled={pdfBusy} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-line text-muted text-xs font-semibold hover:text-brand hover:border-brand/50 disabled:opacity-40 transition-colors">
                {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} PDF kaynak ekle
              </button>
            </div>

            {/* Sesli özet (tekli ses) */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => void audioSummary()} disabled={(busy || narrating || podcasting || playingPodcast || guideBusy || faqBusy) && !speaking} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${speaking ? "border-brand/50 text-brand bg-brand/10" : "border-line text-muted hover:text-ink hover:border-brand/40"} disabled:opacity-40`}>
                {narrating ? <Loader2 size={14} className="animate-spin" /> : speaking ? <VolumeX size={14} /> : <Volume2 size={14} />} {speaking ? "Durdur" : "Sesli özet"}
              </button>
              <select
                value={config.ttsVoice || "nova"}
                onChange={(e) => saveConfig({ ...config, ttsVoice: e.target.value })}
                className="bg-bgsoft border border-line rounded-lg px-2 py-2 text-xs outline-none focus:border-brand/50 cursor-pointer"
                aria-label="Seslendirme sesi"
              >
                {TTS_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>

            {/* Podcast özeti (2 sunuculu, dönüşümlü seslendirme) */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => void podcastSummary()} disabled={(busy || narrating || podcasting || speaking || guideBusy || faqBusy) && !playingPodcast} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${playingPodcast ? "border-brand/50 text-brand bg-brand/10" : "border-line text-muted hover:text-ink hover:border-brand/40"} disabled:opacity-40`}>
                {podcasting ? <Loader2 size={14} className="animate-spin" /> : playingPodcast ? <VolumeX size={14} /> : <Users size={14} />} {playingPodcast ? "Durdur" : "Podcast özeti"}
              </button>
              <select
                value={config.ttsVoiceB || "onyx"}
                onChange={(e) => saveConfig({ ...config, ttsVoiceB: e.target.value })}
                className="bg-bgsoft border border-line rounded-lg px-2 py-2 text-xs outline-none focus:border-brand/50 cursor-pointer"
                aria-label="İkinci sunucu sesi"
              >
                {TTS_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>

            {/* Hızlı üretim (NotebookLM'in "Notebook guide" fikrinden ilham):
                kaynaklardan tek tıkla çalışma rehberi / SSS üret — [n] atıflı,
                tıklanabilir (bkz. parseCitations). */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => void quickGenerate("guide")} disabled={busy || narrating || podcasting || speaking || playingPodcast || guideBusy || faqBusy || !enabledCount} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line text-muted text-xs font-semibold hover:text-ink hover:border-brand/40 disabled:opacity-40 transition-colors">
                {guideBusy ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />} Çalışma Rehberi
              </button>
              <button onClick={() => void quickGenerate("faq")} disabled={busy || narrating || podcasting || speaking || playingPodcast || guideBusy || faqBusy || !enabledCount} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line text-muted text-xs font-semibold hover:text-ink hover:border-brand/40 disabled:opacity-40 transition-colors">
                {faqBusy ? <Loader2 size={14} className="animate-spin" /> : <HelpCircle size={14} />} SSS
              </button>
            </div>

            {/* "İlgili" (Obsidian-lite) — yalnız kayıtlı bir defterde, çapraz-tip
                (sohbet/doküman/anket dahil) arar. */}
            {saved.some((n) => n.id === nbId) && (
              <div className="border-t border-line/60 pt-3">
                <CrossTypeRelated kind="notebook" id={nbId} />
              </div>
            )}
          </div>
        </div>

        {/* Sohbet */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <button onClick={() => setSrcPanel((v) => !v)} className="lg:hidden shrink-0 text-[11px] text-muted/60 py-1.5 border-b border-line/40">
            {srcPanel ? "▲ Kaynakları gizle" : `▼ Kaynaklar (${sources.length})`}
          </button>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
              {msgs.length === 0 ? (
                <div className="text-center text-muted/55 select-none pt-16">
                  <BookOpen size={30} className="text-brand/40 mx-auto mb-3" />
                  <p className="text-sm text-balance">
                    {enabledCount
                      ? "Kaynakların hazır — soru sor, yalnız kaynaklardan [1] [2] atıflı yanıt alırsın."
                      : "Soldan metin yapıştır ya da URL getir; sonra kaynaklara sadık sohbet başlasın."}
                  </p>
                </div>
              ) : msgs.map((m, i) => (
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed bg-brand/15 border border-brand/25 text-ink whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2">
                    <Sparkles size={13} className="text-brand mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      {m.content ? parseCitations(m.content, enabledCount).map((p, pi) =>
                        p.type === "text" ? <span key={pi}>{p.value}</span> : (
                          <button
                            key={pi}
                            onClick={() => jumpToSource(p.index)}
                            className="inline-flex items-center justify-center mx-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded text-[10px] font-bold align-text-top bg-brand/15 text-brand hover:bg-brand/25 transition-colors"
                            title={`Kaynağa git: ${enabledSources[p.index - 1]?.name ?? ""}`}
                          >
                            {p.index}
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 py-1" aria-label="Yazıyor">
                          <span className="typing-dot" />
                          <span className="typing-dot delay-1" />
                          <span className="typing-dot delay-2" />
                        </span>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
          <div className="shrink-0 border-t border-line/60 bg-surface/40">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }}
                rows={1}
                placeholder={enabledCount ? "Kaynaklara soru sor… (Enter = gönder)" : "Önce kaynak ekle…"}
                className="flex-1 bg-bgsoft border border-line rounded-2xl px-3.5 py-2.5 text-sm outline-none focus:border-brand/50 resize-none max-h-32"
              />
              <button onClick={() => void ask()} disabled={busy || narrating || podcasting || speaking || playingPodcast || guideBusy || faqBusy || !input.trim() || !enabledCount} className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-brand text-[#111110] disabled:opacity-40 transition-opacity" title="Gönder">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kayıtlı defterler */}
      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Kayıtlı defterler"
        icon={BookOpen}
        items={saved}
        getKey={(n) => n.id}
        renderRow={(n) => (
          <>
            <div className="text-sm font-semibold truncate">{n.title}</div>
            <div className="text-[11px] text-muted/60">{n.sources.length} kaynak · {new Date(n.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openNb}
        onDelete={(n) => removeNb(n.id)}
        emptyLabel="Henüz kayıtlı defter yok."
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
