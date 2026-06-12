// ── Paylaşımlı tipler ──

export type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "mistral"
  | "ollama"
  | "openrouter"
  | "cerebras"
  | "xai"
  | "together"
  | "pollinations"
  | "custom";

export type ResponseStyle = "normal" | "short" | "detailed" | "code" | "formal";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface MemoryItem {
  id: string;
  content: string;
  createdAt: number;
}

export interface Skill {
  title: string;
  content: string;
  tags?: string[];
  source: "manual" | "file";
  fileName?: string;
  enabled: boolean;
}

export interface Config {
  theme: "dark" | "light";
  accentColor: "amber" | "green" | "orange";
  fontScale: "sm" | "base" | "lg";
  responseStyle: ResponseStyle;
  followUpQuestions: boolean;
  webSearch: boolean;
  contextWindowTokens: number;
  guestMode: boolean;
  fontSize: number;
  soundEnabled: boolean;
}

export interface ModelEntry {
  id: string;
  provider: Provider;
  displayName?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId?: string;
  createdAt: number;
  updatedAt: number;
  incognito?: boolean;
  pinned?: boolean;
}

export interface Project {
  id: string;
  name: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  provider?: "github" | "gitlab";
  token?: string;
  rulesContent?: string;
  createdAt: number;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Repo bağlamı (API route'larda ortak kullanılır)
export interface RepoCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
}
