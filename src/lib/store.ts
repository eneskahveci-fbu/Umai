import { create } from "zustand";
import type {
  Chat,
  ChatMessage,
  Config,
  GitHubAccount,
  ModelProfile,
  OpenFile,
  RepoState,
  Toast,
  TreeNode,
} from "./types";
import { DEFAULT_CONFIG } from "./constants";
import { createClient } from "./supabase/client";

const CONFIG_KEY = "craftai_config";
const CHATS_KEY = "craftai_chats";

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function loadConfig(): Config {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    /* yok say */
  }
  return DEFAULT_CONFIG;
}

function loadLocalChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CHATS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalChats(chats: Chat[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CHATS_KEY,
    JSON.stringify(chats.filter((c) => !c.incognito)),
  );
}

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

interface StoreState {
  userId: string | null;
  userEmail: string | null;
  setUser: (id: string | null, email: string | null) => void;

  config: Config;
  saveConfig: (c: Config) => void;
  addModel: (m: Omit<ModelProfile, "id">) => void;
  updateModel: (id: string, patch: Partial<ModelProfile>) => void;
  removeModel: (id: string) => void;
  setActiveModel: (id: string) => void;
  activeModel: () => ModelProfile | null;
  addGithub: (a: Omit<GitHubAccount, "id">) => void;
  removeGithub: (id: string) => void;
  setActiveGithub: (id: string | null) => void;
  activeGithub: () => GitHubAccount | null;
  addRepo: (repo: string) => void;
  setActiveRepo: (repo: string) => void;
  toggleTheme: () => void;

  view: "chat" | "coder";
  setView: (v: "chat" | "coder") => void;
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  streaming: boolean;
  setStreaming: (b: boolean) => void;

  chats: Chat[];
  currentId: string | null;
  incognito: boolean;
  loadChats: (userId: string | null) => Promise<void>;
  newChat: (incognito?: boolean) => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => void;
  current: () => Chat | null;
  pushMessage: (m: ChatMessage) => void;
  updateLastContent: (content: string) => void;
  popLastMessage: () => void;
  maybeSetTitle: (text: string) => void;
  persistCurrent: () => Promise<void>;
  exportChat: (id: string) => void;

  // toast
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;

  // coder
  repo: RepoState | null;
  tree: TreeNode | null;
  currentFile: OpenFile | null;
  setRepo: (r: RepoState | null) => void;
  setTree: (t: TreeNode | null) => void;
  setCurrentFile: (f: OpenFile | null) => void;

  pendingInput: string | null;
  setPendingInput: (s: string | null) => void;
}

