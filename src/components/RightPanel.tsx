"use client";

import { useEffect, useMemo, useState } from "react";
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

  /* Auto-fallback when the current tool closes */
  useEffect(() => {
    if (active && tabs.find((t) => t.id === active)?.available) return;
    setActive(firstAvailable);
  }, [tabs, active, firstAvailable]);

  /* Auto-switch to newly opened tool */
  const prevOpen = useRefBag({
    editor: props.editorOpen,
    git: props.gitOpen,
    artifact: !!props.artifact,
  });
  useEffect(() => {
    if (props.editorOpen && !prevOpen.editor) setActive("editor");
    if (props.gitOpen && !prevOpen.git) setActive("git");
    if (props.artifact && !prevOpen.artifact) setActive("artifact");
  }, [props.editorOpen, props.gitOpen, props.artifact, prevOpen]);

  if (!firstAvailable) return null;

  /* Split view: show editor + preview side-by-side unless user switched to Git */
  const splitView =
    props.editorOpen && props.editorFile && props.artifact && active !== "git";

  const closeActive = () => {
    if (active === "editor") props.onCloseEditor();
    else if (active === "git") props.onCloseGit();
  };

  return (
    <div
      className="
        fixed inset-x-0 bottom-0 top-12 z-30 bg-bg
        md:static md:inset-auto md:z-auto md:w-[min(50vw,540px)] md:shrink-0
        flex flex-col min-h-0 border-line/60
        border-t md:border-t-0 md:border-l
        animate-in slide-in-from-bottom-4 md:animate-none duration-200
      "
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Tab strip */}
      <div className="h-10 shrink-0 flex items-center gap-0.5 px-2 border-b border-line/60 bg-surface/40">
        {tabs.filter((t) => t.available).map((t) => {
          const Icon = t.icon;
          /* In split view, editor AND artifact tabs both appear active */
          const isActive = splitView
            ? t.id === "editor" || t.id === "artifact"
            : t.id === active;
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
        {(splitView || (active && active !== "artifact")) && (
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
          {active === "editor" && props.editorFile && (
            <ErrorBoundary variant="inline" label="Editör çöktü">
              <EditorPanel
                file={props.editorFile}
                onClose={props.onCloseEditor}
                onAskAI={props.onAskAI}
              />
            </ErrorBoundary>
          )}
          {active === "git" && (
            <ErrorBoundary variant="inline" label="Git paneli çöktü">
              <GitPanel onClose={props.onCloseGit} />
            </ErrorBoundary>
          )}
          {active === "artifact" && props.artifact && (
            <ErrorBoundary variant="inline" label="Önizleme çöktü">
              <ArtifactPanel />
            </ErrorBoundary>
          )}
        </div>
      )}
    </div>
  );
}

import { useRef } from "react";
function useRefBag<T extends Record<string, boolean>>(values: T): T {
  const ref = useRef<T>(values);
  const prev = ref.current;
  ref.current = values;
  return prev;
}
