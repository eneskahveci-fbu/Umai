"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  File,
  FolderGit2,
  FolderOpen,
  Folder,
  Globe,
  Image as ImageIcon,
  PanelLeft,
  Paperclip,
  RefreshCw,
  Search,
  Settings,
  Square,
  VenetianMask,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MessageBubble } from "./MessageBubble";
import {
  buildTree,
  fetchFileContent,
  fetchRepoTree,
  parseRepo,
} from "@/lib/github";
import type { TreeFile, TreeNode } from "@/lib/types";

/* ─── helpers ─── */

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

const EXT_COLOR: Record<string, string> = {
  ts: "text-blue-400", tsx: "text-blue-400",
  js: "text-yellow-400", jsx: "text-yellow-400",
  py: "text-green-400",
  css: "text-pink-400", scss: "text-pink-400",
  html: "text-orange-400",
  json: "text-yellow-600",
  md: "text-gray-300",
  go: "text-cyan-400",
  rs: "text-orange-500",
};

function FileIcon({ name, size = 13 }: { name: string; size?: number }) {
  const color = EXT_COLOR[getExt(name)] ?? "text-muted/60";
  return <File size={size} className={`shrink-0 ${color}`} />;
}

function getAllFiles(node: TreeNode): TreeFile[] {
  return [...node.files, ...Object.values(node.dirs).flatMap(getAllFiles)];
}

const CODER_SUGGESTIONS = [
  { icon: "🔍", text: "Bu kodu incele ve iyileştirme öner" },
  { icon: "🐛", text: "Bu hatayı nasıl düzeltebilirim?" },
  { icon: "⚡", text: "Bu fonksiyonu daha verimli yaz" },
  { icon: "✅", text: "Bu kod için unit test yaz" },
];

let coderAbort: AbortController | null = null;

type AttachedFile = { path: string; content: string };

/* ─── main component ─── */

