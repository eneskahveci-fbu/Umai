"use client";

import { useEffect, useState } from "react";
import {
  Download, FolderOpen, Highlighter, Layers, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { consumeSurfaceHandoff, consumeSurfaceOpenItem } from "@/lib/surfaceNav";
import { SavedItemsModal } from "./SavedItemsModal";
import { safeFileName } from "./DocsStudio";
import type { CraftDeck, FlashCard } from "@/lib/types";
import {
  cardsFromHighlights, deckToTsv, dueCards, generateDeck, gradeCard,
  MAX_DECK_CARDS, newCard,
} from "@/lib/cards";
import { useStudioProject } from "@/lib/useStudioProject";

/* Kartlar — Anki'den İLHAM alan çalışma kartı stüdyosu: brief ya da Vurgular
   → AI kartlar → Leitner kutulu aralıklı tekrar. Çalışma notu her cevapta
   SESSİZCE kaydedilir (ilerleme kaybolmasın); diğer düzenlemeler için Kaydet.
   Ücretsiz ve anahtarsız (Pollinations tabanı). */

const SUGGESTIONS = [
  "TypeScript tip sistemi: union, generic, narrowing, utility tipler",
  "İngilizce phrasal verbs: iş e-postalarında en sık geçen 15'i",
  "Hücre biyolojisi: organeller ve görevleri (lise düzeyi)",
  "SQL temelleri: JOIN türleri, GROUP BY, indeksler",
];

type Tab = "study" | "cards" | "highlights";

export function CardsStudio() {
  const open = useStore((s) => s.cardsStudioOpen);
  const addToast = useStore((s) => s.addToast);
  const highlights = useStore((s) => s.config.highlights ?? []);
  const removeHighlight = useStore((s) => s.removeHighlight);
  const { saved, save, remove } = useStudioProject<CraftDeck>("craftDecks", 40);

  const [view, setView] = useState<"home" | "work">("home");
  const [tab, setTab] = useState<Tab>("study");
  const [brief, setBrief] = useState("");
  const [deck, setDeck] = useState<CraftDeck | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);
  /* Çalışma oturumu: vadesi gelen kart id sırası + açık/kapalı arka yüz. */
  const [queue, setQueue] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [genFromHl, setGenFromHl] = useState(false);

  useEffect(() => {
    const b = consumeSurfaceHandoff("cards");
    if (b) {
      const t = setTimeout(() => setBrief(b), 0);
      return () => clearTimeout(t);
    }
    const openId = consumeSurfaceOpenItem("cards");
    if (openId) {
      const d = (useStore.getState().config.craftDecks ?? []).find((x) => x.id === openId);
      if (d) {
        /* openDeck ile aynı adımlar — bildirim sırası yüzünden burada satır içi. */
        const t = setTimeout(() => {
          setDeck(d); setView("work"); setTab("study"); setRevealed(false);
          setQueue(dueCards(d.cards).map((c) => c.id));
        }, 0);
        return () => clearTimeout(t);
      }
    }
  }, []);

  if (!open) return null;

  const startStudy = (d: CraftDeck) => setQueue(dueCards(d.cards).map((c) => c.id));

  const openDeck = (d: CraftDeck) => {
    setDeck(d); setView("work"); setSavedOpen(false); setTab("study");
    setRevealed(false); startStudy(d);
  };

  const generate = async () => {
    const b = brief.trim();
    if (!b || busy) return;
    setBusy(true); setProgress(0);
    try {
      const d = await generateDeck({ brief: b, onDelta: (t) => setProgress(t.length) });
      openDeck(d);
    } catch (e) {
      addToast(`Kartlar üretilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setBusy(false); }
  };

  /* Çalışma: cevap → kutu/vade güncelle + SESSİZ kaydet (toast'sız). */
  const grade = (ok: boolean) => {
    if (!deck || !queue.length) return;
    const id = queue[0];
    const next: CraftDeck = { ...deck, cards: deck.cards.map((c) => (c.id === id ? gradeCard(c, ok) : c)) };
    setDeck(save(next));
    setQueue(queue.slice(1));
    setRevealed(false);
  };

  const patchCard = (id: string, patch: Partial<FlashCard>) => {
    if (!deck) return;
    setDeck({ ...deck, cards: deck.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const addNewCard = () => {
    if (!deck) return;
    if (deck.cards.length >= MAX_DECK_CARDS) { addToast(`En fazla ${MAX_DECK_CARDS} kart.`, "info"); return; }
    setDeck({ ...deck, cards: [...deck.cards, newCard("Yeni soru", "Cevap")] });
  };

  const deleteCard = (id: string) => {
    if (!deck || deck.cards.length <= 1) return;
    setDeck({ ...deck, cards: deck.cards.filter((c) => c.id !== id) });
  };

  const exportTsv = () => {
    if (!deck) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([deckToTsv(deck)], { type: "text/tab-separated-values;charset=utf-8" }));
    a.download = `${safeFileName(deck.title, "kartlar")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  /* Seçili vurgulardan kart üret: açık deste varsa ona ekler, yoksa yeni
     deste kurar. */
  const generateFromHighlights = async () => {
    const sel = highlights.filter((h) => picked.has(h.id));
    if (!sel.length || genFromHl) return;
    setGenFromHl(true);
    try {
      const cards = await cardsFromHighlights(sel);
      if (deck) {
        const merged = { ...deck, cards: [...deck.cards, ...cards].slice(0, MAX_DECK_CARDS) };
        setDeck(merged);
        addToast(`${cards.length} kart eklendi — Kaydet'i unutma.`, "success");
        setTab("cards");
      } else {
        const now = Date.now();
        openDeck({ id: `deck_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`, title: "Vurgulardan", cards, createdAt: now, updatedAt: now });
        addToast(`${cards.length} kart üretildi.`, "success");
      }
      setPicked(new Set());
    } catch (e) {
      addToast(`Üretilemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setGenFromHl(false); }
  };

  const current = deck && queue.length ? deck.cards.find((c) => c.id === queue[0]) : null;

  /* Vurgular sekmesi hem home hem work'te erişilebilir olsun diye ayrı blok. */
  const highlightsPanel = (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-1.5"><Highlighter size={14} className="text-yellow" /> Vurgular ({highlights.length})</h2>
        <button
          onClick={() => void generateFromHighlights()}
          disabled={!picked.size || genFromHl}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-[#111110] text-xs font-semibold disabled:opacity-40 hover:bg-branddim transition-colors"
        >
          {genFromHl ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Seçilenlerden kart üret{picked.size ? ` (${picked.size})` : ""}
        </button>
      </div>
      {!highlights.length && (
        <p className="text-xs text-muted/60 leading-relaxed">
          Henüz vurgu yok. Sohbette bir yanıttaki metni seçip <Highlighter size={11} className="inline text-yellow" /> butonuna bas — pasaj buraya düşer, sonra tek tıkla karta dönüşür.
        </p>
      )}
      {highlights.map((h) => (
        <label key={h.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/40 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={picked.has(h.id)}
            onChange={(e) => {
              const next = new Set(picked);
              if (e.target.checked) next.add(h.id); else next.delete(h.id);
              setPicked(next);
            }}
            className="mt-0.5"
          />
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] leading-snug">{h.text}</span>
            <span className="block text-[10.5px] text-muted/50 mt-0.5">{h.source} · {new Date(h.createdAt).toLocaleDateString("tr-TR")}</span>
          </span>
          <button
            onClick={(e) => { e.preventDefault(); removeHighlight(h.id); }}
            aria-label="Vurguyu sil" title="Vurguyu sil"
            className="w-6 h-6 grid place-items-center rounded text-muted/40 hover:text-red shrink-0"
          ><Trash2 size={12} /></button>
        </label>
      ))}
    </div>
  );

  const slimActionsRow = view === "work" && deck && (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line/60">
      <button onClick={() => { setDeck(null); setView("home"); setBrief(""); setQueue([]); }} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink shrink-0">+ Yeni</button>
      <input
        value={deck.title}
        onChange={(e) => setDeck({ ...deck, title: e.target.value })}
        placeholder="Deste başlığı"
        className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold"
        aria-label="Deste başlığı"
      />
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <button onClick={() => setSavedOpen(true)} title="Projelerim" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><FolderOpen size={15} /></button>
        <button onClick={() => deck && setDeck(save(deck, "Deste kaydedildi."))} title="Kaydet" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Save size={15} /></button>
        <button onClick={exportTsv} title="Anki TSV indir (.txt)" className="w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-bgsoft transition-colors"><Download size={15} /></button>
      </div>
    </div>
  );

  const content = (
    <>
      {view === "home" ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-5">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">Neyi ezberleyelim… pardon, ÖĞRENELİM?</h1>
              <p className="text-muted text-sm mt-1.5 text-balance">Konuyu anlat — craft atomik kartlar kursun; aralıklı tekrarla çalış, Anki&apos;ye aktar.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }}
                rows={4}
                placeholder="Örn: KPSS vatandaşlık — yasama, yürütme, yargı organlarının görev ve yetkileri."
                className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[104px]"
              />
              <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                <span className="text-[11px] text-muted/50">Aralıklı tekrar · Anki TSV · Ücretsiz</span>
                <button
                  onClick={() => void generate()}
                  disabled={busy || !brief.trim()}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Üret
                </button>
              </div>
            </div>
            {busy && <p className="text-center text-xs text-muted/60 animate-pulse">Kartlar kurgulanıyor… ({progress} karakter)</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setBrief(s)} className="text-left text-[12.5px] leading-snug px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-muted hover:text-ink transition-colors">{s}</button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted/80">
              {saved.length > 0 && (
                <button onClick={() => setSavedOpen(true)} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
                  <FolderOpen size={13} className="text-brand" /> Kayıtlı desteler ({saved.length})
                </button>
              )}
              {highlights.length > 0 && (
                <button onClick={() => { setView("work"); setTab("highlights"); setDeck(null); }} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
                  <Highlighter size={13} className="text-yellow" /> Vurgular ({highlights.length})
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Sekmeler */}
          <div className="shrink-0 flex items-center justify-center gap-1 py-2 border-b border-line/60">
            {(deck ? (["study", "cards", "highlights"] as Tab[]) : (["highlights"] as Tab[])).map((t) => (
              <button key={t} onClick={() => { setTab(t); if (t === "study" && deck) { startStudy(deck); setRevealed(false); } }} className={`px-3 py-1 rounded-lg text-xs font-semibold ${tab === t ? "bg-brand/15 text-brand" : "text-muted"}`}>
                {t === "study" ? `Çalış${deck ? ` (${dueCards(deck.cards).length})` : ""}` : t === "cards" ? `Kartlar${deck ? ` (${deck.cards.length})` : ""}` : `Vurgular (${highlights.length})`}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === "study" && deck && (
              <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-4">
                {current ? (
                  <>
                    <div className="text-[11px] text-muted/50 tabular-nums">kalan {queue.length} · kutu {current.box + 1}/5</div>
                    <div className="w-full rounded-2xl border border-line bg-surface elev-2 p-6 text-center space-y-4">
                      <div className="text-base font-semibold text-balance">{current.front}</div>
                      {revealed && <div className="text-sm text-muted border-t border-line/60 pt-4 text-balance">{current.back}</div>}
                    </div>
                    {revealed ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => grade(false)} className="px-4 py-2 rounded-xl bg-red/10 text-red font-semibold text-sm hover:bg-red/20 transition-colors">Tekrar</button>
                        <button onClick={() => grade(true)} className="px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm hover:bg-branddim transition-colors">Bildim</button>
                      </div>
                    ) : (
                      <button onClick={() => setRevealed(true)} className="px-4 py-2 rounded-xl border border-line text-sm font-semibold text-muted hover:text-ink hover:border-brand/50 transition-colors">Cevabı göster</button>
                    )}
                  </>
                ) : (
                  <div className="text-center space-y-3 py-8">
                    <div className="text-3xl">🎉</div>
                    <p className="text-sm text-muted">Vadesi gelen kart yok — kutular dolmuş, aralıklar işliyor.</p>
                    <button
                      onClick={() => { setQueue(deck.cards.map((c) => c.id)); setRevealed(false); }}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink transition-colors"
                    ><RotateCcw size={12} /> Yine de baştan çalış ({deck.cards.length})</button>
                  </div>
                )}
              </div>
            )}

            {tab === "cards" && deck && (
              <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-2">
                {deck.cards.map((c, i) => (
                  <div key={c.id} className="group/c rounded-xl border border-line/60 hover:border-line bg-surface p-3 space-y-1.5 transition-colors">
                    <div className="flex items-center gap-2 text-[10.5px] text-muted/50">
                      <span className="tabular-nums">#{i + 1}</span>
                      <span>kutu {c.box + 1}/5</span>
                      <button onClick={() => deleteCard(c.id)} aria-label="Kartı sil" title="Kartı sil" className="ml-auto w-6 h-6 grid place-items-center rounded text-muted/40 hover:text-red [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/c:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                    </div>
                    <input
                      value={c.front}
                      onChange={(e) => patchCard(c.id, { front: e.target.value })}
                      placeholder="Ön yüz (soru)"
                      className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50 font-medium"
                    />
                    <textarea
                      value={c.back}
                      onChange={(e) => patchCard(c.id, { back: e.target.value })}
                      placeholder="Arka yüz (cevap)"
                      rows={2}
                      className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50 resize-none"
                    />
                  </div>
                ))}
                <button onClick={addNewCard} className="flex items-center gap-1.5 text-xs text-muted/60 hover:text-brand transition-colors">
                  <Plus size={13} /> Kart ekle
                </button>
              </div>
            )}

            {tab === "highlights" && highlightsPanel}
          </div>
        </div>
      )}

      <SavedItemsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Kayıtlı desteler"
        icon={Layers}
        items={saved}
        getKey={(d) => d.id}
        renderRow={(d) => (
          <>
            <div className="text-sm font-semibold truncate">{d.title}</div>
            <div className="text-[11px] text-muted/60">{d.cards.length} kart · vadesi gelen {dueCards(d.cards).length} · {new Date(d.updatedAt).toLocaleDateString("tr-TR")}</div>
          </>
        )}
        onOpen={openDeck}
        onDelete={(d) => remove(d.id)}
        emptyLabel="Henüz kayıtlı deste yok."
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
