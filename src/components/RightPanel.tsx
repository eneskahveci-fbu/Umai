"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FileCode2, GitBranch, Sparkles, X } from "lucide-react";
import type { EditorFile } from "@/lib/editor";
import type { Artifact } from "@/lib/types";

const EditorPanel = dynamic(() => import("./EditorPanel").then((m) => m.EditorPanel), { ssr: false });
import { GitPanel } from "./GitPanel";
import { ArtifactPanel } from "./ArtifactPanel";
import { ErrorBoundary } from "./ErrorBoundary";

type Tool = "editor" | "git" | "artifact";

/* Editör üstündeki dosya sekmesi şeridi — birden fazla dosya açıkken görünür. */
function FileTabsBar({
  tabs, activePath, onSelect, onClose,
}: {
  tabs: EditorFile[];
  activePath: string | null;
  onSelect: (p: string) => void;
  onClose: (p: string) => void;
}) {
  if (tabs.length < 2) return null;
  return (
    <div className="h-8 shrink-0 flex items-stretch overflow-x-auto border-b border-line/60 bg-surface/30">
      {tabs.map((t) => {
        const name = t.path.split("/").pop() || t.path;
        const active = t.path === activePath;
        return (
          <div
            key={t.path}
            onClick={() => onSelect(t.path)}
            title={t.path}
            className={`group/tab flex items-center gap-1.5 pl-3 pr-1.5 max-w-[180px] cursor-pointer border-r border-line/40 text-[11px] transition-colors ${
              active ? "bg-bg text-ink" : "text-muted/70 hover:text-ink hover:bg-bgsoft/50"
            }`}
          >
            <span className="truncate">{name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.path); }}
              className="w-4 h-4 grid place-items-center rounded text-muted/40 hover:text-ink hover:bg-line/60 shrink-0"
              aria-label="Sekmeyi kapat"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface RightPanelProps {
  editorFile: EditorFile | null;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onAskAI: (text: string, context: string) => void;
  gitOpen: boolean;
  onCloseGit: () => void;
  /** Git panelinden "PR/MR İncele" modalını açar (birleşik Git & PR butonu). */
  onReviewPr?: () => void;
  artifact: Artifact | null;
  /** Çoklu dosya sekmeleri: açık dosyalar + seç/kapat ve kirli durum bildirimi. */
  openTabs?: EditorFile[];
  onSelectTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;
  onEditorDirtyChange?: (dirty: boolean) => void;
}

export function RightPanel(props: RightPanelProps) {
  const tabs = useMemo<{ id: Tool; label: string; icon: typeof FileCode2; available: boolean }[]>(
    () => [
      { id: "editor",   label: "Editör",   icon: FileCode2, available: props.editorOpen },
      { id: "git",      label: "Git",      icon: GitBranch, available: props.gitOpen },
      { id: "artifact", label: "Önizleme", icon: Sparkles,  available: !!props.artifact },
    ],
    [props.editorOpen, props.gitOpen, props.artifact],
  );

  const firstAvailable = tabs.find((t) => t.available)?.id ?? null;
  const [active, setActive] = useState<Tool | null>(firstAvailable);

  /* The effective tab: the user's choice when it's still open, otherwise the
     first available tool. Derived during render so it stays in sync with tab
     availability without an extra state-syncing effect. */
  const effectiveActive =
    active && tabs.find((t) => t.id === active)?.available ? active : firstAvailable;

  /* Auto-switch to a tool the moment it transitions from closed → open.
     The previous-open snapshot is read/written inside the effect (never during
     render) so concurrent re-renders stay safe. */
  const prevOpen = useRef({
    editor: props.editorOpen,
    git: props.gitOpen,
    artifact: !!props.artifact,
  });
  useEffect(() => {
    const cur = { editor: props.editorOpen, git: props.gitOpen, artifact: !!props.artifact };
    if (cur.editor && !prevOpen.current.editor) setActive("editor");
    if (cur.git && !prevOpen.current.git) setActive("git");
    if (cur.artifact && !prevOpen.current.artifact) setActive("artifact");
    prevOpen.current = cur;
  }, [props.editorOpen, props.gitOpen, props.artifact]);

  /* Boyutlandırılabilir genişlik (masaüstü). Lazy init → SSR güvenli, set-state
     effect'i yok. Sol kenardan sürükle; her değişimde localStorage'a yaz. */
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 540;
    const saved = Number(localStorage.getItem("craftai_rightpanel_w"));
    return saved >= 360 ? saved : 540;
  });
  useEffect(() => {
    try { localStorage.setItem("craftai_rightpanel_w", String(width)); } catch { /* ignore */ }
  }, [width]);

  /* Split görünümde önizleme yüksekliği (%) — sürüklenebilir dikey ayraç. */
  const [previewH, setPreviewH] = useState<number>(() => {
    if (typeof window === "undefined") return 45;
    const saved = Number(localStorage.getItem("craftai_rightpanel_split"));
    return saved >= 20 && saved <= 75 ? saved : 45;
  });
  useEffect(() => {
    try { localStorage.setItem("craftai_rightpanel_split", String(previewH)); } catch { /* ignore */ }
  }, [previewH]);
  const splitRef = useRef<HTMLDivElement>(null);

  if (!firstAvailable) return null;

  /* Split view: show editor + preview side-by-side unless user switched to Git */
  const splitView =
    props.editorOpen && props.editorFile && props.artifact && effectiveActive !== "git";

  const closeActive = () => {
    if (effectiveActive === "editor") props.onCloseEditor();
    else if (effectiveActive === "git") props.onCloseGit();
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (me: MouseEvent) => {
      const next = Math.min(Math.max(startW + (startX - me.clientX), 360), Math.round(window.innerWidth * 0.75));
      setWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /* Editör↔önizleme dikey ayracı — split kabının yüksekliğine göre % hesaplar. */
  const startSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = splitRef.current?.getBoundingClientRect();
    if (!rect) return;
    const onMove = (me: MouseEvent) => {
      const pct = ((rect.bottom - me.clientY) / rect.height) * 100;
      setPreviewH(Math.min(75, Math.max(20, Math.round(pct))));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="
        fixed inset-x-0 bottom-0 top-12 z-30 bg-bg
        md:relative md:inset-auto md:z-auto md:w-[var(--rp-w)] md:shrink-0
        flex flex-col min-h-0 border-line/60
        border-t md:border-t-0 md:border-l
        animate-in slide-in-from-bottom-4 md:animate-none duration-200
      "
      style={{ paddingBottom: "env(safe-area-inset-bottom)", ["--rp-w" as string]: `${width}px` }}
    >
      {/* Sürükleme tutamacı (masaüstü) — sol kenardan genişlik ayarla */}
      <div
        onMouseDown={startResize}
        onDoubleClick={() => setWidth(540)}
        title="Sürükle: genişlik · Çift tık: sıfırla"
        className="hidden md:block absolute left-0 inset-y-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-brand/40 active:bg-brand/60 transition-colors z-20"
      />
      {/* Tab strip */}
      <div className="h-10 shrink-0 flex items-center gap-0.5 px-2 border-b border-line/60 bg-surface/40">
        {tabs.filter((t) => t.available).map((t) => {
          const Icon = t.icon;
          /* In split view, editor AND artifact tabs both appear active */
          const isActive = splitView
            ? t.id === "editor" || t.id === "artifact"
            : t.id === effectiveActive;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-1.5 px-3 h-9 sm:h-7 rounded-lg text-[11px] font-semibold transition-colors min-w-0 ${
                isActive
                  ? "bg-bg text-ink shadow-sm"
                  : "text-muted/70 hover:text-ink hover:bg-bgsoft/60"
              }`}
            >
              <Icon size={11} />
              {t.label}
            </button>
          );
        })}
        <div className="flex-1" />
        {/* X button: in split view close editor; in single view close active */}
        {(splitView || (effectiveActive && effectiveActive !== "artifact")) && (
          <button
            onClick={splitView ? props.onCloseEditor : closeActive}
            aria-label="Kapat"
            title="Kapat"
            className="text-muted/40 hover:text-ink w-8 h-8 grid place-items-center rounded-lg hover:bg-bgsoft transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Content */}
      {splitView ? (
        /* Split: editör üst (esnek) + sürüklenebilir ayraç + önizleme alt (%) */
        <div ref={splitRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <FileTabsBar
              tabs={props.openTabs ?? []}
              activePath={props.editorFile?.path ?? null}
              onSelect={(p) => props.onSelectTab?.(p)}
              onClose={(p) => props.onCloseTab?.(p)}
            />
            <div className="flex-1 min-h-0 overflow-hidden">
              <ErrorBoundary variant="inline" label="Editör çöktü">
                <EditorPanel
                  file={props.editorFile!}
                  onClose={props.onCloseEditor}
                  onAskAI={props.onAskAI}
                  onDirtyChange={props.onEditorDirtyChange}
                />
              </ErrorBoundary>
            </div>
          </div>
          <div
            onMouseDown={startSplitResize}
            onDoubleClick={() => setPreviewH(45)}
            title="Sürükle: önizleme yüksekliği · Çift tık: sıfırla"
            className="h-1.5 shrink-0 cursor-row-resize bg-line/40 hover:bg-brand/40 active:bg-brand/60 transition-colors"
          />
          <div className="shrink-0 overflow-hidden" style={{ height: `${previewH}%` }}>
            <ErrorBoundary variant="inline" label="Önizleme çöktü">
              <ArtifactPanel />
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        /* Single tool view */
        <div className="flex-1 min-h-0 overflow-hidden">
          {effectiveActive === "editor" && props.editorFile && (
            <div className="h-full flex flex-col min-h-0">
              <FileTabsBar
                tabs={props.openTabs ?? []}
                activePath={props.editorFile.path}
                onSelect={(p) => props.onSelectTab?.(p)}
                onClose={(p) => props.onCloseTab?.(p)}
              />
              <div className="flex-1 min-h-0 overflow-hidden">
                <ErrorBoundary variant="inline" label="Editör çöktü">
                  <EditorPanel
                    file={props.editorFile}
                    onClose={props.onCloseEditor}
                    onAskAI={props.onAskAI}
                    onDirtyChange={props.onEditorDirtyChange}
                  />
                </ErrorBoundary>
              </div>
            </div>
          )}
          {effectiveActive === "git" && (
            <ErrorBoundary variant="inline" label="Git paneli çöktü">
              <GitPanel onClose={props.onCloseGit} onReviewPr={props.onReviewPr} />
            </ErrorBoundary>
          )}
          {effectiveActive === "artifact" && props.artifact && (
            <ErrorBoundary variant="inline" label="Önizleme çöktü">
              <ArtifactPanel />
            </ErrorBoundary>
          )}
        </div>
      )}
    </div>
  );
}
