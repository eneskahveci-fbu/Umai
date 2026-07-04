"use client";

import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { autoStudioSkill } from "@/lib/autoPilot";
import type { Artifact, StudioProject } from "@/lib/types";
import { generateArtifact, type StudioPhase } from "@/lib/studioGen";
import { deviceById, skillById, STUDIO_DIRECTIONS, type DeviceId } from "@/lib/studioConstants";
import { designSystemById, designSystemPromptText } from "@/lib/designSystems";
import type { StudioTemplate } from "@/lib/studioTemplates";
import { StudioSwitcher } from "./StudioSwitcher";
import { StudioHome } from "./StudioHome";
import { StudioWorkspace } from "./StudioWorkspace";
import { DesignSystemModal } from "./DesignSystemModal";
import { TemplateGallery } from "./TemplateGallery";
import { ProjectsModal } from "./ProjectsModal";
import { VariationPicker, type Variation } from "./VariationPicker";

export interface StudioMsg { role: "user" | "assistant"; text: string; }
export interface StudioTweaks { fontScale: number; fontFamily: string; accent: string; }

const DEFAULT_TWEAKS: StudioTweaks = { fontScale: 1, fontFamily: "", accent: "" };

/* Üretilen HTML'in <head>'ine bir <style> bloğu enjekte eder (yoksa başa ekler). */
function injectHeadStyle(html: string, css: string, id: string): string {
  if (!css) return html;
  const style = `<style id="${id}">${css}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : style + html;
}

/* Canlı ince-ayar (tweak): yazı ölçeği + yazı tipi güvenilir; vurgu rengi CSS
   değişkenleri kullanan tasarımlarda etkilidir (best-effort). */
function applyTweaks(html: string, t: StudioTweaks): string {
  const rules: string[] = [];
  if (t.fontScale !== 1) rules.push(`html{font-size:${(16 * t.fontScale).toFixed(1)}px}`);
  if (t.fontFamily) rules.push(`body,body *{font-family:${t.fontFamily} !important}`);
  if (t.accent) rules.push(`:root{--accent:${t.accent};--brand:${t.accent};--primary:${t.accent};--color-brand:${t.accent};--color-primary:${t.accent}}`);
  return injectHeadStyle(html, rules.join(""), "craft-tweaks");
}

export function StudioView() {
  const open = useStore((s) => s.studioOpen);
  const nav = useSurfaceNav();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const [view, setView] = useState<"home" | "workspace">("home");
  const [brief, setBrief] = useState("");
  /* null = ✦ Otomatik: çıktı türünü brief'ten sistem seçer (Open Design sadeliği). */
  const [skillId, setSkillId] = useState<string | null>(null);
  const [directionId, setDirectionId] = useState<string | null>("minimal");
  const [designSystemId, setDesignSystemId] = useState<string>("craft");
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceId>("web");
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [messages, setMessages] = useState<StudioMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<StudioPhase | null>(null);
  const [tweaks, setTweaks] = useState<StudioTweaks>(DEFAULT_TWEAKS);
  const [animate, setAnimate] = useState(false);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [varBusy, setVarBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [title, setTitle] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  if (!open) return null;

  const ds = designSystemById(config, designSystemId);
  /* Önce marka token'larını (base), sonra kullanıcı tweak'lerini (override) enjekte et. */
  const effectiveSrc = artifact
    ? applyTweaks(ds ? injectHeadStyle(artifact.content, ds.tokensCss, "craft-ds-tokens") : artifact.content, tweaks)
    : "";

  const run = async (text: string, followup: boolean, ov?: { skillId?: string; designSystemId?: string; directionId?: string }) => {
    const b = text.trim();
    if (!b || busy) return;
    /* Şablon uygulanırken state güncellemesi async olduğundan, üretim için
       değerleri doğrudan override'dan al (bayat closure önlenir). */
    /* ✦ Otomatik: tür seçilmediyse brief'ten çıkar; sinyal yoksa landing. */
    const sk = ov?.skillId ?? skillId ?? autoStudioSkill(b) ?? "landing";
    const dirId = ov?.directionId ?? directionId;
    const dsObj = designSystemById(config, ov?.designSystemId ?? designSystemId);
    setBusy(true); setPhase("planning");
    if (!followup) {
      setMessages([{ role: "user", text: b }, { role: "assistant", text: "" }]); setView("workspace");
      /* Cihazı seçilen skill'in varsayılanına ayarla (mobil skiller → telefon). */
      const skObj = skillById(sk); if (skObj) setDevice(skObj.defaultDevice);
    }
    else setMessages((m) => [...m, { role: "user", text: b }, { role: "assistant", text: "" }]);
    if (!title) setTitle(b.slice(0, 40));
    const ac = new AbortController(); abortRef.current = ac;
    try {
      const result = await generateArtifact({
        brief: b,
        skillId: sk, directionId: dirId, animate,
        designSystemPrompt: dsObj ? designSystemPromptText(dsObj) : undefined,
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

  const saveProject = () => {
    if (!artifact) { addToast("Önce bir tasarım üret.", "error"); return; }
    const name = title.trim() || brief.slice(0, 40) || "Tasarım";
    const now = Date.now();
    const existing = config.studioProjects ?? [];
    const prev = currentProjectId ? existing.find((p) => p.id === currentProjectId) : undefined;
    const id = currentProjectId ?? `sp_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const versions = prev ? [prev.html, ...(prev.versions ?? [])].slice(0, 5) : [];
    const proj: StudioProject = {
      id, name, brief, html: artifact.content, designSystemId, skillId, directionId, versions,
      createdAt: prev?.createdAt ?? now, updatedAt: now,
    };
    saveConfig({ ...config, studioProjects: [proj, ...existing.filter((p) => p.id !== id)].slice(0, 40) });
    setCurrentProjectId(id);
    addToast(prev ? "Proje güncellendi." : "Proje kaydedildi.", "success");
  };

  /* Otomasyon: aynı brief'i farklı 3 tasarım yönünde PARALEL üret (five-direction). */
  const runVariations = async () => {
    const base = (messages.find((m) => m.role === "user")?.text || brief).trim();
    if (!base || varBusy) { addToast("Önce bir tasarım üret.", "error"); return; }
    const dirs = STUDIO_DIRECTIONS.filter((d) => d.id !== directionId).slice(0, 3);
    setVarBusy(true);
    setVariations(dirs.map((d) => ({ label: d.name, art: null })));
    const dsObj = designSystemById(config, designSystemId);
    const results = await Promise.all(dirs.map((d) =>
      generateArtifact({ brief: base, skillId, directionId: d.id, animate, designSystemPrompt: dsObj ? designSystemPromptText(dsObj) : undefined })
        .then((r) => r.artifact).catch(() => null),
    ));
    setVariations(dirs.map((d, i) => ({ label: d.name, art: results[i] })));
    setVarBusy(false);
  };
  const applyVariation = (a: Artifact) => {
    setArtifact(a); setReloadKey((k) => k + 1); setVariations(null);
    setMessages((m) => [...m, { role: "assistant", text: "Seçilen varyasyon uygulandı." }]);
  };

  /* Entegrasyon: tasarımı /api/publish ile bağımsız paylaşılabilir sayfaya çevir. */
  const publishDesign = async () => {
    if (!artifact) { addToast("Önce bir tasarım üret.", "error"); return; }
    try {
      const res = await fetch("/api/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Stüdyo tasarımı", type: "html", content: effectiveSrc }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) { addToast(data.error || "Yayınlama başarısız.", "error"); return; }
      const url = `${window.location.origin}/a/${data.id}`;
      try { await navigator.clipboard.writeText(url); } catch { /* yok say */ }
      addToast("Yayınlandı — bağlantı kopyalandı.", "success");
    } catch (e) { addToast((e as Error).message || "Yayınlama başarısız.", "error"); }
  };

  /* Sürüm geçmişi: kaydedilen önceki üretime dön (Kaydet ile kalıcı olur). */
  const currentVersions = currentProjectId
    ? (config.studioProjects ?? []).find((p) => p.id === currentProjectId)?.versions ?? []
    : [];
  const restoreVersion = (html: string) => {
    setArtifact({ type: "html", content: html, title: title || "Tasarım" });
    setReloadKey((k) => k + 1);
    setMessages((m) => [...m, { role: "assistant", text: "Önceki sürüme dönüldü — Kaydet ile kalıcı olur." }]);
    addToast("Önceki sürüme dönüldü.", "success");
  };

  const openProject = (p: StudioProject) => {
    stop();
    setBrief(p.brief); setSkillId(p.skillId ?? null); setDesignSystemId(p.designSystemId || "craft");
    setDirectionId(p.directionId ?? "minimal"); setTitle(p.name);
    setArtifact({ type: "html", content: p.html, title: p.name }); setReloadKey((k) => k + 1);
    setCurrentProjectId(p.id); setTweaks(DEFAULT_TWEAKS);
    setMessages([{ role: "assistant", text: "Proje yüklendi — değişiklik isteyebilirsin." }]);
    setView("workspace"); setProjectsOpen(false);
  };

  const applyTemplate = (t: StudioTemplate) => {
    setBrief(t.brief); setSkillId(t.skillId);
    if (t.designSystemId) setDesignSystemId(t.designSystemId);
    if (t.directionId) setDirectionId(t.directionId);
    setTplOpen(false); setCurrentProjectId(null);
    void run(t.brief, false, { skillId: t.skillId, designSystemId: t.designSystemId ?? designSystemId, directionId: t.directionId ?? directionId ?? undefined });
  };

  const newDesign = () => {
    stop(); setCurrentProjectId(null);
    setView("home"); setArtifact(null); setMessages([]); setTweaks(DEFAULT_TWEAKS); setBrief(""); setTitle("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg text-ink flex flex-col pb-[var(--surface-pb,0px)] sm:pb-0">
      {/* Üst bar — mod seçici + başlık + kapat */}
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles size={15} className="text-brand" /> Stüdyo
        </div>
        <StudioSwitcher active="studio" />
        {view === "workspace" && (
          <button onClick={newDesign} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink ml-1">+ Yeni</button>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tasarım adı"
          className="ml-auto hidden sm:block w-44 bg-transparent text-xs text-muted focus:text-ink border-b border-transparent focus:border-line outline-none px-1 py-0.5"
        />
        <button onClick={() => nav.close()} className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft ml-auto sm:ml-1" title="Kapat"><X size={16} /></button>
      </div>

      {view === "home" ? (
        <StudioHome
          brief={brief} setBrief={setBrief}
          skillId={skillId} setSkillId={setSkillId}
          directionId={directionId} setDirectionId={setDirectionId}
          designSystemId={designSystemId} setDesignSystemId={setDesignSystemId}
          onBrowseSystems={() => setDsModalOpen(true)}
          onOpenTemplates={() => setTplOpen(true)}
          onOpenProjects={() => setProjectsOpen(true)}
          projectCount={(config.studioProjects ?? []).length}
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
          onSave={saveProject}
          onOpenProjects={() => setProjectsOpen(true)}
          animate={animate}
          setAnimate={setAnimate}
          onVariations={runVariations}
          onPublish={publishDesign}
          versions={currentVersions}
          onRestoreVersion={restoreVersion}
        />
      )}

      {dsModalOpen && (
        <DesignSystemModal
          activeId={designSystemId}
          onSelect={(id) => { setDesignSystemId(id); setDsModalOpen(false); }}
          onClose={() => setDsModalOpen(false)}
        />
      )}
      {tplOpen && <TemplateGallery onApply={applyTemplate} onClose={() => setTplOpen(false)} />}
      {projectsOpen && <ProjectsModal onOpen={openProject} onClose={() => setProjectsOpen(false)} />}
      {variations && <VariationPicker variations={variations} busy={varBusy} onPick={applyVariation} onClose={() => setVariations(null)} />}
    </div>
  );
}
