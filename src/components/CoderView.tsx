"use client";

import { useEffect, useState } from "react";
import hljs from "highlight.js/lib/common";
import {
  File,
  FolderGit2,
  Menu,
  MessageSquarePlus,
  RefreshCw,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SelectorBar } from "./SelectorBar";
import {
  buildTree,
  fetchFileContent,
  fetchRepoTree,
  parseRepo,
} from "@/lib/github";
import type { TreeNode } from "@/lib/types";

const ERROR_MAP: Record<string, string> = {
  "Failed to fetch": "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.",
  "Not Found": "Depo bulunamadı. Adı ve yetkilendirmeyi kontrol edin.",
};

function turkishError(msg: string): string {
  return ERROR_MAP[msg] || msg.replace("rate limit", "istek limiti");
}

export function CoderView() {
  const config = useStore((s) => s.config);
  const repo = useStore((s) => s.repo);
  const tree = useStore((s) => s.tree);
  const currentFile = useStore((s) => s.currentFile);
  const setRepo = useStore((s) => s.setRepo);
  const setTree = useStore((s) => s.setTree);
  const setCurrentFile = useStore((s) => s.setCurrentFile);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const connect = async () => {
    const store = useStore.getState();
    const parsed = parseRepo(store.config.activeRepo || "");
    if (!parsed) {
      setError("Geçerli bir depo seç (kullanici/depo).");
      return;
    }
    const token = store.activeGithub()?.token;
    setConnecting(true);
    setError(null);
    setCurrentFile(null);
    try {
      const { branch, items } = await fetchRepoTree(
        parsed.owner,
        parsed.repo,
        token,
      );
      setRepo({ ...parsed, branch });
      setTree(buildTree(items));
    } catch (e) {
      setError(turkishError((e as Error).message));
      setTree(null);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (config.activeRepo) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId]);

  const openFile = async (path: string) => {
    if (!repo) return;
    setLoadingFile(true);
    try {
      const token = useStore.getState().activeGithub()?.token;
      const content = await fetchFileContent(
        repo.owner,
        repo.repo,
        repo.branch,
        path,
        token,
      );
      setCurrentFile({ path, content });
    } catch (e) {
      setCurrentFile({
        path,
        content: `// Dosya açılamadı: ${turkishError((e as Error).message)}`,
      });
    } finally {
      setLoadingFile(false);
    }
  };

  const sendToChat = () => {
    if (!currentFile) return;
    const ext = currentFile.path.split(".").pop() || "";
    const msg = `Şu dosyaya bakar mısın — \`${currentFile.path}\`:\n\n\`\`\`${ext}\n${currentFile.content}\n\`\`\`\n\nBu dosyayı açıkla / iyileştirme öner.`;
    const store = useStore.getState();
    if (!store.currentId) store.newChat(false);
    store.setPendingInput(msg);
    store.setView("chat");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Üst bar */}
      <div className="min-h-14 shrink-0 flex items-center gap-3 px-4 py-2 border-b border-line flex-wrap">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden text-muted"
        >
          <Menu size={20} />
        </button>
        <SelectorBar />
        <button
          onClick={connect}
          disabled={connecting}
          className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand hover:bg-branddim text-white font-semibold disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={connecting ? "animate-spin" : ""}
          />
          {connecting ? "Bağlanıyor" : "Bağlan / Yenile"}
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Dosya ağacı */}
        <div className="w-[280px] shrink-0 border-r border-line overflow-auto p-2">
          {error ? (
            <div className="text-center py-8 px-3">
              <FolderGit2
                size={28}
                className="mx-auto mb-2 text-red/60"
              />
              <p className="text-xs text-red leading-relaxed">{error}</p>
              <button
                onClick={connect}
                className="mt-3 text-xs text-brand hover:text-branddim font-semibold"
              >
                Tekrar dene
              </button>
            </div>
          ) : !tree ? (
            <div className="text-center py-8 px-3">
              <FolderGit2
                size={28}
                className="mx-auto mb-2 text-muted/40"
              />
              <p className="text-xs text-muted leading-relaxed">
                {connecting
                  ? "Depo yükleniyor..."
                  : 'Bir depo seçip "Bağlan / Yenile" butonuna tıkla.'}
              </p>
            </div>
          ) : (
            <TreeView
              node={tree}
              root
              onOpen={openFile}
              activePath={currentFile?.path}
            />
          )}
        </div>

        {/* Dosya görüntüleyici */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line">
            <span className="font-mono text-[13px] text-cyan truncate">
              {currentFile?.path ?? "Dosya seçilmedi"}
            </span>
            {currentFile && (
              <button
                onClick={sendToChat}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-branddim bg-brand/10 text-brand font-semibold whitespace-nowrap"
              >
                <MessageSquarePlus size={14} /> Sohbete gönder
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {loadingFile ? (
              <div className="h-full grid place-items-center text-muted">
                Yükleniyor...
              </div>
            ) : currentFile ? (
              <CodeView
                path={currentFile.path}
                content={currentFile.content}
              />
            ) : (
              <div className="h-full grid place-items-center text-muted text-center px-8">
                <div>
                  <FolderGit2
                    size={40}
                    className="mx-auto mb-3 opacity-60"
                  />
                  Soldan bir dosya seç. İçeriğini gör, sonra
                  <br />
                  &quot;Sohbete gönder&quot; ile kod hakkında soru sor.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeView({ path, content }: { path: string; content: string }) {
  const ext = path.split(".").pop() || "";
  let html: string;
  try {
    html = hljs.getLanguage(ext)
      ? hljs.highlight(content, { language: ext }).value
      : hljs.highlightAuto(content).value;
  } catch {
    html = content.replace(
      /[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string,
    );
  }
  return (
    <pre className="text-[13px] leading-relaxed p-5 font-mono">
      <code
        className="hljs bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}

function TreeView({
  node,
  root,
  onOpen,
  activePath,
}: {
  node: TreeNode;
  root?: boolean;
  onOpen: (path: string) => void;
  activePath?: string;
}) {
  return (
    <div className={root ? "" : "ml-3"}>
      {Object.keys(node.dirs)
        .sort()
        .map((name) => (
          <details key={name} open={root}>
            <summary className="cursor-pointer text-sm px-2 py-1 rounded hover:bg-bgsoft list-none flex items-center gap-1.5">
              📁 {name}
            </summary>
            <TreeView
              node={node.dirs[name]}
              onOpen={onOpen}
              activePath={activePath}
            />
          </details>
        ))}
      {node.files
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => (
          <div
            key={f.path}
            onClick={() => onOpen(f.path)}
            className={`cursor-pointer text-sm px-2 py-1 pl-6 rounded flex items-center gap-1.5 ${
              activePath === f.path
                ? "bg-cyan/10 text-cyan"
                : "text-muted hover:bg-bgsoft hover:text-ink"
            }`}
          >
            <File size={13} className="shrink-0" /> {f.name}
          </div>
        ))}
    </div>
  );
}
