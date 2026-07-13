"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  FolderGit2,
  ListChecks,
  MessageSquare,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { PROJECT_COLORS, projectColorHex } from "@/lib/constants";
import { setSurfaceOpenItem } from "@/lib/surfaceNav";
import type { StudioProjectBase } from "@/lib/types";

type Tab = "chats" | "settings" | "knowledge" | "skills" | "stats";

const EMOJI_CHOICES = ["📁", "🌐", "🔌", "📊", "📱", "⚙️", "🧪", "🚀", "🔬", "🧩", "📦", "🛠️", "💡", "🎨", "🔐", "📝"];

/* Doküman/Anket/Defter'in "Sohbetler" sekmesindeki projeye bağlama —
   üçü de config'te ayrı bir StudioProjectBase[] listesi (bkz. useStudioProject.ts),
   bu yüzden tek generic satır bileşeni (ContentSection) üçüne de hizmet eder. */
type ContentKind = "doc" | "form" | "notebook";
const CONTENT_META: Record<ContentKind, { key: "craftDocs" | "craftForms" | "craftNotebooks"; label: string; icon: typeof FileText; route: string }> = {
  doc: { key: "craftDocs", label: "Dokümanlar", icon: FileText, route: "/studio/dokuman" },
  form: { key: "craftForms", label: "Anketler", icon: ListChecks, route: "/studio/anket" },
  notebook: { key: "craftNotebooks", label: "Defterler", icon: BookOpen, route: "/studio/defter" },
};

