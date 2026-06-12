"use client";

import { create } from "zustand";
import type { ChatSession, Config, ModelEntry, Project, Skill, ChatMessage } from "@/lib/types";

interface Store {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // Sohbet
  chats: ChatSession[];
  activeChatId: string | null;
  incognito: boolean;
  setActiveChat: (id: string | null) => void;
  newChat: (incognito?: boolean) => string;
  deleteChat: (id: string) => void;
  updateChat: (id: string, patch: Partial<ChatSession>) => void;
  loadChats: (userId: string | null) => void;

  // Kullanıcı
  userId: string | null;
  userEmail: string | null;
  setUser: (id: string | null, email: string | null) => void;

  // Ayarlar
  config: Config;
  saveConfig: (patch: Partial<Config>) => void;
  syncConfig: (userId: string) => Promise<void>;

  // Modeller
  models: ModelEntry[];
  activeModelId: string | null;
  setActiveModel: (id: string) => void;
  addModel: (m: ModelEntry) => void;
  updateModel: (id: string, patch: Partial<ModelEntry>) => void;
  removeModel: (id: string) => void;

  // Modallar
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  libraryOpen: boolean;
  setLibraryOpen: (v: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  skillsPanelOpen: boolean;
  setSkillsPanelOpen: (v: boolean) => void;
  diffModalOpen: boolean;
  setDiffModalOpen: (v: boolean) => void;
  onboardingOpen: boolean;
  setOnboardingOpen: (v: boolean) => void;

  // Toast
  toasts: ToastItem[];
  addToast: (t: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;

  // Projeler
  projects: Project[];
  activeProjectId: string | null;
  setActiveProject: (id: string | null) => void;
  addProject: (p: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;

  // Skills
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;
  toggleSkill: (title: string) => void;
  addSkill: (s: Skill) => void;
  removeSkill: (title: string) => void;

  // Diff
  diffContent: { original: string; modified: string; path: string } | null;
  setDiffContent: (d: Store["diffContent"]) => void;
}

export interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}

const DEFAULT_CONFIG: Config = {
  theme: "dark",
  accentColor: "amber",
  fontScale: "base",
  responseStyle: "detailed",
  followUpQuestions: true,
  webSearch: false,
  contextWindowTokens: 128_000,
  guestMode: false,
  fontSize: 14,
  soundEnabled: false,
};

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

function saveToStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota aşımı olabilir, sessizce geç */ }
}

