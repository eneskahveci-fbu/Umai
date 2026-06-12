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

interface RightPanelProps {
  editorFile: EditorFile | null;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onAskAI: (text: string, context: string) => void;
  gitOpen: boolean;
  onCloseGit: () => void;
  artifact: Artifact | null;
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
        title="Sürükleyerek genişliği ayarla"
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
        /* Split: editor top (flex-1) + preview bottom (45%) */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden border-b border-line/60">
            <ErrorBoundary variant="inline" label="Editör çöktü">
              <EditorPanel
                file={props.editorFile!}
                onClose={props.onCloseEditor}
                onAskAI={props.onAskAI}
              />
            </ErrorBoundary>
          </div>
          <div className="h-[45%] shrink-0 overflow-hidden">
            <ErrorBoundary variant="inline" label="Önizleme çöktü">
              <ArtifactPanel />
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        /* Single tool view */
        <div className="flex-1 min-h-0 overflow-hidden">
          {effectiveActive === "editor" && props.editorFile && (
            <ErrorBoundary variant="inline" label="Editör çöktü">
              <EditorPanel
                file={props.editorFile}
                onClose={props.onCloseEditor}
                onAskAI={props.onAskAI}
              />
            </ErrorBoundary>
          )}
          {effectiveActive === "git" && (
            <ErrorBoundary variant="inline" label="Git paneli çöktü">
              <GitPanel onClose={props.onCloseGit} />
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
