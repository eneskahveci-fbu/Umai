export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  role: Role;
  content: string;
  images?: string[];
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  incognito?: boolean;
  projectId?: string;
}

export type Provider = "hf" | "deepseek" | "openrouter" | "custom";

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
  repos: string[];
  activeRepo: string | null;
  systemPrompt: string;
  theme: "dark" | "light";
  style: ResponseStyle;
  memories: MemoryItem[];
  projects: Project[];
  activeProjectId: string | null;
  followUps: boolean;
  webSearch: boolean;
  maxContext: number;
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
