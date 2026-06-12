// ── Merkezi tip tanımları ──

export type Provider =
  | "pollinations"
  | "hf"
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "cerebras"
  | "togetherai"
  | "xai"
  | "ollama"
  | "pollinations"
  | "custom";

export type ResponseStyle = "normal" | "short" | "detailed" | "code-focused" | "formal";

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

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface MemoryItem {
  key: string;
  value: string;
}

export interface SkillPayload {
  title: string;
  content: string;
  tags?: string[];
  source?: "manual" | "file";
  fileName?: string;
}

export type SkillLike = SkillPayload;

export interface RepoReadCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  active: boolean;
}

export interface AppConfig {
  theme: "dark" | "light";
  accentColor: "amber" | "green" | "orange";
  fontScale: "sm" | "base" | "lg";
  responseStyle: ResponseStyle;
  fontSize: number;
  notificationSound: boolean;
}

export interface GitAccount {
  username: string;
  token: string;
  provider: "github" | "gitlab";
}

export interface Project {
  owner: string;
  repo: string;
  branch: string;
  rules?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  incognito?: boolean;
  userId?: string;
}

export interface McpServerConfig {
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

// ── API istek/yanıt tipleri ──

export interface ChatRequest {
  messages: (ChatMessage | { role: string; content: unknown })[];
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  style?: ResponseStyle;
  memories?: MemoryItem[];
  skills?: SkillPayload[];
  searchContext?: string;
  projectPrompt?: string;
  tools?: boolean;
  webSearch?: boolean;
  requireWriteApproval?: boolean;
  planApprovalMode?: boolean;
  planApproved?: boolean;
  blockNetworkTools?: boolean;
  repoCtx?: RepoReadCtx;
  mcpServers?: McpServerConfig[];
}

export interface SharePayload {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  title?: string;
}
