export type Role = "user" | "assistant" | "system" | "tool";

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: "pending" | "done" | "error";
  /** Araç çağrısının başlangıç zamanı (ms). */
  startedAt?: number;
  /** Araç çağrısının bitiş zamanı (ms). */
  endedAt?: number;
}

/** Ajanın bir turda değiştirdiği dosyanın yazma-öncesi anlık görüntüsü.
    previous: null ⇒ dosya o turda OLUŞTURULDU (geri al = dosyayı sil). */
export interface FileCheckpoint {
  path: string;
  previous: string | null;
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
  /** Ajan Ekibi (Swarm) ilerleme durumu — todo panelinde çizilir. */
  swarm?: SwarmState;
  /** Ajanın bu turda terminalde çalıştırdığı komutlar — "todo" kutusunda
      canlı gösterilir (çıktı kutunun içinde, ayrı bir balon yok). */
  commands?: CommandRun[];
  /** Bu turda değiştirilen dosyaların geri-al noktaları (sohbetle kalıcı). */
  checkpoints?: FileCheckpoint[];
  /** Üreticinin bitiş nedeni: "length" ⇒ token sınırında kesildi (Devam et). */
  finishReason?: string;
  /** Mesaj dallandırma: bu (kullanıcı) mesajı düzenlendiğinde her sürümün
      kendi yanıt zinciri. Her dal = bu mesajdan sonraki mesajların anlık görüntüsü. */
  branches?: ChatMessage[][];
  /** Aktif dalın indeksi. */
  branchIndex?: number;
}

export interface SwarmAgentState {
  title: string;
  role: string;
  status: "running" | "done" | "error";
}
export interface SwarmState {
  phase: "planning" | "working" | "synthesizing" | "done";
  agents: SwarmAgentState[];
}

/** Ajanın terminalde çalıştırdığı bir komut — sohbette "todo" kutusunda canlı
    çizilir (çalışıyor → bitti) ve çıktısı kutunun içinde gösterilir. */
export interface CommandRun {
  command: string;
  output?: string;
  status: "running" | "done" | "error";
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
  | "github"
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

/** Olay-tabanlı otomasyon: belirli bir olayda terminalde komut çalıştırır.
 *  afterWrite = ajan dosya yazınca, afterResponse = her yanıttan sonra. */
export interface Automation {
  id: string;
  name: string;
  /** afterWrite/afterResponse = pratik kısayollar; preToolUse/postToolUse/onStop
   *  = Claude Code tarzı hook olayları (araç öncesi/sonrası, tur bitişi). */
  event: "afterWrite" | "afterResponse" | "preToolUse" | "postToolUse" | "onStop";
  command: string;
  enabled: boolean;
}

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  systemPrompt: string;
  created_at: number;
  /** Bu proje aktifken kullanılacak model (boşsa global aktif model). */
  modelId?: string;
  /** Bu projeye özel örnekleme sıcaklığı (0-2). Tanımsız = sağlayıcı varsayılanı. */
  temperature?: number;
  /** Bu projeye özel maksimum yanıt token'ı. Tanımsız = sağlayıcı varsayılanı. */
  maxTokens?: number;
  /** Kısa açıklama (sidebar/araç ipucu). */
  description?: string;
  /** Görsel kimlik: renk anahtarı (PROJECT_COLORS) ve emoji/ikon. */
  color?: string;
  icon?: string;
  /** Proje açılınca otomatik yüklenecek varsayılan repo ("owner/repo") + branch. */
  repo?: string;
  branch?: string;
  /** Bilgi tabanı: projedeki her sohbete bağlam olarak verilen referans dosyalar. */
  files?: ProjectFile[];
  /** Projeye özel aktif Skills (tanımlıysa global yerine bu set kullanılır). */
  skillIds?: string[];
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
  /** Sağlayıcı başına hatırlanan API anahtarı. Bir kez girilince o sağlayıcı
      için tekrar girmeye gerek kalmaz (model değiştirsen bile dolu gelir). */
  providerKeys?: Partial<Record<Provider, string>>;
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
  /** Açıksa tema işletim sistemini izler (prefers-color-scheme). */
  autoTheme?: boolean;
  /** Otomatik bellek: her yanıt sonrası kalıcı tercihler "🧠 Otomatik Bellek"
      skill'ine damıtılır ve sonraki sohbetlerin prompt'una eklenir. */
  autoMemory?: boolean;
  /** Yanıt token sınırında kesilirse otomatik sürdür (en çok 2 kez). */
  autoContinue?: boolean;
  /** Çok-geçişli kalite modu: taslak → öz-eleştiri → düzeltme (tek yanıtta). */
  qualityMode?: boolean;
  webSearch: boolean;
  cliMode: boolean;
  autoTerminal: boolean;
  /** Editörde satır içi (ghost text) AI tamamlama. Aktif modelin API kotasını
      kullandığı için kapatılabilir. Tanımsız = açık. */
  inlineCompletion?: boolean;
  /** Açıksa ajan dosyaları doğrudan yazıp commit edemez; değişiklikleri kod
      bloğu olarak ÖNERİR, kullanıcı commit arayüzüyle uygular. Tanımsız = kapalı. */
  requireWriteApproval?: boolean;
  /** Açıksa SALT-OKUNUR mod: ajan hiçbir değiştirici aracı kullanamaz
      (write/str_replace/delete/rename/branch/PR/komut). Yalnızca okuma,
      arama ve analiz. Tanımsız = kapalı. */
  safeMode?: boolean;
  /** Araç-bazlı izin politikası: toolName → false ise o araç ajana hiç
      sunulmaz (deny). Anahtar yoksa veya true ise izinli. Granüler kontrol. */
  toolPermissions?: Record<string, boolean>;
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
  /** Uzak WebSocket PTY sunucusu URL'i (ör. wss://terminal.example.com?token=xxx).
      Boşsa WebContainer sandbox kullanılır. */
  terminalWsUrl?: string;
  /** Gerçek terminal bağlanınca otomatik çalıştırılacak kurulum komutu
   *  (ör. "npm install && npm run dev"). Boşsa hiçbir şey çalıştırılmaz. */
  terminalSetupCommand?: string;
  /** Olaya bağlı otomasyonlar (Claude Code hooks benzeri). */
  automations?: Automation[];
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