export function CoderView() {
  const config = useStore((s) => s.config);
  const repo = useStore((s) => s.repo);
  const tree = useStore((s) => s.tree);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const incognito = useStore((s) => s.incognito);
  const streaming = useStore((s) => s.streaming);
  const pendingInput = useStore((s) => s.pendingInput);
  const followUpSuggestions = useStore((s) => s.followUpSuggestions);

  const setRepo = useStore((s) => s.setRepo);
  const setTree = useStore((s) => s.setTree);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setPendingInput = useStore((s) => s.setPendingInput);
  const setFollowUpSuggestions = useStore((s) => s.setFollowUpSuggestions);
  const addToast = useStore((s) => s.addToast);

  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [searchOn, setSearchOn] = useState(false);

  /* repo panel */
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [fetchingFile, setFetchingFile] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];

  /* pending input from CoderView → chat bridge */
  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput);
      setPendingInput(null);
      taRef.current?.focus();
    }
  }, [pendingInput, setPendingInput]);

  /* auto-scroll */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  /* textarea auto-height */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  /* close repo panel on outside click */
  useEffect(() => {
    if (!repoOpen) return;
    const handler = (e: MouseEvent) => {
      if (repoRef.current && !repoRef.current.contains(e.target as Node)) {
        setRepoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [repoOpen]);

  /* connect to repo */
  const connectRepo = async () => {
    const store = useStore.getState();
    const parsed = parseRepo(store.config.activeRepo || "");
    if (!parsed) {
      addToast("Ayarlar'dan bir GitHub deposu ekle.", "error");
      return;
    }
    const token = store.activeGithub()?.token;
    setConnecting(true);
    try {
      const { branch, items } = await fetchRepoTree(parsed.owner, parsed.repo, token);
      setRepo({ ...parsed, branch });
      setTree(buildTree(items));
    } catch (e) {
      addToast(`Depo bağlantısı başarısız: ${(e as Error).message}`, "error");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (config.activeRepo && !tree) connectRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId]);

  /* attach file from repo */
  const attachRepoFile = async (file: TreeFile) => {
    if (attachedFiles.find((f) => f.path === file.path)) {
      setAttachedFiles((prev) => prev.filter((f) => f.path !== file.path));
      return;
    }
    if (!repo) return;
    setFetchingFile(file.path);
    try {
      const token = useStore.getState().activeGithub()?.token;
      const content = await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, token);
      setAttachedFiles((prev) => [...prev, { path: file.path, content }]);
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  /* file readers */
  const readFileIntoInput = (f: File) => {
    if (f.type.startsWith("image/")) {
      if (f.size > 5_000_000) { addToast("Görsel 5MB'den büyük.", "error"); return; }
      const reader = new FileReader();
      reader.onload = () => setPendingImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
      return;
    }
    if (f.size > 512_000) { addToast("Dosya 512KB'den büyük.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const ext = f.name.split(".").pop() || "";
      setInput((prev) => prev + (prev ? "\n\n" : "") + `\`${f.name}\`:\n\`\`\`${ext}\n${reader.result as string}\n\`\`\``);
      taRef.current?.focus();
    };
    reader.readAsText(f);
  };

  /* api call */
  const fetchFollowUps = useCallback(async () => {
    const store = useStore.getState();
    if (!store.config.followUps) return;
    const active = store.activeModel();
    if (!active) return;
    const chat = store.current();
    if (!chat || chat.messages.length < 2) return;
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
          baseUrl: active.baseUrl,
          model: active.model,
          apiKey: active.apiKey,
        }),
      });
      const { suggestions } = await res.json();
      store.setFollowUpSuggestions(suggestions || []);
    } catch { /* yoksay */ }
  }, []);

  const callApi = useCallback(async () => {
    const store = useStore.getState();
    const active = store.activeModel();
    if (!active) { store.setSettingsOpen(true); return; }

    const apiMessages = (store.current()?.messages ?? []).map((m) => {
      if (m.images?.length) {
        const content: unknown[] = m.images.map((img) => ({
          type: "image_url",
          image_url: { url: img },
        }));
        content.push({ type: "text", text: m.content });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

    const coderSystemPrompt = [
      config.systemPrompt,
      "Sen uzman bir yazılım geliştiricisisin. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun. Hata ayıklarken adım adım düşün.",
    ].filter(Boolean).join("\n\n");

    store.pushMessage({ role: "assistant", content: "" });
    store.setStreaming(true);
    store.setFollowUpSuggestions([]);
    coderAbort = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: coderAbort.signal,
        body: JSON.stringify({
          messages: apiMessages,
          baseUrl: active.baseUrl,
          model: active.model,
          apiKey: active.apiKey,
          provider: active.provider,
          systemPrompt: coderSystemPrompt,
          style: store.config.style,
          memories: store.config.memories,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
            if (delta) { full += delta; useStore.getState().updateLastContent(full); }
          } catch { /* parçalı satır */ }
        }
      }
      if (!full) useStore.getState().updateLastContent("_(Model boş yanıt döndürdü.)_");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        useStore.getState().updateLastContent(`**Hata:** ${(err as Error).message}\n\n_Anahtar/model doğru mu? Ayarlardan kontrol et._`);
      }
    } finally {
      coderAbort = null;
      useStore.getState().setStreaming(false);
      await useStore.getState().persistCurrent();
      fetchFollowUps();
    }
  }, [config.systemPrompt, fetchFollowUps]);

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || streaming) return;
    const store = useStore.getState();
    if (!store.activeModel()) { store.setSettingsOpen(true); return; }
    if (!store.currentId) store.newChat(incognito);

    /* prepend attached file contents */
    let fullText = text;
    if (attachedFiles.length > 0) {
      const ctx = attachedFiles
        .map((f) => `\`${f.path}\`:\n\`\`\`${getExt(f.path)}\n${f.content.slice(0, 10000)}\n\`\`\``)
        .join("\n\n");
      fullText = ctx + (text ? "\n\n" + text : "");
    }

    store.pushMessage({
      role: "user",
      content: fullText,
      images: pendingImages.length ? [...pendingImages] : undefined,
    });
    store.maybeSetTitle(text || attachedFiles[0]?.path || "Dosya analizi");
    setInput("");
    setPendingImages([]);
    setAttachedFiles([]);

    await callApi();
  };

  const stop = () => { coderAbort?.abort(); coderAbort = null; };

  const regenerate = async () => {
    if (streaming) return;
    const store = useStore.getState();
    const chat = store.current();
    if (!chat || chat.messages.length < 2) return;
    if (chat.messages[chat.messages.length - 1].role === "assistant") store.popLastMessage();
    await callApi();
  };

  const editAndResend = async (index: number, content: string) => {
    const store = useStore.getState();
    store.editMessageAt(index, content);
    store.truncateAfter(index);
    await callApi();
  };

  /* flat repo file list */
  const allFiles = tree ? getAllFiles(tree) : [];
  const filteredFiles = repoSearch
    ? allFiles.filter((f) => f.name.toLowerCase().includes(repoSearch.toLowerCase()) || f.path.toLowerCase().includes(repoSearch.toLowerCase()))
    : allFiles;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-line/60 bg-surface/60 backdrop-blur-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          title="Yan panel (Ctrl+B)"
          className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors shrink-0"
        >
          <PanelLeft size={17} />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/25 grid place-items-center">
            <Code2 size={14} className="text-brand" />
          </div>
          <span className="text-sm font-semibold text-ink">Coder</span>
          {repo && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-bgsoft border border-line/60 text-muted/70 font-mono">
              {repo.owner}/{repo.repo}
              <span className="text-muted/40">:</span>
              <span className="text-cyan">{repo.branch}</span>
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {config.models.length > 0 ? (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
              title="Model ayarları"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
              <span className="truncate text-xs font-medium text-muted/80">
                {config.models.find((m) => m.id === config.activeModelId)?.label ||
                  config.models.find((m) => m.id === config.activeModelId)?.model ||
                  "Model seç"}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-brand/40 text-brand hover:bg-brand/10 transition-colors"
            >
              + Model ekle
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {incognito && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple/10 text-purple border border-purple/30">
              <VenetianMask size={11} /> Gizli
            </span>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
            title="Ayarlar"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto px-5 pt-[8vh] text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center mx-auto mb-6">
              <Code2 size={28} className="text-brand" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Coding Assistant
            </h2>
            <p className="text-muted mt-2 text-sm leading-relaxed max-w-sm mx-auto">
              Kod yaz, hata ayıkla, refactor et. Depo dosyalarını bağlam olarak eklemek için{" "}
              <span className="text-brand font-medium">Repo</span> butonunu kullan.
            </p>
            {repo && (
              <div className="mt-4 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl bg-brand/8 border border-brand/20 text-brand/80">
                <FolderGit2 size={13} />
                {repo.owner}/{repo.repo} bağlı
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-2.5 mt-8 text-left">
              {CODER_SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => setInput(s.text)}
                  className="group/sug flex items-start gap-3 p-4 rounded-2xl border border-line bg-surface hover:border-brand/50 hover:bg-surface2 text-sm transition-all duration-200"
                >
                  <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
                  <span className="text-muted group-hover/sug:text-ink transition-colors leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-5 py-6">
            {messages.map((m, i) => {
              const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
              return (
                <MessageBubble
                  key={i}
                  index={i}
                  message={m}
                  showRegenerate={isLastAssistant && !streaming}
                  onRegenerate={regenerate}
                  onEdit={m.role === "user" ? editAndResend : undefined}
                />
              );
            })}
            {streaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex gap-3 py-4">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-brand/15 border border-brand/25 grid place-items-center">
                  <Code2 size={14} className="text-brand" />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <span className="typing-dot" />
                  <span className="typing-dot delay-1" />
                  <span className="typing-dot delay-2" />
                </div>
              </div>
            )}
            {!streaming && followUpSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 mb-4">
                {followUpSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); setFollowUpSuggestions([]); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-line bg-surface hover:border-brand/50 transition-colors text-muted hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <div
        className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent pt-2 pb-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); for (const f of Array.from(e.dataTransfer.files)) readFileIntoInput(f); }}
      >
        <div className="max-w-3xl mx-auto px-5">

          {/* Repo file picker panel */}
          {repoOpen && (
            <div
              ref={repoRef}
              className="mb-2 bg-surface border border-line/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 animate-fade-in"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-line/60">
                <div className="flex items-center gap-2">
                  <FolderGit2 size={15} className="text-brand" />
                  <span className="text-sm font-semibold">
                    {repo ? `${repo.owner}/${repo.repo}` : "Depo bağlı değil"}
                  </span>
                  {repo && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-cyan/10 text-cyan font-mono border border-cyan/20">
                      {repo.branch}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={connectRepo}
                    disabled={connecting}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink hover:border-brand/40 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={connecting ? "animate-spin" : ""} />
                    {connecting ? "Bağlanıyor…" : "Yenile"}
                  </button>
                  <button onClick={() => setRepoOpen(false)} className="p-1 rounded-lg text-muted hover:text-ink transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {!tree ? (
                <div className="py-8 text-center px-6">
                  <FolderGit2 size={28} className="mx-auto mb-3 text-muted/20" />
                  <p className="text-sm text-muted/60 mb-3">
                    {connecting ? "Depo yükleniyor…" : "Ayarlar → GitHub'dan depo ekle"}
                  </p>
                  {!connecting && (
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="text-xs px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/30 text-brand font-medium hover:bg-brand/20 transition-colors"
                    >
                      Ayarları aç
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div className="px-3 py-2 border-b border-line/40">
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
                      <input
                        value={repoSearch}
                        onChange={(e) => setRepoSearch(e.target.value)}
                        placeholder="Dosya ara…"
                        autoFocus
                        className="w-full bg-bgsoft/60 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35"
                      />
                    </div>
                  </div>
                  {/* File list */}
                  <div className="max-h-52 overflow-y-auto p-2">
                    {filteredFiles.length === 0 ? (
                      <p className="text-center text-xs text-muted/40 py-4">Sonuç yok</p>
                    ) : (
                      <>
                        <p className="text-[10px] text-muted/40 px-2 py-1">
                          {filteredFiles.length} dosya · tıkla → bağlam olarak ekle
                        </p>
                        {filteredFiles.slice(0, 80).map((f) => {
                          const isAttached = attachedFiles.some((a) => a.path === f.path);
                          const isFetching = fetchingFile === f.path;
                          return (
                            <button
                              key={f.path}
                              onClick={() => attachRepoFile(f)}
                              disabled={isFetching}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-left transition-colors ${
                                isAttached
                                  ? "bg-brand/10 text-brand border border-brand/20"
                                  : "text-muted/80 hover:text-ink hover:bg-bgsoft/60"
                              }`}
                            >
                              {isFetching ? (
                                <RefreshCw size={11} className="animate-spin shrink-0 text-brand" />
                              ) : (
                                <FileIcon name={f.name} size={11} />
                              )}
                              <span className="truncate flex-1">{f.path}</span>
                              {isAttached && <span className="text-[10px] font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Attached file chips */}
          {attachedFiles.length > 0 && (
            <div className="flex gap-2 mb-2.5 flex-wrap">
              {attachedFiles.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-brand/10 border border-brand/25 text-brand"
                >
                  <FileIcon name={f.path.split("/").pop() ?? ""} size={11} />
                  <span className="max-w-[180px] truncate font-mono">{f.path.split("/").pop()}</span>
                  <button
                    onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.path !== f.path))}
                    className="text-brand/60 hover:text-red transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pending images */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 mb-2.5 flex-wrap">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative group/img">
                  <img src={img} alt="" className="w-16 h-16 object-cover rounded-xl border border-line shadow-sm" />
                  <button
                    onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red text-white grid place-items-center text-xs opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input box */}
          <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-3 py-2.5 focus-within:border-brand/50 focus-within:shadow-[0_0_0_3px_rgba(124,92,255,0.08)] transition-all duration-200">
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => fileRef.current?.click()}
                title="Dosya ekle"
                className="text-muted hover:text-ink hover:bg-bgsoft p-1.5 rounded-lg transition-colors"
              >
                <Paperclip size={16} />
              </button>
              <button
                onClick={() => imgRef.current?.click()}
                title="Görsel ekle"
                className="text-muted hover:text-ink hover:bg-bgsoft p-1.5 rounded-lg transition-colors"
              >
                <ImageIcon size={16} />
              </button>
              <button
                onClick={() => setSearchOn(!searchOn)}
                title={searchOn ? "Web arama açık" : "Web arama kapalı"}
                className={`p-1.5 rounded-lg transition-colors ${
                  searchOn ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"
                }`}
              >
                <Globe size={16} />
              </button>
              <button
                onClick={() => useStore.getState().setPromptLibraryOpen(true)}
                title="Şablon kütüphanesi"
                className="text-muted hover:text-ink hover:bg-bgsoft p-1.5 rounded-lg transition-colors"
              >
                <BookOpen size={16} />
              </button>
              {/* Repo button */}
              <button
                onClick={() => setRepoOpen((o) => !o)}
                title="Depo dosyalarını bağlam olarak ekle"
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-semibold transition-colors ${
                  repoOpen || attachedFiles.length > 0
                    ? "bg-brand/10 text-brand"
                    : "text-muted hover:text-ink hover:bg-bgsoft"
                }`}
              >
                <FolderGit2 size={15} />
                {attachedFiles.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold grid place-items-center">
                    {attachedFiles.length}
                  </span>
                )}
              </button>
            </div>

            <input ref={fileRef} type="file" accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.toml,.html,.css,.sql,.sh,.go,.rs,.java,.c,.cpp,.h,.rb,.php" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileIntoInput(f); e.target.value = ""; }} />
            <input ref={imgRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileIntoInput(f); e.target.value = ""; }} />

            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              placeholder={attachedFiles.length > 0 ? `${attachedFiles.length} dosya eklendi — sorunuzu yazın…` : "Kodunuz hakkında sorun, hata düzeltin, refactor isteyin…"}
              className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed max-h-[200px] py-1.5 placeholder:text-muted/45"
            />

            {streaming ? (
              <button onClick={stop} className="shrink-0 w-9 h-9 rounded-xl bg-red hover:bg-red/80 text-white grid place-items-center transition-colors" title="Durdur">
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim() && pendingImages.length === 0 && attachedFiles.length === 0}
                className="shrink-0 w-9 h-9 rounded-xl bg-brand hover:bg-branddim text-white grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-muted/50">
            {searchOn && <><span className="text-brand font-medium">Web arama açık</span><span>·</span></>}
            <span>craft.ai Coder — AI destekli geliştirici asistanı</span>
          </div>
        </div>
      </div>
    </div>
  );
}