export const useStore = create<StoreState>()((set, get) => ({
  userId: null,
  userEmail: null,
  setUser: (id, email) => set({ userId: id, userEmail: email }),

  config: loadConfig(),
  saveConfig: (c) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
      applyTheme(c.theme);
    }
    set({ config: c });
  },
  addModel: (m) => {
    const model: ModelProfile = { ...m, id: uid() };
    const config = get().config;
    const next: Config = {
      ...config,
      models: [...config.models, model],
      activeModelId: config.activeModelId ?? model.id,
    };
    get().saveConfig(next);
  },
  updateModel: (id, patch) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      models: config.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  },
  removeModel: (id) => {
    const config = get().config;
    const models = config.models.filter((m) => m.id !== id);
    get().saveConfig({
      ...config,
      models,
      activeModelId:
        config.activeModelId === id
          ? (models[0]?.id ?? null)
          : config.activeModelId,
    });
  },
  setActiveModel: (id) =>
    get().saveConfig({ ...get().config, activeModelId: id }),
  activeModel: () => {
    const { models, activeModelId } = get().config;
    return models.find((m) => m.id === activeModelId) || models[0] || null;
  },
  addGithub: (a) => {
    const acc: GitHubAccount = { ...a, id: uid() };
    const config = get().config;
    get().saveConfig({
      ...config,
      githubAccounts: [...config.githubAccounts, acc],
      activeGithubId: config.activeGithubId ?? acc.id,
    });
  },
  removeGithub: (id) => {
    const config = get().config;
    const githubAccounts = config.githubAccounts.filter((a) => a.id !== id);
    get().saveConfig({
      ...config,
      githubAccounts,
      activeGithubId:
        config.activeGithubId === id
          ? (githubAccounts[0]?.id ?? null)
          : config.activeGithubId,
    });
  },
  setActiveGithub: (id) =>
    get().saveConfig({ ...get().config, activeGithubId: id }),
  activeGithub: () => {
    const { githubAccounts, activeGithubId } = get().config;
    return githubAccounts.find((a) => a.id === activeGithubId) || null;
  },
  addRepo: (repo) => {
    const config = get().config;
    const repos = [repo, ...config.repos.filter((r) => r !== repo)].slice(
      0,
      12,
    );
    get().saveConfig({ ...config, repos, activeRepo: repo });
  },
  setActiveRepo: (repo) =>
    get().saveConfig({ ...get().config, activeRepo: repo }),
  toggleTheme: () => {
    const config = get().config;
    get().saveConfig({
      ...config,
      theme: config.theme === "dark" ? "light" : "dark",
    });
  },

  view: "chat",
  setView: (v) => set({ view: v }),
  sidebarOpen: false,
  setSidebarOpen: (b) => set({ sidebarOpen: b }),
  settingsOpen: false,
  setSettingsOpen: (b) => set({ settingsOpen: b }),
  streaming: false,
  setStreaming: (b) => set({ streaming: b }),

  chats: [],
  currentId: null,
  incognito: false,

  loadChats: async (userId) => {
    if (userId) {
      const sb = createClient();
      if (sb) {
        const { data } = await sb
          .from("chats")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        if (data) {
          set({
            chats: data.map((r) => ({
              id: r.id,
              title: r.title,
              messages: r.messages,
              created_at: new Date(r.created_at).getTime(),
            })),
          });
          return;
        }
      }
    }
    set({ chats: loadLocalChats() });
  },

  newChat: (incognito = false) => {
    const chat: Chat = {
      id: uid(),
      title: "Yeni sohbet",
      messages: [],
      created_at: Date.now(),
      incognito,
    };
    set((state) => ({
      chats: [chat, ...state.chats],
      currentId: chat.id,
      incognito,
      view: "chat",
    }));
  },

  selectChat: (id) => set({ currentId: id, incognito: false, view: "chat" }),

  deleteChat: async (id) => {
    const { userId } = get();
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
    }));
    if (userId) {
      const sb = createClient();
      if (sb) await sb.from("chats").delete().eq("id", id);
    } else {
      saveLocalChats(get().chats);
    }
  },

  renameChat: (id, title) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === id ? { ...c, title } : c,
      ),
    }));
    const { userId } = get();
    if (userId) {
      const sb = createClient();
      if (sb) sb.from("chats").update({ title }).eq("id", id);
    } else {
      saveLocalChats(get().chats);
    }
  },

  current: () => {
    const { chats, currentId } = get();
    return chats.find((c) => c.id === currentId) || null;
  },

  pushMessage: (m) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === state.currentId
          ? { ...c, messages: [...c.messages, m] }
          : c,
      ),
    })),

  updateLastContent: (content) =>
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== state.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content,
          };
        }
        return { ...c, messages };
      }),
    })),

  popLastMessage: () =>
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== state.currentId) return c;
        return { ...c, messages: c.messages.slice(0, -1) };
      }),
    })),

  maybeSetTitle: (text) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === state.currentId && c.title === "Yeni sohbet"
          ? { ...c, title: text.slice(0, 48) }
          : c,
      ),
    })),

  persistCurrent: async () => {
    const { incognito, userId } = get();
    const chat = get().current();
    if (incognito || !chat) return;
    if (userId) {
      const sb = createClient();
      if (sb) {
        await sb.from("chats").upsert({
          id: chat.id,
          user_id: userId,
          title: chat.title,
          messages: chat.messages,
          created_at: new Date(chat.created_at).toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      saveLocalChats(get().chats);
    }
  },

  exportChat: (id) => {
    const chat = get().chats.find((c) => c.id === id);
    if (!chat) return;
    let md = `# ${chat.title}\n\n`;
    for (const m of chat.messages) {
      const prefix = m.role === "user" ? "**Kullanıcı:**" : "**Asistan:**";
      md += `${prefix}\n\n${m.content}\n\n---\n\n`;
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chat.title.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, "").trim() || "sohbet"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  },

  toasts: [],
  addToast: (message, type = "info") => {
    const toast: Toast = { id: uid(), message, type };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    setTimeout(() => get().removeToast(toast.id), 3500);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  repo: null,
  tree: null,
  currentFile: null,
  setRepo: (r) => set({ repo: r }),
  setTree: (t) => set({ tree: t }),
  setCurrentFile: (f) => set({ currentFile: f }),

  pendingInput: null,
  setPendingInput: (s) => set({ pendingInput: s }),
}));
