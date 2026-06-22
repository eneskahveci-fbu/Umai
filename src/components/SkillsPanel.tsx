"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";
import {
  BookMarked, Check, Download, FileText, FileUp, GitBranch,
  Pencil, Plus, RotateCcw, Search, Sparkles, Trash2, Upload, X, Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ALL_AGENTS, type Agent } from "@/lib/agents";
import { getUserAgents } from "@/lib/extensions/customAgents";
import type { Skill } from "@/lib/types";
import SkillImport from "./SkillImport";
import AgentImport from "./AgentImport";

type Tab = "skills" | "agents" | "progress";

export function SkillsPanel() {
  const open = useStore((s) => s.skillsOpen);
  const setOpen = useStore((s) => s.setSkillsOpen);
  const skills = useStore((s) => s.config.skills);
  const config = useStore((s) => s.config);
  const addSkill = useStore((s) => s.addSkill);
  const updateSkill = useStore((s) => s.updateSkill);
  const removeSkill = useStore((s) => s.removeSkill);
  const toggleSkill = useStore((s) => s.toggleSkill);
  const resetSkillProgress = useStore((s) => s.resetSkillProgress);
  const addToast = useStore((s) => s.addToast);

  const [tab, setTab] = useState<Tab>("skills");
  const [search, setSearch] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<HTMLInputElement>(null);
  useModalA11y(modalRef, open, () => setOpen(false));

  /* #6 — skill + ajanları taşınabilir bir JSON dosyasına indir / geri yükle.
     Workspace'e/diske kaydedip paylaşılabilir, başka cihaza taşınabilir. */
  const exportBundle = () => {
    const bundle = { version: 1, skills, userAgents: config.userAgents ?? [] };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `craft-skills-agents-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    addToast("Skill + ajan paketi indirildi", "success");
  };
  const importBundle = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as { skills?: Skill[]; userAgents?: Agent[] };
        let n = 0;
        if (Array.isArray(data.skills)) {
          for (const s of data.skills) {
            if (s && typeof s.title === "string" && typeof s.content === "string") {
              addSkill({ title: s.title, content: s.content, tags: s.tags ?? [], enabled: s.enabled ?? true, source: s.source === "file" ? "file" : "manual", fileName: s.fileName });
              n++;
            }
          }
        }
        if (Array.isArray(data.userAgents)) {
          const cur = useStore.getState(); // taze: addSkill sonrası skill'leri ezme
          const existing = cur.config.userAgents ?? [];
          const cmds = new Set(existing.map((a) => a.command));
          const add = data.userAgents.filter((a) => a && typeof a.command === "string" && a.command.startsWith("/") && !cmds.has(a.command));
          if (add.length) { cur.saveConfig({ ...cur.config, userAgents: [...existing, ...add] }); n += add.length; }
        }
        addToast(n ? `${n} öğe içe aktarıldı` : "İçe aktarılacak geçerli öğe yok", n ? "success" : "error");
      } catch { addToast("Geçersiz dosya (JSON bekleniyor)", "error"); }
    };
    reader.readAsText(file);
  };

  if (!open) return null;

  const totalUsage = skills.reduce((sum, s) => sum + s.usageCount, 0);
  const enabledCount = skills.filter((s) => s.enabled).length;

  const tabs: { id: Tab; label: string; icon: typeof Zap; count: number }[] = [
    { id: "skills", label: "Skills", icon: Zap, count: skills.length },
    { id: "agents", label: "Agents", icon: Sparkles, count: ALL_AGENTS.length },
    { id: "progress", label: "İlerleme", icon: GitBranch, count: totalUsage },
  ];

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm grid place-items-center px-3 sm:px-4 animate-modal-bg"
      onClick={() => setOpen(false)}
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Skills"
        className="w-full max-w-3xl h-[82dvh] max-h-[calc(100dvh-1.5rem)] overflow-hidden bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center">
              <Zap size={14} className="text-brand" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Customize Skills</h2>
              <p className="text-[11px] text-muted/50 leading-tight">
                {enabledCount} aktif · {skills.length} toplam · {totalUsage} kullanım
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <input ref={bundleRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importBundle(f); e.target.value = ""; }} />
            <button onClick={() => bundleRef.current?.click()} title="Skill + ajan paketi içe aktar (JSON)" className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"><Upload size={14} /></button>
            <button onClick={exportBundle} title="Skill + ajan paketini indir (JSON)" className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"><Download size={14} /></button>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs — dar iOS ekranlarında yatay kaydırılabilir, taşma olmaz */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-line/40 shrink-0 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                tab === t.id
                  ? "bg-brand/10 text-brand"
                  : "text-muted hover:text-ink hover:bg-bgsoft"
              }`}
            >
              <t.icon size={12} />
              <span>{t.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                tab === t.id ? "bg-brand/15 text-brand/80" : "bg-bgsoft text-muted/50"
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {tab === "skills" && (
            <SkillsTab
              skills={skills}
              search={search}
              setSearch={setSearch}
              addSkill={addSkill}
              updateSkill={updateSkill}
              removeSkill={removeSkill}
              toggleSkill={toggleSkill}
              addToast={addToast}
            />
          )}
          {tab === "agents" && <AgentsTab />}
          {tab === "progress" && (
            <ProgressTab
              skills={skills}
              totalUsage={totalUsage}
              resetSkillProgress={() => { resetSkillProgress(); addToast("İlerleme sıfırlandı", "info"); }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-line/40 shrink-0">
          <p className="text-[11px] text-muted/40 leading-relaxed">
            Aktif skills ve dosyalar <strong className="text-muted/60">her yeni sohbete</strong> sistem prompt&apos;una otomatik eklenir.
            Her kullanımda sayaç artar.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Skills Tab ───────── */

function SkillsTab({
  skills, search, setSearch, addSkill, updateSkill, removeSkill, toggleSkill, addToast,
}: {
  skills: Skill[];
  search: string;
  setSearch: (s: string) => void;
  addSkill: ReturnType<typeof useStore.getState>["addSkill"];
  updateSkill: ReturnType<typeof useStore.getState>["updateSkill"];
  removeSkill: ReturnType<typeof useStore.getState>["removeSkill"];
  toggleSkill: ReturnType<typeof useStore.getState>["toggleSkill"];
  addToast: ReturnType<typeof useStore.getState>["addToast"];
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Dosya = skill (aynı amaç). Yüklenen dosya source:"file" skill olarak eklenir. */
  const importFile = (file: File) => {
    if (file.size > 200_000) { addToast("Dosya çok büyük (max 200 KB)", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      addSkill({ title: file.name, content: String(reader.result).slice(0, 8000), tags: [file.name.split(".").pop() || "file"], enabled: true, source: "file", fileName: file.name });
      addToast(`${file.name} eklendi`, "success");
    };
    reader.readAsText(file);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [skills, search]);

  const save = () => {
    const c = content.trim();
    if (!c) { addToast("İçerik boş olamaz", "error"); return; }
    const t = title.trim() || c.split("\n")[0].slice(0, 60);
    const tags = tagsRaw.split(",").map((x) => x.trim()).filter(Boolean);
    addSkill({ title: t, content: c, tags, enabled: true, source: "manual" });
    setTitle(""); setContent(""); setTagsRaw("");
    addToast("Skill eklendi", "success");
  };

  return (
    <>
      <SkillImport />
      <div className="px-4 sm:px-5 py-3 border-b border-line/40 shrink-0 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Başlık (opsiyonel)"
            className="flex-1 min-w-0 bg-bgsoft/60 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35"
          />
          <input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="etiketler, virgül"
            className="w-full sm:w-44 bg-bgsoft/60 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35"
          />
        </div>
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); }}
            placeholder="Eğitim seti — örn. 'TypeScript strict mode kullan, any yasak'… (Ctrl+Enter ile ekle)"
            rows={3}
            className="flex-1 bg-bgsoft/60 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35 resize-none"
          />
          <button
            onClick={save}
            disabled={!content.trim()}
            className="shrink-0 w-9 self-stretch rounded-lg bg-amber-400 hover:bg-amber-300 text-black grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Ekle (Ctrl+Enter)"
          >
            <Plus size={15} />
          </button>
        </div>
        {/* Dosya yükle — dosya da bir skill'dir (aynı amaç) */}
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" multiple className="hidden" accept=".ts,.tsx,.js,.jsx,.py,.md,.json,.txt,.css,.html,.go,.rs,.java,.rb,.php,.yml,.yaml" onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) importFile(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-brand transition-colors">
            <FileUp size={13} /> Dosya yükle (dosya = skill)
          </button>
        </div>
      </div>

      <div className="px-5 py-2 border-b border-line/40 shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Skill ara…"
            className="w-full bg-bgsoft/40 rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none focus:ring-1 ring-amber-400/30 placeholder:text-muted/35"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Zap}
            title={skills.length === 0 ? "Henüz skill yok" : "Eşleşen skill yok"}
            hint={skills.length === 0 ? "Yukarıdaki kutudan ekleyebilirsin." : undefined}
          />
        ) : (
          filtered.map((s) => (
            <SkillCard
              key={s.id}
              skill={s}
              editing={editingId === s.id}
              onEdit={() => setEditingId(s.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(patch) => { updateSkill(s.id, patch); setEditingId(null); }}
              onToggle={() => toggleSkill(s.id)}
              onRemove={() => removeSkill(s.id)}
            />
          ))
        )}
      </div>
    </>
  );
}

/* ───────── Agents Tab ───────── */

function AgentsTab() {
  const addToast = useStore((s) => s.addToast);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  /* Kullanıcı agent'ları artık config.userAgents'te (kalıcı + senkron + izole). */
  const userAgents = config.userAgents ?? [];
  /* Eski localStorage kayıtlarını bir kez config'e taşı (kaybolma fix'i). */
  useEffect(() => {
    if (config.userAgents === undefined) {
      const legacy = getUserAgents();
      if (legacy.length) saveConfig({ ...config, userAgents: legacy });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [creating, setCreating] = useState(false);
  const [cmd, setCmd] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("✨");
  const [desc, setDesc] = useState("");
  const [prompt, setPrompt] = useState("");

  const userCommands = new Set(userAgents.map((a) => a.command));
  const builtIn = ALL_AGENTS.filter((a) => !userCommands.has(a.command));

  const persist = (next: Agent[]) => saveConfig({ ...config, userAgents: next });
  const reset = () => { setCmd(""); setLabel(""); setIcon("✨"); setDesc(""); setPrompt(""); };

  const create = () => {
    let command = cmd.trim().toLowerCase().replace(/\s+/g, "");
    if (command && !command.startsWith("/")) command = "/" + command;
    if (command.length < 2) { addToast("Komut gir (örn. /rapor)", "error"); return; }
    if (!prompt.trim()) { addToast("Sistem prompt'u gir", "error"); return; }
    if ([...ALL_AGENTS, ...userAgents].some((a) => a.command === command)) { addToast(`${command} zaten kullanılıyor`, "error"); return; }
    const agent: Agent = {
      id: "user_" + command.slice(1) + "_" + Date.now().toString(36),
      command,
      label: label.trim() || command.slice(1),
      icon: icon.trim() || "✨",
      description: desc.trim() || "Kullanıcı tanımlı agent",
      systemPrompt: prompt.trim(),
      placeholder: "Mesaj…",
    };
    persist([...userAgents, agent]);
    reset(); setCreating(false);
    addToast(`${command} eklendi`, "success");
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
      {/* Özel agent oluştur */}
      <div className="rounded-xl border border-brand/30 bg-brand/5 overflow-hidden">
        <button
          onClick={() => setCreating((v) => !v)}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold hover:bg-brand/10 transition-colors"
        >
          <Plus size={15} className={`text-brand transition-transform ${creating ? "rotate-45" : ""}`} />
          Özel agent oluştur
          <span className="ml-auto text-[11px] font-normal text-muted/60">kendi /komutun</span>
        </button>
        {creating && (
          <div className="px-3.5 pb-3.5 space-y-2 border-t border-brand/15 pt-3">
            <div className="flex gap-2">
              <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} placeholder="✨" className="w-12 text-center bg-bgsoft/60 rounded-lg px-2 py-2 text-base outline-none focus:ring-1 ring-brand/40" title="Emoji" />
              <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="/komut (örn. /rapor)" className="w-40 bg-bgsoft/60 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35" />
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etiket (örn. Rapor Üret)" className="flex-1 min-w-0 bg-bgsoft/60 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35" />
            </div>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Kısa açıklama (opsiyonel)" className="w-full bg-bgsoft/60 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35" />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Sistem prompt'u — bu komut tetiklenince ajanın rolü/talimatı. Örn: 'Sen bir teknik yazarsın. Verilen konuyu maddeler halinde Türkçe özetle…'"
              className="w-full bg-bgsoft/60 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => { reset(); setCreating(false); }} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-ink transition-colors">İptal</button>
              <button onClick={create} disabled={!cmd.trim() || !prompt.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-branddim disabled:opacity-30 transition-colors">
                <Check size={13} /> Oluştur
              </button>
            </div>
          </div>
        )}
      </div>

      <AgentImport userAgents={userAgents} persist={persist} />

      {/* Kullanıcı agent'ları */}
      {userAgents.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand/70">Senin agent&apos;ların ({userAgents.length})</div>
          {userAgents.map((a) => (
            <div key={a.id} className="bg-brand/5 border border-brand/20 rounded-xl px-3.5 py-3">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5 shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm truncate">{a.label}</h3>
                    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand/15 text-brand/90 shrink-0">{a.command}</code>
                    <button onClick={() => persist(userAgents.filter((x) => x.id !== a.id))} className="ml-auto text-muted/40 hover:text-red transition-colors shrink-0" title="Sil"><Trash2 size={13} /></button>
                  </div>
                  <p className="text-[12px] text-muted/70 leading-relaxed mb-2">{a.description}</p>
                  <details className="text-[11px]">
                    <summary className="text-muted/50 cursor-pointer hover:text-muted">Sistem prompt&apos;u gör</summary>
                    <pre className="mt-2 text-[11px] font-mono bg-[#0a0a0d] text-muted/70 px-3 py-2 rounded-lg whitespace-pre-wrap leading-relaxed">{a.systemPrompt}</pre>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Yerleşik agent'lar */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted/50">
          Yerleşik agent&apos;lar — slash komutla tetiklenir
        </div>
        {builtIn.map((a) => (
          <div key={a.id} className="bg-bgsoft/40 border border-line/60 rounded-xl px-3.5 py-3">
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5 shrink-0">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm">{a.label}</h3>
                  <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400/80">
                    {a.command}
                  </code>
                </div>
                <p className="text-[12px] text-muted/70 leading-relaxed mb-2">{a.description}</p>
                <details className="text-[11px]">
                  <summary className="text-muted/50 cursor-pointer hover:text-muted">Sistem prompt&apos;u gör</summary>
                  <pre className="mt-2 text-[11px] font-mono bg-[#0a0a0d] text-muted/70 px-3 py-2 rounded-lg whitespace-pre-wrap leading-relaxed">{a.systemPrompt}</pre>
                </details>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Progress Tab ───────── */

function ProgressTab({
  skills, totalUsage, resetSkillProgress,
}: {
  skills: Skill[];
  totalUsage: number;
  resetSkillProgress: () => void;
}) {
  const sorted = [...skills].sort((a, b) => b.usageCount - a.usageCount);
  const max = Math.max(1, ...skills.map((s) => s.usageCount));
  const active = skills.filter((s) => s.enabled);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Toplam skill" value={skills.length} />
        <StatCard label="Aktif" value={active.length} accent="amber" />
        <StatCard label="Toplam kullanım" value={totalUsage} accent="green" />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted/60">En çok kullanılanlar</h3>
        {totalUsage > 0 && (
          <button
            onClick={resetSkillProgress}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"
          >
            <RotateCcw size={10} /> Sıfırla
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={GitBranch} title="Veri yok" hint="Skill ekleyip sohbet ettiğinde ilerleme burada görünür." />
      ) : (
        <div className="space-y-1.5">
          {sorted.map((s) => {
            const pct = s.usageCount === 0 ? 0 : (s.usageCount / max) * 100;
            return (
              <div key={s.id} className="bg-bgsoft/30 border border-line/40 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {s.source === "file" ? <FileText size={11} className="text-muted/50 shrink-0" /> : <BookMarked size={11} className="text-amber-400/60 shrink-0" />}
                    <span className="text-xs font-medium truncate">{s.title}</span>
                    {!s.enabled && <span className="text-[10px] text-muted/40">(pasif)</span>}
                  </div>
                  <span className="text-[11px] font-mono text-muted shrink-0">{s.usageCount}×</span>
                </div>
                <div className="h-1.5 bg-bgsoft/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${s.enabled ? "bg-amber-400/70" : "bg-muted/30"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────── Helpers ───────── */

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "amber" | "green" }) {
  const color = accent === "amber" ? "text-amber-400" : accent === "green" ? "text-green" : "text-ink";
  return (
    <div className="bg-bgsoft/40 border border-line/60 rounded-xl px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted/50 font-semibold">{label}</p>
      <p className={`text-2xl font-bold leading-tight mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Zap; title: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <Icon size={28} className="mx-auto mb-3 text-muted/15" />
      <p className="text-sm text-muted/40">{title}</p>
      {hint && <p className="text-xs text-muted/30 mt-1">{hint}</p>}
    </div>
  );
}

function SkillCard({
  skill, editing, onEdit, onCancelEdit, onSave, onToggle, onRemove,
}: {
  skill: Skill;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<Skill>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(skill.title);
  const [content, setContent] = useState(skill.content);
  const [tagsRaw, setTagsRaw] = useState(skill.tags.join(", "));

  if (editing) {
    return (
      <div className="bg-bgsoft/40 border border-amber-400/40 rounded-xl px-3 py-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-bgsoft rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-1 ring-brand/40"
        />
        <input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="etiketler, virgül"
          className="w-full bg-bgsoft rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:ring-1 ring-brand/40"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full bg-bgsoft rounded-lg px-2.5 py-2 text-xs outline-none focus:ring-1 ring-brand/40 resize-none font-mono"
        />
        <div className="flex justify-end gap-1.5">
          <button onClick={onCancelEdit} className="text-[11px] px-2.5 py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors">İptal</button>
          <button
            onClick={() => onSave({
              title: title.trim() || skill.title,
              content: content.trim() || skill.content,
              tags: tagsRaw.split(",").map((x) => x.trim()).filter(Boolean),
            })}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors"
          >
            <Check size={11} /> Kaydet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-bgsoft/40 border rounded-xl px-3 py-2.5 group transition-colors ${skill.enabled ? "border-line/60" : "border-line/30 opacity-60"}`}>
      <div className="flex items-start gap-2.5">
        <button
          onClick={onToggle}
          className={`w-3.5 h-3.5 rounded border mt-1 shrink-0 grid place-items-center transition-colors ${
            skill.enabled
              ? "bg-amber-400 border-amber-400"
              : "border-line hover:border-muted bg-transparent"
          }`}
          title={skill.enabled ? "Devre dışı bırak" : "Aktifleştir"}
        >
          {skill.enabled && <Check size={9} className="text-black" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-semibold truncate">{skill.title}</span>
            {skill.source === "file" && (
              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand/10 text-brand/80">file</code>
            )}
            {skill.tags.map((t) => (
              <code key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400/80">{t}</code>
            ))}
            {skill.usageCount > 0 && (
              <span className="text-[10px] text-muted/50 font-mono">· {skill.usageCount}× kullanıldı</span>
            )}
          </div>
          <p className="text-[11px] text-muted/70 leading-relaxed whitespace-pre-wrap line-clamp-3">
            {skill.content}
          </p>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="text-muted/50 hover:text-ink p-1 rounded transition-colors" title="Düzenle">
            <Pencil size={11} />
          </button>
          <button onClick={onRemove} className="text-muted/50 hover:text-red p-1 rounded transition-colors" title="Sil">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
