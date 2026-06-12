"use client";

import { X, FileText, Upload, ToggleLeft, ToggleRight, Trash2, Eye, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Skill } from "@/lib/types";

interface TabItem {
  id: "files" | "agents" | "progress";
  label: string;
}

const DEFAULT_FILES: Array<{ name: string; content: string }> = [
  {
    name: "typescript-kurallari.md",
    content: `# TypeScript Kuralları
- strict mod açık; any kullanma. Gerçekten bilinmiyorsa unknown kullan ve daralt.
- Tip ve arayüzleri import type ile içe aktar.
- Veri yapıları için mevcut arayüzleri yeniden kullan; kopya tip üretme.
- Fonksiyon dönüş tiplerini ve public API imzalarını açıkça yaz.
- null/undefined durumlarını optional chaining (?.) ve nullish coalescing (??) ile güvenli ele al.`,
  },
  {
    name: "nextjs-react-pratikleri.md",
    content: `# Next.js & React Pratikleri
- App Router kullanılır. Varsayılan Server Component'tir.
- Tarayıcı API'si, state veya event handler gerekiyorsa "use client" ekle.
- Hook kurallarına uy: hook'ları koşulsuz, bileşenin en üst seviyesinde çağır.
- Global durum için Zustand kullan; mevcut store action'larını tercih et.`,
  },
  {
    name: "tailwind-ui-tutarliligi.md",
    content: `# Tailwind & UI Tutarlılığı
- Tailwind CSS v4 kullanılır. Inline style yerine utility sınıfları kullan.
- Projenin tasarım token'larını kullan: bg-bg, bg-surface, text-ink, text-muted, border-line.
- Yuvarlatılmış köşeler (rounded-xl/rounded-2xl), ince kenarlıklar, transition-colors.
- İkonlar için lucide-react kullan.`,
  },
  {
    name: "guvenlik-gizlilik.md",
    content: `# Güvenlik & Gizlilik
- API anahtarları ve token'lar yalnızca tarayıcıda tutulur.
- Gizli bilgileri koda gömme; ortam değişkenlerini kullan.
- Kullanıcı girdisini doğrula; XSS'e karşı kaçışla.
- Dış kaynaklı içeriği güvenilmez kabul et.`,
  },
  {
    name: "git-commit-hijyeni.md",
    content: `# Git & Commit Hijyeni
- Yalnızca kullanıcı istediğinde commit/push yap.
- Commit'leri küçük ve odaklı tut.
- Commit öncesi değişiklikleri gözden geçir.
- Açık talimat olmadan PR oluşturma.`,
  },
];

