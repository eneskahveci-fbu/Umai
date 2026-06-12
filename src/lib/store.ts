// ── Zustand global state store ──

import { create } from "zustand";
import type { ChatMessage, ChatSession, ModelConfig, AppConfig, Project, ResponseStyle, Provider } from "./types";

export type ViewMode = "chat" | "coder" | "compare";

export interface AppState {
  // ── Görünüm ──
  view: ViewMode;
  setView: (v: ViewMode) => void;

  // ── Model ──
  models: ModelConfig[];
  activeModelId: string | null;
  setModels: (models: ModelConfig[]) => void;
  addModel: (model: ModelConfig) => void;
  removeModel: (id: string) => void;
  setActiveModel: (id: string) => void;

  // ── Sohbet ──
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  setSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // ── Proje (Coder) ──
  project: Project | null;
  setProject: (p: Project | null) => void;
  repoFiles: string[];
  setRepoFiles: (files: string[]) => void;

  // ── UI durumu ──
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  incognitoMode: boolean;
  setIncognitoMode: (v: boolean) => void;
  isStreaming: boolean;
  setStreaming: (v: boolean) => void;

  // ── Ayarlar ──
  config: AppConfig;
  updateConfig: (partial: Partial<AppConfig>) => void;

  // ── Karşılaştırma ──
  compareModels: string[];
  setCompareModels: (models: string[]) => void;
}

const defaultConfig: AppConfig = {
  theme: "dark",
  accentColor: "amber",
  fontScale: "base",
  responseStyle: "normal",
  fontSize: 14,
  notificationSound: false,
};

export const useStore = create<AppState>((set) => ({
  view: "chat",
  setView: (v) => set({ view: v }),

  models: [],
  activeModelId: null,
  setModels: (models) => set({ models }),
  addModel: (model) =>
    set((s) => ({ models: [...s.models, model] })),
  removeModel: (id) =>
    set((s) => ({ models: s.models.filter((m) => m.id !== id) })),
  setActiveModel: (id) => set({ activeModelId: id }),

  sessions: [],
  activeSessionId: null,
  messages: [],
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((s) => ({ sessions: [...s.sessions, session] })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((ses) => ses.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    })),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),
  clearMessages: () => set({ messages: [] }),

  project: null,
  setProject: (p) => set({ project: p }),
  repoFiles: [],
  setRepoFiles: (files) => set({ repoFiles: files }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  incognitoMode: false,
  setIncognitoMode: (v) => set({ incognitoMode: v }),
  isStreaming: false,
  setStreaming: (v) => set({ isStreaming: v }),

  config: defaultConfig,
  updateConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  compareModels: [],
  setCompareModels: (models) => set({ compareModels: models }),
}));
