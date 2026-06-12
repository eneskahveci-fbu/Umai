import { create } from "zustand";
import type { Config, ChatSession, ModelEntry, Skill, GitAccount, Project, MemoryItem, UserSettings, Artifact } from "./types";

interface Toast {
  id: string;
  message: string;
  type?: "info" | "success" | "error" | "warning";
  duration?: number;
}

// ── Default Config ──

const DEFAULT_CONFIG: Config = {
  theme: "dark",
  accentColor: "amber",
  fontScale: "base",
  fontSize: 14,
  responseStyle: "normal",
  memory: "",
  systemPrompt: "",
  followUpQuestions: true,
  webSearch: false,
  contextWindowTokens: 128_000,
  guestMode: false,
  notificationSound: false,
  webContainerApiKey: "",
};

// ── Store State ──

interface StoreState {
  // UI state
  sidebarOpen: boolean;
  settingsOpen: boolean;
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;
  libraryOpen: boolean;
  diffOpen: boolean;
  onboardingOpen: boolean;

  // User
  user: { id: string; email?: string } | null;
  config: Config;

  // Data
  chats: ChatSession[];
  activeChatId: string | null;
  incognito: boolean;

  // Skills & models
  skills: Skill[];
  models: ModelEntry[];
  gitAccounts: GitAccount[];
  projects: Project[];
  memories: MemoryItem[];

  // Toast notifications
  toasts: Toast[];

  // Artifact preview
  artifact: Artifact | null;

  // Diff view
  diff: { left: string; right: string; title?: string } | null;

  // Onboarding
  onboardingCompleted: boolean;

  // Actions — UI
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setLibraryOpen: (v: boolean) => void;
  setDiffOpen: (v: boolean) => void;
  setOnboardingOpen: (v: boolean) => void;

  // Actions — Auth
  setUser: (user: { id: string; email?: string } | null) => void;

  // Actions — Config
  setConfig: (partial: Partial<Config>) => void;
  syncConfig: (userId: string) => Promise<void>;

  // Actions — Chats
  setChats: (chats: ChatSession[]) => void;
  loadChats: (userId: string | null) => Promise<void>;
  newChat: (incognito?: boolean) => string;
  setActiveChatId: (id: string | null) => void;

  // Actions — Skills & Models
  addSkill: (skill: Skill) => void;
  toggleSkill: (id: string) => void;
  removeSkill: (id: string) => void;
  setSkills: (skills: Skill[]) => void;
  addModel: (model: ModelEntry) => void;
  removeModel: (id: string) => void;
  setModels: (models: ModelEntry[]) => void;

  // Actions — Git
  addGitAccount: (account: GitAccount) => void;
  removeGitAccount: (id: string) => void;

  // Actions — Projects
  setProjects: (projects: Project[]) => void;

  // Actions — Memories
  setMemories: (memories: MemoryItem[]) => void;

  // Actions — Toasts
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;

  // Actions — Artifact
  setArtifact: (artifact: Artifact | null) => void;

  // Actions — Diff
  setDiff: (diff: { left: string; right: string; title?: string } | null) => void;

  // Actions — Onboarding
  setOnboardingCompleted: (v: boolean) => void;

  // Persistence helpers
  saveConfig: () => void;
  loadConfig: () => void;
}

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded vb, sessizce geç
  }
}

export const useStore = create<StoreState>((set, get) => ({
  // ── UI state defaults ──
  sidebarOpen: true,
  settingsOpen: false,
  commandPaletteOpen: false,
  shortcutsOpen: false,
  libraryOpen: false,
  diffOpen: false,
  onboardingOpen: false,

  // ── User ──
  user: null,
  config: loadFromStorage<Config>("craft-config", DEFAULT_CONFIG),

  // ── Data ──
  chats: [],
  activeChatId: null,
  incognito: false,
  skills: [],
  models: [],
  gitAccounts: [],
  projects: [],
  memories: [],
  toasts: [],
  artifact: null,
  diff: null,
  onboardingCompleted: loadFromStorage<boolean>("craft-onboarding", false),

  // ── UI Actions ──
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
  setLibraryOpen: (v) => set({ libraryOpen: v }),
  setDiffOpen: (v) => set({ diffOpen: v }),
  setOnboardingOpen: (v) => set({ onboardingOpen: v }),

  // ── Auth ──
  setUser: (user) => set({ user }),

  // ── Config ──
  setConfig: (partial) => {
    set((s) => {
      const next = { ...s.config, ...partial };
      saveToStorage("craft-config", next);
      return { config: next };
    });
  },
  syncConfig: async (userId) => {
    // Sync config with Supabase for logged-in user
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      if (!sb) return;
      const { data, error } = await sb
        .from("user_config")
        .select("config")
        .eq("user_id", userId)
        .single();
      if (!error && data?.config) {
        const merged = { ...get().config, ...(data.config as Partial<Config>) };
        set({ config: merged });
        saveToStorage("craft-config", merged);
      }
    } catch {
      // Offline veya hata — sessizce geç
    }
  },

  // ── Chats ──
  setChats: (chats) => set({ chats }),
  loadChats: async () => {
    // Tarayıcıda localStorage'dan yükle
    const chats = loadFromStorage<ChatSession[]>("craft-chats", []);
    set({ chats });
  },
  newChat: () => {
    const id = generateId();
    const chat: ChatSession = {
      id,
      title: "Yeni Sohbet",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => {
      const chats = [chat, ...s.chats];
      saveToStorage("craft-chats", chats);
      return { chats, activeChatId: id, incognito: false };
    });
    return id;
  },
  setActiveChatId: (id) => set({ activeChatId: id }),

  // ── Skills ──
  addSkill: (skill) => set((s) => ({ skills: [...s.skills, skill] })),
  toggleSkill: (id) =>
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === id ? { ...sk, enabled: !sk.enabled } : sk)),
    })),
  removeSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
  setSkills: (skills) => set({ skills }),

  // ── Models ──
  addModel: (model) => set((s) => ({ models: [...s.models, model] })),
  removeModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),
  setModels: (models) => set({ models }),

  // ── Git ──
  addGitAccount: (account) => set((s) => ({ gitAccounts: [...s.gitAccounts, account] })),
  removeGitAccount: (id) => set((s) => ({ gitAccounts: s.gitAccounts.filter((a) => a.id !== id) })),

  // ── Projects ──
  setProjects: (projects) => set({ projects }),

  // ── Memories ──
  setMemories: (memories) => set({ memories }),

  // ── Persistence ──
  saveConfig: () => saveToStorage("craft-config", get().config),
  loadConfig: () => set({ config: loadFromStorage<Config>("craft-config", DEFAULT_CONFIG) }),
}));
