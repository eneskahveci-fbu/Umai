export type Role = "user" | "assistant" | "system" | "tool";

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: "pending" | "done" | "error";
}

export interface ChatMessage {
  role: Role;
  content: string;
  images?: string[];
  agentId?: string;
  tokenIn?: number;
  tokenOut?: number;
  toolCalls?: ToolCallRecord[];
  thinking?: string;
  rating?: "up" | "down";
  /** Ajan görev planı (update_plan aracıyla canlı güncellenen checklist). */
  plan?: string;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
  enabled: boolean;
}

export interface Snippet {
  id: string;
  title: string;
  language: string;
  code: string;
  created_at: number;
  tags?: string[];
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  incognito?: boolean;
  projectId?: string;
  totalInTokens?: number;
  totalOutTokens?: number;
  tags?: string[];
  pinned?: boolean;
}

export type Provider =
  | "pollinations"
  | "hf"
  | "deepseek"
  | "openrouter"
  | "groq"
  | "gemini"
  | "mistral"
  | "cerebras"
  | "together"
  | "xai"
  | "ollama"
  | "anthropic"
  | "pollinations"
  | "custom";

export interface ModelProfile {
  id: string;
  label: string;
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface GitHubAccount {
  id: string;
  username: string;
  token: string;
}

export interface GitLabAccount {
  id: string;
  username: string;
  token: string;
}

export type ResponseStyle = "normal" | "concise" | "detailed" | "code" | "formal";

export interface Project {
  id: string;
  name: string;
  systemPrompt: string;
  created_at: number;
}

export interface MemoryItem {
  id: string;
  content: string;
}

export interface Skill {
  id: string;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  source: "manual" | "file";
  fileName?: string;
  usageCount: number;
  createdAt: number;
}

export interface Artifact {
  type: "html" | "svg" | "mermaid";
  content: string;
  title: string;
}

export interface PromptTemplate {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

export interface Config {
  models: ModelProfile[];
  activeModelId: string | null;
  githubAccounts: GitHubAccount[];
  activeGithubId: string | null;
  gitlabAccounts: GitLabAccount[];
  activeGitlabId: string | null;
  repos: string[];
  activeRepo: string | null;
  systemPrompt: string;
  theme: "dark" | "light";
  style: ResponseStyle;
  memories: MemoryItem[];
  skills: Skill[];
  projects: Project[];
  activeProjectId: string | null;
  followUps: boolean;
  webSearch: boolean;
  cliMode: boolean;
  autoTerminal: boolean;
  /** Editörde satır içi (ghost text) AI tamamlama. Aktif modelin API kotasını
      kullandığı için kapatılabilir. Tanımsız = açık. */
  inlineCompletion?: boolean;
  /** Açıksa ajan dosyaları doğrudan yazıp commit edemez; değişiklikleri kod
      bloğu olarak ÖNERİR, kullanıcı commit arayüzüyle uygular. Tanımsız = kapalı. */
  requireWriteApproval?: boolean;
  /** Açıksa AI'nın önerdiği SADECE allowlist'teki komutlar otomatik çalışır
      (çıktı AI'ya beslenir → güvenli oto-düzelt). Tanımsız = kapalı. */
  autoRunCommands?: boolean;
  /** Otomatik çalıştırılmasına izin verilen komut önekleri. */
  commandAllowlist?: string[];
  /** Açıksa ajan önce PLAN sunar ve değişiklik yapmadan durur; kullanıcı
      onaylayınca uygular. Tanımsız = kapalı. */
  planApprovalMode?: boolean;
  /** Açıksa ajan internet (web_search/read_url) araçlarını kullanamaz.
      Tanımsız = ağ erişimi serbest. */
  blockNetworkTools?: boolean;
  rulesFile: string;
  fontScale: "sm" | "base" | "lg";
  soundEnabled: boolean;
  accentColor: "amber" | "green" | "orange";
  maxContext: number;
  webcontainerApiKey: string;
  mcpServers?: McpServer[];
}

export interface RepoState {
  owner: string;
  repo: string;
  branch: string;
}

export interface TreeFile {
  name: string;
  path: string;
}

export interface TreeNode {
  dirs: Record<string, TreeNode>;
  files: TreeFile[];
}

export interface OpenFile {
  path: string;
  content: string;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}
