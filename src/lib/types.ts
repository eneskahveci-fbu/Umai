export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  /** true ise gizli sohbet: hiçbir yere kaydedilmez, geçmişte görünmez. */
  incognito?: boolean;
}

export type Provider = "hf" | "deepseek" | "openrouter" | "custom";

/** Kullanıcının eklediği bir model API'si (ayarlardan birden fazla eklenebilir). */
export interface ModelProfile {
  id: string;
  label: string;
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/** Bağlı bir GitHub hesabı (birden fazla eklenebilir). */
export interface GitHubAccount {
  id: string;
  username: string;
  token: string;
}

/** Tüm yapılandırma — localStorage'da saklanır. */
export interface Config {
  models: ModelProfile[];
  activeModelId: string | null;
  githubAccounts: GitHubAccount[];
  activeGithubId: string | null;
  repos: string[];
  activeRepo: string | null;
  systemPrompt: string;
  theme: "dark" | "light";
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
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
