// src/lib/store.ts — Zustand global state store

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AIModel,
  AppConfig,
  ChatMessage,
  GitAccount,
  GitRepo,
  Project,
  Skill,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_MODELS } from "./constants";
import { safeJSONParse } from "./validate";

//─────── App Store ───────
interface AppState {
  // Chat
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;

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
  updateConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
  ) => void;

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

  // UI state
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Chat
      messages: [],
      addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [] }),

      // Model
      models: safeJSONParse<AIModel[]>(
        typeof localStorage !== "undefined"
          ? localStorage.getItem("craft-models") ?? "[]"
          : "[]",
        DEFAULT_MODELS,
      ),
      activeModelId: null,
      addModel: (model) =>
        set((s) => {
          const updated = [...s.models, model];
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("craft-models", JSON.stringify(updated));
          }
          return { models: updated };
        }),
      removeModel: (id) =>
        set((s) => {
          const updated = s.models.filter((m) => m.id !== id);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("craft-models", JSON.stringify(updated));
          }
          return {
            models: updated,
            activeModelId:
              s.activeModelId === id ? (updated[0]?.id ?? null) : s.activeModelId,
          };
        }),
      toggleModel: (id) =>
        set((s) => ({
          models: s.models.map((m) =>
            m.id === id ? { ...m, enabled: !m.enabled } : m,
          ),
        })),
      setActiveModel: (id) => set({ activeModelId: id }),

      // Git
      gitAccounts: [],
      activeRepo: null,
      addGitAccount: (account) =>
        set((s) => ({ gitAccounts: [...s.gitAccounts, account] })),
      removeGitAccount: (id) =>
        set((s) => ({
          gitAccounts: s.gitAccounts.filter((a) => a.id !== id),
        })),
      setActiveRepo: (repo) => set({ activeRepo: repo }),

      // Skills
      skills: [],
      addSkill: (skill) =>
        set((s) => ({ skills: [...s.skills, skill] })),
      removeSkill: (id) =>
        set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
      toggleSkill: (id) =>
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, enabled: !sk.enabled } : sk,
          ),
        })),
      updateSkill: (id, content) =>
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, content } : sk,
          ),
        })),

      // Config
      config: DEFAULT_CONFIG,
      updateConfig: (key, value) =>
        set((s) => ({ config: { ...s.config, [key]: value } })),

      // Memory
      memory: "",
      setMemory: (text) => set({ memory: text }),

      // System prompt
      systemPrompt: "",
      setSystemPrompt: (text) => set({ systemPrompt: text }),

      // Projects
      projects: [],
      activeProjectId: null,
      addProject: (project) =>
        set((s) => ({ projects: [...s.projects, project] })),
      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeProjectId:
            s.activeProjectId === id ? null : s.activeProjectId,
        })),
      setActiveProject: (id) => set({ activeProjectId: id }),
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
      }),
    },
  ),
);
