// src/lib/types.ts — Tüm uygulama genelinde kullanılan tip tanımları

//─────── Skill / Rules ───────
export interface Skill {
  id: string;
  title: string;
  content: string;
  type: "manual" | "file";
  enabled: boolean;
}

//─────── AI Provider / Model ───────
export type ProviderKind =
  | "huggingface"
  | "deepseek"
  | "openrouter"
  | "groq"
  | "google"
  | "mistral"
  | "cerebras"
  | "togetherai"
  | "xai"
  | "ollama"
  | "custom";

export interface AIModel {
  id: string;
  name: string;
  provider: ProviderKind;
  apiKey: string;
  baseURL: string;
  enabled: boolean;
}

//─────── Chat ───────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  artifacts?: ArtifactData[];
  modelId?: string;
}

//─────── Chat share ───────
export interface SharedChat {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
}

//─────── Artifact (Canvas) ───────
export interface ArtifactData {
  id: string;
  type: "html" | "svg" | "mermaid" | "code";
  content: string;
  language?: string;
  title?: string;
}

//─────── GitHub ───────
export interface GitAccount {
  id: string;
  username: string;
  token: string;
  provider: "github" | "gitlab";
}

export interface GitRepo {
  owner: string;
  repo: string;
  branch?: string;
}

export interface GitBranch {
  name: string;
  sha: string;
}

//─────── App Config ───────
export interface AppConfig {
  theme: "dark" | "light";
  responseStyle: "normal" | "short" | "detailed" | "code-focused" | "formal";
  fontSize: number;
  fontScale: "sm" | "base" | "lg";
  accentColor: string;
  soundEnabled: boolean;
  guestMode: boolean;
}

//─────── Project / Workspace ───────
export interface Project {
  id: string;
  name: string;
  repo: GitRepo;
  gitAccountId: string;
}

//─────── Chat Summary (sidebar list) ───────
export interface ChatSummary {
  id: string;
  title: string;
  pinned: boolean;
  incognito: boolean;
  createdAt: number;
}

//─────── Sub-agent ───────
export interface SubAgentTask {
  title: string;
  instruction: string;
}

export interface SubAgentResult {
  title: string;
  result: string;
  error?: string;
}

//─────── MCP ───────
export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

//─────── Response style options ───────
export type ResponseStyle = AppConfig["responseStyle"];

//─────── Prompt context ───────
export interface PromptContext {
  skills: Skill[];
  projectContext: string;
  platformKnowledge: string;
  memory: string;
  systemPrompt: string;
  responseStyle: ResponseStyle;
}