export const useStore = create<Store>((set, get) => ({
  // ── Sidebar ──
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  // ── Sohbetler ──
  chats: [],
  activeChatId: null,
  incognito: false,

  setActiveChat: (id) => {
    const chat = id ? get().chats.find((c) => c.id === id) : null;
    set({ activeChatId: id, incognito: chat?.incognito ?? false });
  },

  newChat: (incognito = false) => {
    const id = uid();
    const chat: ChatSession = {
      id,
      title: "Yeni Sohbet",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      incognito,
    };
    if (!incognito) {
      set((s) => {
        const next = { chats: [chat, ...s.chats], activeChatId: id, incognito: false };
        saveToStorage("craftai_chats", next.chats);
        return next;
      });
    } else {
      set({ activeChatId: id, incognito: true });
    }
    return id;
  },

  deleteChat: (id) =>
    set((s) => {
      const next = {
        chats: s.chats.filter((c) => c.id !== id),
        activeChatId: s.activeChatId === id ? null : s.activeChatId,
      };
      saveToStorage("craftai_chats", next.chats);
      return next;
    }),

  updateChat: (id, patch) =>
    set((s) => {
      const chats = s.chats.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
      );
      const nonIncognito = chats.filter((c) => !c.incognito);
      saveToStorage("craftai_chats", nonIncognito);
      return { chats };
    }),

  loadChats: (userId) => {
    if (!userId) {
      const local = loadFromStorage<ChatSession[]>("craftai_chats", []);
      const sorted = local.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ chats: sorted });
      return;
    }
    // Supabase'den yükleme (placeholder — gerçek implementasyon için API route'u kullan)
    const local = loadFromStorage<ChatSession[]>("craftai_chats", []);
    const sorted = local.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ chats: sorted });
  },

  // ── Kullanıcı ──
  userId: null,
  userEmail: null,
  setUser: (id, email) => set({ userId: id, userEmail: email }),

  // ── Ayarlar ──
  config: loadFromStorage<Config>("craftai_config", DEFAULT_CONFIG),
  saveConfig: (patch) =>
    set((s) => {
      const config = { ...s.config, ...patch };
      saveToStorage("craftai_config", config);
      return { config };
    }),
  syncConfig: async (_userId) => {
    // Placeholder — Supabase sync
  },

  // ── Modeller ──
  models: loadFromStorage<ModelEntry[]>("craftai_models", []),
  activeModelId: null,
  setActiveModel: (id) => set({ activeModelId: id }),
  addModel: (m) =>
    set((s) => {
      const models = [...s.models, m];
      saveToStorage("craftai_models", models);
      return { models, activeModelId: s.activeModelId ?? m.id };
    }),
  updateModel: (id, patch) =>
    set((s) => {
      const models = s.models.map((m) => (m.id === id ? { ...m, ...patch } : m));
      saveToStorage("craftai_models", models);
      return { models };
    }),
  removeModel: (id) =>
    set((s) => {
      const models = s.models.filter((m) => m.id !== id);
      saveToStorage("craftai_models", models);
      return { models, activeModelId: s.activeModelId === id ? null : s.activeModelId };
    }),

  // ── Modallar ──
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  libraryOpen: false,
  setLibraryOpen: (v) => set({ libraryOpen: v }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  shortcutsOpen: false,
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
  skillsPanelOpen: false,
  setSkillsPanelOpen: (v) => set({ skillsPanelOpen: v }),
  diffModalOpen: false,
  setDiffModalOpen: (v) => set({ diffModalOpen: v }),
  onboardingOpen: false,
  setOnboardingOpen: (v) => set({ onboardingOpen: v }),

  // ── Toast ──
  toasts: [],
  addToast: (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    if (t.duration !== 0) {
      setTimeout(() => get().removeToast(id), t.duration ?? 4000);
    }
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // ── Projeler ──
  projects: loadFromStorage<Project[]>("craftai_projects", []),
  activeProjectId: null,
  setActiveProject: (id) => set({ activeProjectId: id }),
  addProject: (p) =>
    set((s) => {
      const projects = [...s.projects, p];
      saveToStorage("craftai_projects", projects);
      return { projects };
    }),
  updateProject: (id, patch) =>
    set((s) => {
      const projects = s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
      saveToStorage("craftai_projects", projects);
      return { projects };
    }),
  removeProject: (id) =>
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id);
      saveToStorage("craftai_projects", projects);
      return { projects, activeProjectId: s.activeProjectId === id ? null : s.activeProjectId };
    }),

  // ── Skills ──
  skills: loadFromStorage<Skill[]>("craftai_skills", []),
  setSkills: (skills) => {
    saveToStorage("craftai_skills", skills);
    set({ skills });
  },
  toggleSkill: (title) =>
    set((s) => {
      const skills = s.skills.map((sk) =>
        sk.title === title ? { ...sk, enabled: !sk.enabled } : sk,
      );
      saveToStorage("craftai_skills", skills);
      return { skills };
    }),
  addSkill: (sk) =>
    set((s) => {
      const skills = [...s.skills, sk];
      saveToStorage("craftai_skills", skills);
      return { skills };
    }),
  removeSkill: (title) =>
    set((s) => {
      const skills = s.skills.filter((sk) => sk.title !== title);
      saveToStorage("craftai_skills", skills);
      return { skills };
    }),

  // ── Diff ──
  diffContent: null,
  setDiffContent: (d) => set({ diffContent: d, diffModalOpen: !!d }),
}));