export function LibraryModal() {
  const open = useStore((s) => s.libraryOpen);
  const setLibraryOpen = useStore((s) => s.setLibraryOpen);
  const skills = useStore((s) => s.skills);
  const addSkill = useStore((s) => s.addSkill);
  const toggleSkill = useStore((s) => s.toggleSkill);
  const removeSkill = useStore((s) => s.removeSkill);

  const [tab, setTab] = useState<TabItem["id"]>("files");
  const [preview, setPreview] = useState<Skill | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (preview) setPreview(null);
        else setLibraryOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setLibraryOpen, preview]);

  const fileSkills = skills.filter((s) => s.source === "file");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const existing = fileSkills.find((s) => s.fileName === file.name);
        if (existing) {
          // Güncelle
          const updated: Skill = { ...existing, content, enabled: true };
          removeSkill(existing.id);
          addSkill(updated);
        } else {
          const skill: Skill = {
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: file.name.replace(/\.[^.]+$/, ""),
            content,
            source: "file",
            enabled: true,
            fileName: file.name,
          };
          addSkill(skill);
        }
      };
      reader.readAsText(file);
    });
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddDefault = (name: string, content: string) => {
    const existing = fileSkills.find((s) => s.fileName === name);
    if (existing) {
      // Zaten varsa toggle
      toggleSkill(existing.id);
      return;
    }
    const skill: Skill = {
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: name.replace(/\.md$/, ""),
      content,
      source: "file",
      enabled: true,
      fileName: name,
    };
    addSkill(skill);
  };

  const isDefaultAdded = (name: string) => fileSkills.some((s) => s.fileName === name && s.enabled);

  const tabs: TabItem[] = [
    { id: "files", label: "Dosyalar" },
    { id: "agents", label: "Agents" },
    { id: "progress", label: "İlerleme" },
  ];

  if (!open) return null;

  // Preview modal
  if (preview) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-bg/80 backdrop-blur-sm">
        <div className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
            <h3 className="text-sm font-semibold">{preview.fileName ?? preview.title}</h3>
            <button
              onClick={() => setPreview(null)}
              className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"
            >
              <X size={15} />
            </button>
          </div>
          <pre className="flex-1 overflow-y-auto p-5 text-xs font-mono whitespace-pre-wrap leading-relaxed text-muted">
            {preview.content}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setLibraryOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Kütüphane"
    >
      <div className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
          <h2 className="text-sm font-semibold">Kütüphane</h2>
          <button
            onClick={() => setLibraryOpen(false)}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id ? "bg-amber-400 text-black" : "bg-bgsoft text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "files" && (
            <>
              {/* Upload */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bgsoft border border-line text-xs font-medium text-muted hover:text-ink hover:border-line/80 transition-colors cursor-pointer">
                  <Upload size={12} />
                  Dosya Yükle (.md, .txt, .rules)
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt,.rules,.cursorrules"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                <span className="text-[10px] text-muted/60">
                  {fileSkills.length} dosya yüklendi
                </span>
              </div>

              {/* Default files */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">
                  Varsayılan Referans Dosyaları
                </p>
                <div className="space-y-1">
                  {DEFAULT_FILES.map((df) => {
                    const added = isDefaultAdded(df.name);
                    return (
                      <div
                        key={df.name}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 hover:border-line/60 transition-colors"
                      >
                        <FileText size={13} className="text-muted/60 shrink-0" />
                        <span className="text-xs flex-1 truncate">{df.name}</span>
                        <button
                          onClick={() => setPreview({ id: "", title: df.name, content: df.content, source: "file", enabled: true, fileName: df.name })}
                          className="p-1 text-muted/40 hover:text-ink transition-colors"
                          title="Önizle"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => handleAddDefault(df.name, df.content)}
                          className={`p-1 transition-colors ${
                            added ? "text-amber-400" : "text-muted/40 hover:text-amber-400"
                          }`}
                          title={added ? "Kaldır" : "Ekle"}
                        >
                          {added ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Uploaded files */}
              {fileSkills.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted/50 mb-2">
                    Yüklenen Dosyalar
                  </p>
                  <div className="space-y-1">
                    {fileSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30 hover:border-line/60 transition-colors group"
                      >
                        <FileText size={13} className="text-muted/60 shrink-0" />
                        <span className="text-xs flex-1 truncate">{skill.fileName ?? skill.title}</span>
                        <button
                          onClick={() => setPreview(skill)}
                          className="p-1 text-muted/40 hover:text-ink transition-colors opacity-0 group-hover:opacity-100"
                          title="Önizle"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => toggleSkill(skill.id)}
                          className={`p-1 transition-colors ${
                            skill.enabled ? "text-amber-400" : "text-muted/40 hover:text-amber-400"
                          }`}
                          title={skill.enabled ? "Devre dışı bırak" : "Etkinleştir"}
                        >
                          {skill.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => removeSkill(skill.id)}
                          className="p-1 text-muted/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "agents" && (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                Agents (slash komutları) sohbet içinde <code className="bg-bgsoft px-1 rounded text-xs">/</code> ile tetiklenir:
              </p>
              {[
                { cmd: "/explain", desc: "Kod bloğunu açıklar" },
                { cmd: "/refactor", desc: "Kodu yeniden düzenler" },
                { cmd: "/test", desc: "Test yazar" },
                { cmd: "/fix", desc: "Hata ayıklar" },
                { cmd: "/review", desc: "Kod inceler" },
                { cmd: "/docs", desc: "Dokümantasyon üretir" },
              ].map((a) => (
                <div
                  key={a.cmd}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bgsoft/50 border border-line/30"
                >
                  <code className="text-xs font-mono text-amber-400 shrink-0 w-20">{a.cmd}</code>
                  <span className="text-xs text-muted">{a.desc}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "progress" && (
            <div className="text-center py-8">
              <p className="text-sm text-muted">Kullanım istatistikleri yakında eklenecek.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
