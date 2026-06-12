// ── Temel Tipler ──

export type Provider =
  | "hf"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "deepseek"
  | "groq"
  | "google"
  | "mistral"
  | "cerebras"
  | "together"
  | "xai"
  | "ollama"
  | "pollinations"
  | "custom";

export type ResponseStyle = "normal" | "short" | "detailed" | "code" | "formal";

export type Theme = "dark" | "light";
export type AccentColor = "amber" | "green" | "orange";
export type FontScale = "sm" | "base" | "lg";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  model?: string;
  provider?: Provider;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  artifacts?: Artifact[];
  edited?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
}

export interface Artifact {
  id: string;
  type: "html" | "svg" | "mermaid" | "code";
  content: string;
  language?: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  createdAt: number;
}

export interface Config {
  theme: Theme;
  accentColor: AccentColor;
  fontScale: FontScale;
  fontSize: number;
  responseStyle: ResponseStyle;
  memory: string;
  systemPrompt: string;
  followUpQuestions: boolean;
  webSearch: boolean;
  contextWindowTokens: number;
  guestMode: boolean;
  notificationSound: boolean;
  webContainerApiKey: string;
}

export interface ModelEntry {
  id: string;
  name: string;
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  enabled: boolean;
  isDefault?: boolean;
}

export interface Skill {
  id: string;
  title: string;
  content: string;
  source: "manual" | "file";
  enabled: boolean;
  tags?: string[];
  fileName?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId?: string;
  provider?: Provider;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

export interface Project {
  id: string;
  name: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  provider?: "github" | "gitlab";
  token?: string;
  rules?: string;
}

export interface GitAccount {
  id: string;
  provider: "github" | "gitlab";
  username: string;
  token: string;
}

export interface UserSettings {
  id: string;
  config: Config;
  models: ModelEntry[];
  skills: Skill[];
  gitAccounts: GitAccount[];
  projects: Project[];
  memories: MemoryItem[];
}

export interface RepoReadCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
}