export function ProjectModal() {
  const router = useRouter();
  const projectId = useStore((s) => s.projectModalId);
  const setProjectModalId = useStore((s) => s.setProjectModalId);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const chats = useStore((s) => s.chats);
  const updateProject = useStore((s) => s.updateProject);
  const addProjectFile = useStore((s) => s.addProjectFile);
  const removeProjectFile = useStore((s) => s.removeProjectFile);
  const addToast = useStore((s) => s.addToast);
  const selectChat = useStore((s) => s.selectChat);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const newChat = useStore((s) => s.newChat);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  const project = config.projects.find((p) => p.id === projectId) ?? null;
  const [tab, setTab] = useState<Tab>("chats");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, !!project, () => setProjectModalId(null));

  /* Projeye ait sohbetler (gizli hariç), en son oluşturulan önce — Claude'un
     Projeler sayfasındaki "bu projenin sohbetleri" listesinin karşılığı. */
  const projectChats = useMemo(
    () => chats.filter((c) => !c.incognito && c.projectId === projectId).sort((a, b) => b.created_at - a.created_at),
    [chats, projectId],
  );

  /* İstatistikler — projeye ait sohbetlerden (gizli hariç) türetilir. */
  const stats = useMemo(() => {
    const list = chats.filter((c) => !c.incognito && c.projectId === projectId);
    const tokensIn = list.reduce((a, c) => a + (c.totalInTokens ?? 0), 0);
    const tokensOut = list.reduce((a, c) => a + (c.totalOutTokens ?? 0), 0);
    const msgCount = list.reduce((a, c) => a + c.messages.length, 0);
    const lastActivity = list.reduce((a, c) => Math.max(a, c.created_at), 0);
    return { chatCount: list.length, tokensIn, tokensOut, msgCount, lastActivity };
  }, [chats, projectId]);

  if (!project) return null;

  const patch = (p: Parameters<typeof updateProject>[1]) => updateProject(project.id, p);
  const accent = projectColorHex(project.color);

  const readFiles = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        addProjectFile(project.id, { name: f.name, content: String(reader.result ?? "") });
      };
      reader.onerror = () => addToast(`Okunamadı: ${f.name}`, "error");
      reader.readAsText(f);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Settings2 }[] = [
    { id: "chats", label: "Sohbetler", icon: MessageSquare },
    { id: "settings", label: "Ayarlar", icon: Settings2 },
    { id: "knowledge", label: "Bilgi Tabanı", icon: BookOpen },
    { id: "skills", label: "Skills", icon: Sparkles },
    { id: "stats", label: "İstatistik", icon: FileText },
  ];

  /* Bir sohbeti aç: modalı kapat, ilgili sohbete geç. */
  const openChat = (chatId: string) => {
    selectChat(chatId);
    setProjectModalId(null);
  };

  /* Bu proje bağlamında yeni sohbet başlat (aktif proje olarak işaretlenir).
     Mobilde Sidebar hâlâ tam-ekran açık olabilir (bu modal onun üzerinden
     açılır) — o da kapanmalı, aksi halde kullanıcı ayrıca kapatmak zorunda. */
  const startNewChat = () => {
    setActiveProject(project.id);
    newChat(false);
    setProjectModalId(null);
    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
  };

  /* Doküman/Anket/Defter'i projeye bağla/çıkar — Sidebar'ın sohbet-taşıma
     dropdown'uyla aynı fikir, yalnız config'teki ilgili listeye uygulanır. */
  const setContentProject = (kind: ContentKind, itemId: string, pid: string | undefined) => {
    const { key } = CONTENT_META[kind];
    const list = ((config[key] as StudioProjectBase[] | undefined) ?? []).map((item) =>
      item.id === itemId ? { ...item, projectId: pid } : item
    );
    saveConfig({ ...config, [key]: list });
  };

  /* Bir dokümanı/anketi/defteri aç: modalı kapat, ilgili stüdyoya git (⌘K'nın
     kullandığı AYNI "belirli öğeyi aç" köprüsü — bkz. surfaceNav.ts). */
  const openContent = (kind: ContentKind, itemId: string) => {
    setSurfaceOpenItem(kind === "doc" ? "docs" : kind === "form" ? "forms" : "notebook", itemId);
    router.push(CONTENT_META[kind].route);
    setProjectModalId(null);
  };

  /* Doküman/Anket/Defter'in kendi bölümü: proje.id'ye bağlı olanları listeler,
     boş bir "+ Ekle" açılır menüsüyle henüz bağlı olmayanlardan birini bağlar. */
  const renderContentSection = (kind: ContentKind) => {
    const meta = CONTENT_META[kind];
    const Icon = meta.icon;
    const all = ((config[meta.key] as StudioProjectBase[] | undefined) ?? []);
    const inProject = all.filter((x) => x.projectId === project.id);
    const notInProject = all.filter((x) => x.projectId !== project.id);
    return (
      <div key={kind} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold text-muted/70 uppercase tracking-wide flex items-center gap-1.5">
            <Icon size={12} /> {meta.label} ({inProject.length})
          </h4>
          {notInProject.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) setContentProject(kind, e.target.value, project.id); }}
              className="bg-bgsoft border border-line rounded-lg px-2 py-1 text-[11px] outline-none focus:border-brand/50 cursor-pointer max-w-[140px]"
              aria-label={`${meta.label} ekle`}
            >
              <option value="">+ Ekle</option>
              {notInProject.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          )}
        </div>
        {inProject.length === 0 ? (
          <p className="text-[11px] text-muted/40 italic py-1">Bu projede henüz {meta.label.toLowerCase()} yok.</p>
        ) : (
          <div className="space-y-1">
            {inProject.map((x) => (
              <div key={x.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bgsoft border border-line/60">
                <button onClick={() => openContent(kind, x.id)} className="flex-1 min-w-0 text-left text-[12px] font-medium truncate hover:text-brand transition-colors">
                  {x.title}
                </button>
                <button onClick={() => setContentProject(kind, x.id, undefined)} aria-label="Projeden çıkar" title="Projeden çıkar" className="text-muted/40 hover:text-red p-0.5 shrink-0">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => setProjectModalId(null)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={project.name}
        className="w-full max-w-lg max-h-[88vh] flex flex-col bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line/60">
          <span
            className="w-9 h-9 grid place-items-center rounded-xl text-lg shrink-0"
            style={{ background: `${accent}1a`, border: `1px solid ${accent}55` }}
          >
            {project.icon || "📁"}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm truncate">{project.name}</h3>
            <p className="text-[11px] text-muted/70 truncate">
              {stats.chatCount} sohbet{project.description ? ` · ${project.description}` : ""}
            </p>
          </div>
          <button onClick={() => setProjectModalId(null)} className="text-muted hover:text-ink p-1" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-line/60 overflow-x-auto no-scrollbar shrink-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-t-lg transition-colors shrink-0 whitespace-nowrap ${
                  active ? "text-brand border-b-2 border-brand" : "text-muted/70 hover:text-ink"
                }`}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === "chats" && (
            <>
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand hover:bg-branddim text-[#111110] font-semibold text-sm transition-colors"
              >
                <Plus size={15} /> Yeni sohbet
              </button>
              <div className="space-y-1.5">
                {projectChats.length === 0 && (
                  <p className="text-[12px] text-muted/40 italic text-center py-6">Bu projede henüz sohbet yok.</p>
                )}
                {projectChats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openChat(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bgsoft border border-line/60 hover:border-brand/40 text-left transition-colors"
                  >
                    <MessageSquare size={14} className="text-muted/60 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-medium truncate">{c.title || "Yeni sohbet"}</span>
                      <span className="block text-[10px] text-muted/50">
                        {c.messages.length} mesaj · {new Date(c.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-line/60 space-y-4">
                {renderContentSection("doc")}
                {renderContentSection("form")}
                {renderContentSection("notebook")}
              </div>
            </>
          )}

          {tab === "settings" && (
            <>
              <Field label="Proje adı">
                <input
                  value={project.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50"
                />
              </Field>

              <Field label="Açıklama">
                <input
                  value={project.description ?? ""}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Kısa açıklama (opsiyonel)"
                  className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50 placeholder:text-muted/35"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="İkon">
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_CHOICES.map((e) => (
                      <button
                        key={e}
                        onClick={() => patch({ icon: e })}
                        className={`w-7 h-7 grid place-items-center rounded-lg text-base transition-colors ${
                          project.icon === e ? "bg-brand/15 ring-1 ring-brand/50" : "hover:bg-bgsoft"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Renk">
                  <div className="flex flex-wrap gap-1.5">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => patch({ color: c.key })}
                        title={c.label}
                        className={`w-6 h-6 rounded-full transition-transform ${project.color === c.key ? "ring-2 ring-offset-2 ring-offset-surface scale-110" : "hover:scale-105"}`}
                        style={{ background: c.hex, ["--tw-ring-color" as string]: c.hex }}
                      />
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="Özel talimatlar (sistem promptu)">
                <textarea
                  value={project.systemPrompt}
                  onChange={(e) => patch({ systemPrompt: e.target.value })}
                  rows={4}
                  placeholder="Bu proje aktifken her sohbete eklenecek talimatlar…"
                  className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50 resize-y placeholder:text-muted/35"
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Model">
                  <select
                    value={project.modelId ?? ""}
                    onChange={(e) => patch({ modelId: e.target.value || undefined })}
                    className="w-full bg-bgsoft border border-line rounded-lg px-2 py-2 text-xs outline-none focus:border-brand/50"
                  >
                    <option value="">Genel aktif</option>
                    {config.models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Sıcaklık">
                  <input
                    type="number" step="0.1" min="0" max="2"
                    value={project.temperature ?? ""}
                    onChange={(e) => patch({ temperature: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="—"
                    className="w-full bg-bgsoft border border-line rounded-lg px-2 py-2 text-xs outline-none focus:border-brand/50 placeholder:text-muted/35"
                  />
                </Field>
                <Field label="Maks. token">
                  <input
                    type="number" min="1"
                    value={project.maxTokens ?? ""}
                    onChange={(e) => patch({ maxTokens: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="—"
                    className="w-full bg-bgsoft border border-line rounded-lg px-2 py-2 text-xs outline-none focus:border-brand/50 placeholder:text-muted/35"
                  />
                </Field>
              </div>

              <Field label="Varsayılan depo (proje açılınca bağlanır)">
                <div className="flex items-center gap-2 bg-bgsoft border border-line rounded-lg px-3 py-2 focus-within:border-brand/50">
                  <FolderGit2 size={14} className="text-muted/60 shrink-0" />
                  <input
                    value={project.repo ?? ""}
                    onChange={(e) => patch({ repo: e.target.value.trim() || undefined })}
                    placeholder="owner/repo veya gitlab.com/ns/repo"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/35"
                  />
                </div>
              </Field>
            </>
          )}

          {tab === "knowledge" && (
            <>
              <p className="text-[12px] text-muted/80 leading-relaxed">
                Yüklenen dosyalar bu projedeki <strong>her sohbete</strong> referans bağlam olarak verilir
                (dosya başına ~6.000 karakter).
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed border-line hover:border-brand/40 text-muted hover:text-brand transition-colors text-sm"
              >
                <Upload size={15} /> Dosya yükle
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { readFiles(e.target.files); e.target.value = ""; }}
              />
              <div className="space-y-1.5">
                {(project.files ?? []).length === 0 && (
                  <p className="text-[12px] text-muted/40 italic text-center py-4">Henüz dosya yok.</p>
                )}
                {(project.files ?? []).map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bgsoft border border-line/60">
                    <FileText size={14} className="text-muted/60 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-[12px]">{f.name}</span>
                    <span className="text-[10px] text-muted/50 tabular-nums shrink-0">{(f.content.length / 1024).toFixed(1)} KB</span>
                    <button
                      onClick={() => removeProjectFile(project.id, f.id)}
                      className="text-muted/50 hover:text-red p-0.5 shrink-0"
                      aria-label="Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "skills" && (
            <>
              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.skillIds != null}
                  onChange={(e) => patch({ skillIds: e.target.checked ? [] : undefined })}
                  className="accent-brand"
                />
                <span className="text-muted">
                  Bu projeye özel Skills seç (kapalıyken global aktif Skills kullanılır)
                </span>
              </label>
              {project.skillIds != null && (
                <div className="space-y-1.5">
                  {(config.skills ?? []).length === 0 && (
                    <p className="text-[12px] text-muted/40 italic text-center py-4">Hiç Skill yok.</p>
                  )}
                  {(config.skills ?? []).map((sk) => {
                    const checked = project.skillIds?.includes(sk.id) ?? false;
                    return (
                      <label
                        key={sk.id}
                        className="flex items-start gap-2 px-3 py-2 rounded-lg bg-bgsoft border border-line/60 cursor-pointer hover:border-line"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = project.skillIds ?? [];
                            patch({ skillIds: e.target.checked ? [...cur, sk.id] : cur.filter((x) => x !== sk.id) });
                          }}
                          className="accent-brand mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-[12px] font-medium truncate">{sk.title}</span>
                          <span className="block text-[10px] text-muted/50 truncate">{sk.source === "file" ? "Dosya" : "Kural"}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === "stats" && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Sohbet" value={String(stats.chatCount)} />
              <Stat label="Mesaj" value={String(stats.msgCount)} />
              <Stat label="Girdi token" value={stats.tokensIn.toLocaleString("tr-TR")} />
              <Stat label="Çıktı token" value={stats.tokensOut.toLocaleString("tr-TR")} />
              <div className="col-span-2">
                <Stat
                  label="Son aktivite"
                  value={stats.lastActivity ? new Date(stats.lastActivity).toLocaleString("tr-TR") : "—"}
                />
              </div>
              <div className="col-span-2">
                <Stat label="Bilgi tabanı" value={`${(project.files ?? []).length} dosya`} />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-line/60 flex justify-end">
          <button
            onClick={() => setProjectModalId(null)}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-branddim text-[#111110] font-semibold text-sm transition-colors"
          >
            Bitti
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted/70 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 rounded-xl bg-bgsoft border border-line/60">
      <div className="text-[10px] text-muted/60 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}
