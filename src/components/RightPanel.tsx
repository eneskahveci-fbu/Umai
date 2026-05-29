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
      { id: "editor",   label: "Editör",  icon: FileCode2, available: props.editorOpen },
      { id: "git",      label: "Git",     icon: GitBranch, available: props.gitOpen },
      { id: "artifact", label: "Önizleme", icon: Sparkles, available: !!props.artifact },
    ],
    [props.editorOpen, props.gitOpen, props.artifact],
  );

  const firstAvailable = tabs.find((t) => t.available)?.id ?? null;
  const [active, setActive] = useState<Tool | null>(firstAvailable);

  /* Auto-focus a tool when it opens; auto-fallback when the current one closes */
  useEffect(() => {
    if (active && tabs.find((t) => t.id === active)?.available) return;
    setActive(firstAvailable);
  }, [tabs, active, firstAvailable]);

  /* Auto-switch to the newly opened tool (matches the user's intent click) */
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

  const closeActive = () => {
    if (active === "editor") props.onCloseEditor();
    else if (active === "git") props.onCloseGit();
    /* artifact closes via its own internal X (sets store) */
  };

  return (
    <div className="w-[540px] shrink-0 flex flex-col min-h-0 border-l border-line/60 bg-bg/60">
      {/* Tab strip */}
      <div className="h-10 shrink-0 flex items-center gap-0.5 px-2 border-b border-line/60 bg-surface/40">
        {tabs.filter((t) => t.available).map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-colors ${
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
        {active && active !== "artifact" && (
          <button
            onClick={closeActive}
            title="Bu sekmeyi kapat"
            className="text-muted/40 hover:text-ink p-1 rounded transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Active tool */}
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
    </div>
  );
}

/* Tiny helper to track previous open-states without a deps explosion. */
import { useRef } from "react";
function useRefBag<T extends Record<string, boolean>>(values: T): T {
  const ref = useRef<T>(values);
  const prev = ref.current;
  ref.current = values;
  return prev;
}
