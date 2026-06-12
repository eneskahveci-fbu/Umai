// src/lib/store.ts — Zustand global state store

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AIModel,
  AppConfig,
  ChatMessage,
  ChatSummary,
  GitAccount,
  GitRepo,
  Project,
  Skill,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_MODELS } from "./constants";
import { safeJSONParse } from "./validate";

//─────── App Store ───────
interface AppState {
  // Chat messages
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;

  // Chat list (sidebar)
  chats: ChatSummary[];
  activeChatId: string | null;
  setActiveChat: (id: string | null) => void;
  newChat: (incognito: boolean) => void;
  deleteChat: (id: string) => void;
  updateChat: (id: string, patch: Partial<ChatSummary>) => void;
  loadChats: (userId: string | null) => void;

  // User
  userId: string | null;
  userEmail: string | null;
  setUser: (id: string | null, email: string | null) => void;

  // Config sync
  syncConfig: (userId: string) => Promise<void>;

  // Model
  models: AIModel[];
  activeModelId: string | null;
  addModel: (model: AIModel) => void;
  removeModel: (id: string) => void;
  toggleModel: (id: string) => void;
  setActiveModel: (id: string) => void;

  // Git
  gitAccounts: GitAccount[];
  activeRepo: GitRepo | null;
  addGitAccount: (account: GitAccount) => void;
  removeGitAccount: (id: string) => void;
  setActiveRepo: (repo: GitRepo | null) => void;

  // Skills
  skills: Skill[];
  addSkill: (skill: Skill) => void;
  removeSkill: (id: string) => void;
  toggleSkill: (id: string) => void;
  updateSkill: (id: string, content: string) => void;

  // Config
  config: AppConfig;
  updateConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;

  // Memory
  memory: string;
  setMemory: (text: string) => void;

  // System prompt override
  systemPrompt: string;
  setSystemPrompt: (text: string) => void;

  // Projects
  projects: Project[];
  activeProjectId: string | null;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;

  // UI state — modals
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  libraryOpen: boolean;
  setLibraryOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  skillsOpen: boolean;
  setSkillsOpen: (open: boolean) => void;
  diffOpen: boolean;
  setDiffOpen: (open: boolean) => void;
  onboardingOpen: boolean;
  setOnboardingOpen: (open: boolean) => void;
}

function generateId(): string {
  return (
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  );
}

function loadChatsFromStorage(): ChatSummary[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("craft-chats") : null;
    if (!raw) return [];
    return safeJSONParse<ChatSummary[]>(raw, []);
  } catch {
    return [];
  }
}

function saveChatsToStorage(chats: ChatSummary[]): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("craft-chats", JSON.stringify(chats));
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Chat messages
      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [] }),

      // Chat list
      chats: loadChatsFromStorage(),
      activeChatId: null,
      setActiveChat: (id) => set({ activeChatId: id }),
      newChat: (incognito) => {
        const id = generateId();
        const chat: ChatSummary = {
          id,
          title: "Yeni Sohbet",
          pinned: false,
          incognito,
          createdAt: Date.now(),
        };
        const chats = [chat, ...get().chats];
        if (!incognito) saveChatsToStorage(chats);
        set({ chats, activeChatId: id, messages: [] });
      },
      deleteChat: (id) => {
        const chats = get().chats.filter((c) => c.id !== id);
        saveChatsToStorage(chats);
        set({
          chats,
          activeChatId: get().activeChatId === id ? (chats[0]?.id ?? null) : get().activeChatId,
          messages: get().activeChatId === id ? [] : get().messages,
        });
      },
      updateChat: (id, patch) => {
        const chats = get().chats.map((c) => (c.id === id ? { ...c, ...patch } : c));
        saveChatsToStorage(chats);
        set({ chats });
      },
      loadChats: (userId) => {
        if (!userId) {
          set({ chats: loadChatsFromStorage() });
          return;
        }
        // Online modda local + sync — şimdilik sadece local
        set({ chats: loadChatsFromStorage() });
      },

      // User
      userId: null,
      userEmail: null,
      setUser: (id, email) => set({ userId: id, userEmail: email }),

      // Config sync
      syncConfig: async (_userId: string) => {
        // Supabase entegrasyonu — şimdilik no-op
      },

      // Model
      models: safeJSONParse<AIModel[]>(
        typeof localStorage !== "undefined" ? localStorage.getItem("craft-models") ?? "[]" : "[]",
        DEFAULT_MODELS,
      ),
      activeModelId: null,
      addModel: (model) =>
        set((s) => {
          const updated = [...s.models, model];
          if (typeof localStorage !== "undefined") localStorage.setItem("craft-models", JSON.stringify(updated));
          return { models: updated };
        }),
      removeModel: (id) =>
        set((s) => {
          const updated = s.models.filter((m) => m.id !== id);
          if (typeof localStorage !== "undefined") localStorage.setItem("craft-models", JSON.stringify(updated));
          return { models: updated, activeModelId: s.activeModelId === id ? (updated[0]?.id ?? null) : s.activeModelId };
        }),
      toggleModel: (id) =>
        set((s) => ({
          models: s.models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        })),
      setActiveModel: (id) => set({ activeModelId: id }),

      // Git
      gitAccounts: [],
      activeRepo: null,
      addGitAccount: (account) => set((s) => ({ gitAccounts: [...s.gitAccounts, account] })),
      removeGitAccount: (id) => set((s) => ({ gitAccounts: s.gitAccounts.filter((a) => a.id !== id) })),
      setActiveRepo: (repo) => set({ activeRepo: repo }),

      // Skills
      skills: [],
      addSkill: (skill) => set((s) => ({ skills: [...s.skills, skill] })),
      removeSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
      toggleSkill: (id) =>
        set((s) => ({
          skills: s.skills.map((sk) => (sk.id === id ? { ...sk, enabled: !sk.enabled } : sk)),
        })),
      updateSkill: (id, content) =>
        set((s) => ({
          skills: s.skills.map((sk) => (sk.id === id ? { ...sk, content } : sk)),
        })),

      // Config
      config: DEFAULT_CONFIG,
      updateConfig: (key, value) => set((s) => ({ config: { ...s.config, [key]: value } })),

      // Memory
      memory: "",
      setMemory: (text) => set({ memory: text }),

      // System prompt
      systemPrompt: "",
      setSystemPrompt: (text) => set({ systemPrompt: text }),

      // Projects
      projects: [],
      activeProjectId: null,
      addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        })),
      setActiveProject: (id) => set({ activeProjectId: id }),

      // UI state
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      libraryOpen: false,
      setLibraryOpen: (open) => set({ libraryOpen: open }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      shortcutsOpen: false,
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
      skillsOpen: false,
      setSkillsOpen: (open) => set({ skillsOpen: open }),
      diffOpen: false,
      setDiffOpen: (open) => set({ diffOpen: open }),
      onboardingOpen: false,
      setOnboardingOpen: (open) => set({ onboardingOpen: open }),
    }),
    {
      name: "craft-coder-store",
      partialize: (state) => ({
        config: state.config,
        models: state.models,
        skills: state.skills,
        gitAccounts: state.gitAccounts,
        memory: state.memory,
        systemPrompt: state.systemPrompt,
        projects: state.projects,
        chats: state.chats,
        activeChatId: state.activeChatId,
        userId: state.userId,
        userEmail: state.userEmail,
      }),
    },
  ),
);
