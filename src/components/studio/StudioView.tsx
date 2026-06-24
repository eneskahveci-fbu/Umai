"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, LayoutTemplate, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Artifact } from "@/lib/types";
import { generateArtifact, type StudioPhase } from "@/lib/studioGen";
import { deviceById, type DeviceId } from "@/lib/studioConstants";
import { StudioHome } from "./StudioHome";
import { StudioWorkspace } from "./StudioWorkspace";

export interface StudioMsg { role: "user" | "assistant"; text: string; }
export interface StudioTweaks { fontScale: number; fontFamily: string; accent: string; }

const DEFAULT_TWEAKS: StudioTweaks = { fontScale: 1, fontFamily: "", accent: "" };

/* Üretilen HTML'e canlı ince-ayar (tweak) <style> bloğu enjekte eder.
   Yaklaşık: yazı ölçeği + yazı tipi güvenilir; vurgu rengi CSS değişkenleri
   kullanan tasarımlarda etkilidir (best-effort). */
function applyTweaks(html: string, t: StudioTweaks): string {
  const rules: string[] = [];
  if (t.fontScale !== 1) rules.push(`html{font-size:${(16 * t.fontScale).toFixed(1)}px}`);
  if (t.fontFamily) rules.push(`body,body *{font-family:${t.fontFamily} !important}`);
  if (t.accent) rules.push(`:root{--accent:${t.accent};--brand:${t.accent};--primary:${t.accent};--color-brand:${t.accent};--color-primary:${t.accent}}`);
  if (rules.length === 0) return html;
  const style = `<style id="craft-tweaks">${rules.join("")}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : style + html;
}

export function StudioView() {
  const open = useStore((s) => s.studioOpen);
  const setOpen = useStore((s) => s.setStudioOpen);
  const setImageStudioOpen = useStore((s) => s.setImageStudioOpen);
  const setDesignStudioOpen = useStore((s) => s.setDesignStudioOpen);
  const addToast = useStore((s) => s.addToast);

  const [view, setView] = useState<"home" | "workspace">("home");
  const [brief, setBrief] = useState("");
  const [skillId, setSkillId] = useState<string | null>("landing");
  const [directionId, setDirectionId] = useState<string | null>("minimal");
  const [device, setDevice] = useState<DeviceId>("web");
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [messages, setMessages] = useState<StudioMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<StudioPhase | null>(null);
  const [tweaks, setTweaks] = useState<StudioTweaks>(DEFAULT_TWEAKS);
  const [reloadKey, setReloadKey] = useState(0);
  const [title, setTitle] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  if (!open) return null;

  const effectiveSrc = artifact ? applyTweaks(artifact.content, tweaks) : "";

  const run = async (text: string, followup: boolean) => {
    const b = text.trim();
    if (!b || busy) return;
    setBusy(true); setPhase("planning");
    if (!followup) { setMessages([{ role: "user", text: b }, { role: "assistant", text: "" }]); setView("workspace"); }
    else setMessages((m) => [...m, { role: "user", text: b }, { role: "assistant", text: "" }]);
    if (!title) setTitle(b.slice(0, 40));
    const ac = new AbortController(); abortRef.current = ac;
    try {
      const result = await generateArtifact({
        brief: b,
        skillId, directionId,
        prevHtml: followup && artifact ? artifact.content : undefined,
        onDelta: (txt) => setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: txt || "Tasarım üretiliyor…" }; return c; }),
        onPhase: setPhase,
        signal: ac.signal,
      });
      setArtifact(result.artifact);
      setReloadKey((k) => k + 1);
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: result.text }; return c; });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") { setMessages((m) => m.slice(0, -1)); }
      else {
        const msg = e instanceof Error ? e.message : "bilinmeyen hata";
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `Hata: ${msg}` }; return c; });
        addToast(`Üretim hatası: ${msg}`, "error");
      }
    } finally { setBusy(false); setPhase(null); abortRef.current = null; }
  };

  const stop = () => { abortRef.current?.abort(); };

  const newDesign = () => {
    stop();
    setView("home"); setArtifact(null); setMessages([]); setTweaks(DEFAULT_TWEAKS); setBrief(""); setTitle("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col">
      {/* Üst bar — mod seçici + başlık + kapat */}
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles size={15} className="text-brand" /> Stüdyo
        </div>
        <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 text-xs ml-1">
          <button className="px-2.5 py-1 rounded-md bg-brand/15 text-brand font-semibold">Tasarım</button>
          <button onClick={() => { setOpen(false); setImageStudioOpen(true); }} className="px-2.5 py-1 rounded-md text-muted hover:text-ink flex items-center gap-1"><ImageIcon size={12} /> Görüntü</button>
          <button onClick={() => { setOpen(false); setDesignStudioOpen(true); }} className="px-2.5 py-1 rounded-md text-muted hover:text-ink flex items-center gap-1" title="Klasik katman/tuval editörü"><LayoutTemplate size={12} /> Gelişmiş tuval</button>
        </div>
        {view === "workspace" && (
          <button onClick={newDesign} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink ml-1">+ Yeni</button>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tasarım adı"
          className="ml-auto hidden sm:block w-44 bg-transparent text-xs text-muted focus:text-ink border-b border-transparent focus:border-line outline-none px-1 py-0.5"
        />
        <button onClick={() => setOpen(false)} className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft sm:ml-1" title="Kapat"><X size={16} /></button>
      </div>

      {view === "home" ? (
        <StudioHome
          brief={brief} setBrief={setBrief}
          skillId={skillId} setSkillId={setSkillId}
          directionId={directionId} setDirectionId={setDirectionId}
          busy={busy}
          onGenerate={() => run(brief, false)}
        />
      ) : (
        <StudioWorkspace
          messages={messages}
          busy={busy}
          phase={phase}
          artifact={artifact}
          effectiveSrc={effectiveSrc}
          device={deviceById(device)}
          setDevice={setDevice}
          reloadKey={reloadKey}
          tweaks={tweaks}
          setTweaks={setTweaks}
          resetTweaks={() => setTweaks(DEFAULT_TWEAKS)}
          title={title}
          onFollowup={(t) => run(t, true)}
          onStop={stop}
        />
      )}
    </div>
  );
}
