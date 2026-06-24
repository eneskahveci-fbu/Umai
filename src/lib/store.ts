import { create } from "zustand";
import type {
  Artifact,
  Chat,
  ChatMessage,
  Config,
  FileCheckpoint,
  GitHubAccount,
  GitLabAccount,
  Hook,
  McpServer,
  MemoryItem,
  ModelProfile,
  OpenFile,
  Project,
  RepoState,
  Skill,
  Snippet,
  Toast,
  ToolCallRecord,
  TreeNode,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_REPO, DEFAULT_SKILLS, POLLINATIONS_DEFAULT_MODEL } from "./constants";
import { encryptConfigSecrets, decryptConfigSecrets, isCryptoAvailable, hasPlaintextSecret } from "./secureKeys";
import { applyEditBranch, applySwitchBranch } from "./branching";
import { createClient } from "./supabase/client";

/* Config yazımları için monotonik sıra: async şifreli yazımların sırasını korur
   (eski yazım yeniyi ezmesin). */
let saveSeq = 0;
const CONFIG_KEY = "craftai_config";
const CHATS_KEY = "craftai_chats";
const SNIPPETS_KEY = "craftai_snippets";
const GUEST_KEY = "craftai_guest";
/* Yerel config'in HANGİ kullanıcıya ait olduğu. Farklı kullanıcı giriş yaparsa
   önceki kullanıcının modeli/git'i sızmasın diye birleştirme YAPILMAZ. */
const CONFIG_OWNER_KEY = "craftai_config_owner";
function getConfigOwner(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(CONFIG_OWNER_KEY); } catch { return null; }
}
function setConfigOwner(id: string | null): void {
  if (typeof window === "undefined") return;
  try { if (id) window.localStorage.setItem(CONFIG_OWNER_KEY, id); else window.localStorage.removeItem(CONFIG_OWNER_KEY); } catch { /* yok */ }
}

/* Guest mode: API keys/tokens live in sessionStorage so they vanish on
   browser/tab close. Useful on shared machines. The flag itself is in
   sessionStorage too, so a clean tab starts in normal mode. */
function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(GUEST_KEY) === "1"; } catch { return false; }
}
function getStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return isGuestMode() ? window.sessionStorage : window.localStorage; } catch { return null; }
}
export function setGuestMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) sessionStorage.setItem(GUEST_KEY, "1");
    else sessionStorage.removeItem(GUEST_KEY);
  } catch { /* ignore */ }
}
export { isGuestMode };

function loadSnippets(): Snippet[] {
  const store = getStore();
  if (!store) return [];
  try { return JSON.parse(store.getItem(SNIPPETS_KEY) || "[]"); } catch { return []; }
}
function saveSnippets(s: Snippet[]) {
  const store = getStore();
  if (!store) return;
  store.setItem(SNIPPETS_KEY, JSON.stringify(s));
}

/* Kullanıcının açıkça sildiği varsayılan skill id'leri burada tutulur. Böylece
   varsayılanları her açılışta "kendi kendini onaran" şekilde geri yükleyebiliriz
   ama kullanıcının bilerek sildikleri geri gelmez. */
const REMOVED_DEFAULTS_KEY = "craftai_removed_default_skills";

function getRemovedDefaults(store: Storage): Set<string> {
  try { return new Set(JSON.parse(store.getItem(REMOVED_DEFAULTS_KEY) || "[]")); } catch { return new Set(); }
}
function addRemovedDefault(id: string) {
  const store = getStore();
  if (!store) return;
  if (!DEFAULT_SKILLS.some((s) => s.id === id)) return; // sadece varsayılanları izle
  try {
    const set = getRemovedDefaults(store);
    set.add(id);
    store.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify([...set]));
  } catch { /* yok say */ }
}

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function loadConfig(): Config {
  const store = getStore();
  if (!store) return { ...DEFAULT_CONFIG, models: [POLLINATIONS_DEFAULT_MODEL], activeModelId: POLLINATIONS_DEFAULT_MODEL.id };
  try {
    const raw = store.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = { ...DEFAULT_CONFIG, ...parsed };
      /* migrate: eski memories'i Skill formatına çevir */
      if ((!merged.skills || merged.skills.length === 0) && Array.isArray(merged.memories) && merged.memories.length > 0) {
        merged.skills = merged.memories.map((m: MemoryItem, i: number) => ({
          id: m.id || `migrated_${i}`,
          title: m.content.split("\n")[0].slice(0, 60) || "Skill",
          content: m.content,
          tags: [],
          enabled: true,
          source: "manual" as const,
          usageCount: 0,
          createdAt: Date.now() - (merged.memories.length - i) * 1000,
        }));
      }
      /* Kendi kendini onaran tohumlama: kullanıcının SİLMEDİĞİ tüm varsayılan
         skill dosyalarını her yüklemede garanti altına al. Mevcut skill'ler,
         sıraları ve aç/kapa tercihleri korunur; yalnızca eksik olan varsayılanlar
         eklenir. Böylece eski bir "bayrak" yüzünden takılıp kalma sorunu olmaz. */
      const existing: Skill[] = Array.isArray(merged.skills) ? merged.skills : [];
      const existingIds = new Set(existing.map((s) => s.id));
      const removed = getRemovedDefaults(store);
      const missing = DEFAULT_SKILLS.filter((s) => !existingIds.has(s.id) && !removed.has(s.id));
      if (missing.length) {
        merged.skills = [...missing, ...existing];
        try { store.setItem(CONFIG_KEY, JSON.stringify(merged)); } catch { /* yok say */ }
      }
      /* Eski purple/blue accent renkleri amber'e migrate et */
      if ((merged.accentColor as string) === "purple" || (merged.accentColor as string) === "blue") {
        merged.accentColor = "amber";
      }
      /* Eski küçük bağlam penceresini (8192) çok daha uzun varsayılana yükselt */
      if (typeof merged.maxContext !== "number" || merged.maxContext <= 8192) {
        merged.maxContext = 128000;
      }
      /* Eğer hiç model yoksa, ücretsiz Pollinations modelini tohum olarak ekle */
      if (!Array.isArray(merged.models) || merged.models.length === 0) {
        merged.models = [POLLINATIONS_DEFAULT_MODEL];
        merged.activeModelId = POLLINATIONS_DEFAULT_MODEL.id;
        try { store.setItem(CONFIG_KEY, JSON.stringify(merged)); } catch { /* yok say */ }
      }
      /* Eski Pollinations profillerinde openai-fast → openai migrate et */
      if (Array.isArray(merged.models)) {
        merged.models = merged.models.map((m: ModelProfile) =>
          m.provider === "pollinations" && m.model === "openai-fast"
            ? { ...m, model: "openai" }
            : m
        );
      }
      /* Ölü GitHub deposunu canlı GitLab deposuna migrate et */
      const migrated = migrateRepos(merged);
      if (migrated !== merged) {
        try { store.setItem(CONFIG_KEY, JSON.stringify(migrated)); } catch { /* yok say */ }
      }
      return migrated;
    }
  } catch {
    /* yok say */
  }
  /* localStorage boşsa (browser gizli mod / temiz oturum): önce bu oturumda
     kaydedilmiş sessionStorage yedeğine bak; yoksa Pollinations tohumu ile başla. */
  if (typeof window !== "undefined") {
    try {
      const ssRaw = window.sessionStorage.getItem(CONFIG_KEY + "_backup");
      if (ssRaw) {
        const parsed = JSON.parse(ssRaw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch { /* yok say */ }
  }
  return { ...DEFAULT_CONFIG, models: [POLLINATIONS_DEFAULT_MODEL], activeModelId: POLLINATIONS_DEFAULT_MODEL.id };
}

function loadLocalChats(): Chat[] {
  const store = getStore();
  if (!store) return [];
  try {
    return JSON.parse(store.getItem(CHATS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalChats(chats: Chat[]) {
  const store = getStore();
  if (!store) return;
  store.setItem(
    CHATS_KEY,
    JSON.stringify(chats.filter((c) => !c.incognito)),
  );
}

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

/* Eski/ölü varsayılan GitHub depolarını canlı GitLab deposuna migrate eder.
   Hesap GitLab'a taşındığından, kayıtlı eski repo'lar artık 404 veriyordu. */
const DEAD_REPOS = new Set(["eneskahveci-sdo/craft-ai"]);
export function migrateRepos(cfg: Config): Config {
  if (!Array.isArray(cfg.repos) || !cfg.repos.some((r) => DEAD_REPOS.has(r))) return cfg;
  const repos = [...new Set(cfg.repos.map((r) => (DEAD_REPOS.has(r) ? DEFAULT_REPO : r)))];
  const activeRepo = cfg.activeRepo && DEAD_REPOS.has(cfg.activeRepo) ? DEFAULT_REPO : cfg.activeRepo;
  return { ...cfg, repos, activeRepo };
}

/* ─── Config birleştirme (hesap senkronu) ───
   Uzak (buluttaki) config ile yereldeki config'i, hiçbir model/hesap/anahtar
   kaybetmeden birleştirir. Böylece eski/boş bir bulut kaydı, yerelde duran
   anahtarları ezip "kayboluyor" hissi yaratmaz. */
function mergeById<T extends { id: string }>(
  local: T[],
  remote: T[],
  pick?: (l: T, r: T) => T,
): T[] {
  const map = new Map<string, T>();
  for (const item of local ?? []) map.set(item.id, item);
  for (const item of remote ?? []) {
    const existing = map.get(item.id);
    map.set(item.id, existing && pick ? pick(existing, item) : item);
  }
  return [...map.values()];
}

export function mergeConfigs(local: Config, remote: Partial<Config>): Config {
  /* Skalar tercihler için uzak (en son senkronlanan cihaz) kazanır. */
  const base: Config = { ...DEFAULT_CONFIG, ...local, ...remote };
  /* Diziler: id'ye göre birleştir; çakışmada anahtarı/token'ı dolu olanı koru. */
  base.models = mergeById(local.models, remote.models ?? [], (l, r) => (r.apiKey ? r : l));
  base.githubAccounts = mergeById(local.githubAccounts, remote.githubAccounts ?? [], (l, r) => (r.token ? r : l));
  base.gitlabAccounts = mergeById(local.gitlabAccounts, remote.gitlabAccounts ?? [], (l, r) => (r.token ? r : l));
  base.skills = mergeById(local.skills, remote.skills ?? []);
  base.projects = mergeById(local.projects, remote.projects ?? []);
  base.mcpServers = mergeById(local.mcpServers ?? [], remote.mcpServers ?? []);
  base.hooks = mergeById(local.hooks ?? [], remote.hooks ?? []);
  base.repos = [...new Set([...(remote.repos ?? []), ...(local.repos ?? [])])];
  /* Aktif id'ler hâlâ listede mevcutsa korunur, değilse ilk öğeye düşülür. */
  const has = <T extends { id: string }>(arr: T[], id: string | null) => !!id && arr.some((x) => x.id === id);
  base.activeModelId = has(base.models, base.activeModelId) ? base.activeModelId : (base.models[0]?.id ?? null);
  base.activeGithubId = has(base.githubAccounts, base.activeGithubId) ? base.activeGithubId : (base.githubAccounts[0]?.id ?? null);
  base.activeGitlabId = has(base.gitlabAccounts, base.activeGitlabId) ? base.activeGitlabId : (base.gitlabAccounts[0]?.id ?? null);
  /* Birleşmede uzaktaki ölü repo geri gelmiş olabilir → tekrar migrate et. */
  return migrateRepos(base);
}

/* MUTLAK KURAL: giriş yapınca yerel sohbetler EZİLMEZ; buluttakilerle BİRLEŞTİRİLİR.
   id'ye göre birleşim; çakışmada DAHA ZENGİN (daha çok mesajlı) sürüm tutulur.
   `toUpload`: yerelde olup bulutta olmayan veya yerelin kazandığı sohbetler → buluta
   yüklenir ki hiçbir veri kaybolmasın. Saf fonksiyon (test edilebilir). */
export function mergeChats(local: Chat[], cloud: Chat[]): { merged: Chat[]; toUpload: Chat[] } {
  const byId = new Map<string, Chat>();
  for (const c of cloud) byId.set(c.id, c);
  const toUpload: Chat[] = [];
  for (const c of local) {
    if (c.incognito) continue; // gizli sohbetler buluta gitmez
    const ex = byId.get(c.id);
    if (!ex) {
      byId.set(c.id, c);
      toUpload.push(c);
    } else if (c.messages.length > ex.messages.length) {
      byId.set(c.id, c);
      toUpload.push(c);
    }
  }
  const merged = [...byId.values()].sort((a, b) => b.created_at - a.created_at);
  return { merged, toUpload };
}

/* Config'i Supabase'e yazar. Hata olursa (tablo yok / RLS / ağ) bir kez
   kullanıcıya bildirir; böylece "ayarlarım kayboluyor" sorunu sessiz kalmaz. */
let cloudPushFailed = false;
function pushCloudConfig(get: () => StoreState, userId: string, config: Config) {
  const sb = createClient();
  if (!sb) return;
  sb.from("user_config")
    .upsert({ user_id: userId, config, updated_at: new Date().toISOString() })
    .then(({ error }: { error: unknown }) => {
      if (error) {
        if (!cloudPushFailed) {
          cloudPushFailed = true;
          get().addToast("Ayarlar buluta kaydedilemedi — Supabase 'user_config' tablosunu kontrol et.", "error");
        }
      } else {
        cloudPushFailed = false;
      }
    });
}

interface StoreState {
  userId: string | null;
  userEmail: string | null;
  setUser: (id: string | null, email: string | null) => void;
  /** Abonelik planı (Stripe). Giriş yoksa/yapılandırılmamışsa "free". BYOK her
      zaman ücretsiz çalışır; "pro" yalnızca ek özellikleri açar. */
  plan: "free" | "pro";
  loadPlan: (userId: string | null) => Promise<void>;

  config: Config;
  saveConfig: (c: Config) => void;
  /** Açılışta: depodaki şifreli gizli alanları çözüp belleğe alır ve eski düz
      metin anahtarları şifreli forma migrate eder. Eski veri asla bozulmaz. */
  rehydrateSecrets: () => Promise<void>;
  syncConfig: (userId: string) => Promise<void>;
  addModel: (m: Omit<ModelProfile, "id">) => void;
  updateModel: (id: string, patch: Partial<ModelProfile>) => void;
  removeModel: (id: string) => void;
  setActiveModel: (id: string) => void;
  activeModel: () => ModelProfile | null;
  /** Yapılandırılmış modeller arasında EN GÜÇLÜSÜNÜ seçer (ajanlar için). */
  strongestModel: () => ModelProfile | null;
  addGithub: (a: Omit<GitHubAccount, "id">) => void;
  removeGithub: (id: string) => void;
  setActiveGithub: (id: string | null) => void;
  activeGithub: () => GitHubAccount | null;
  addGitlab: (a: Omit<GitLabAccount, "id">) => void;
  removeGitlab: (id: string) => void;
  setActiveGitlab: (id: string | null) => void;
  activeGitlab: () => GitLabAccount | null;
  addRepo: (repo: string) => void;
  setActiveRepo: (repo: string) => void;
  removeRepo: (repo: string) => void;
  toggleTheme: () => void;

  // projects
  addProject: (name: string) => string;
  addProjectFromTemplate: (tpl: { name: string; icon?: string; color?: string; description?: string; systemPrompt?: string }) => string;
  removeProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  setActiveProject: (id: string | null) => void;
  addProjectFile: (projectId: string, file: { name: string; content: string }) => void;
  removeProjectFile: (projectId: string, fileId: string) => void;
  /** Düzenlenen projenin id'si (ProjectModal). null = kapalı. */
  projectModalId: string | null;
  setProjectModalId: (id: string | null) => void;

  // memory (legacy — kept for back-compat)
  addMemory: (content: string) => void;
  removeMemory: (id: string) => void;
  editMemory: (id: string, content: string) => void;

  // skills
  skillsOpen: boolean;
  setSkillsOpen: (b: boolean) => void;
  addSkill: (s: Omit<Skill, "id" | "createdAt" | "usageCount">) => void;
  updateSkill: (id: string, patch: Partial<Skill>) => void;
  /** Otomatik bellek: damıtılmış kalıcı bilgileri "auto_memory" skill'ine
      ekler (tekilleştirme + en eski kayıtları düşerek en çok 40 madde). */
  addAutoMemoryFacts: (facts: string[]) => void;
  /** Otomatik bellek listesini tamamen değiştirir (düzenle/sil için). Boş liste
      → "auto_memory" skill'i kaldırılır. */
  setAutoMemoryFacts: (facts: string[]) => void;
  removeSkill: (id: string) => void;
  toggleSkill: (id: string) => void;
  incrementSkillUsage: (ids: string[]) => void;
  resetSkillProgress: () => void;

  view: "chat" | "coder" | "compare";
  setView: (v: "chat" | "coder" | "compare") => void;
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  imageStudioOpen: boolean;
  setImageStudioOpen: (b: boolean) => void;
  designStudioOpen: boolean;
  setDesignStudioOpen: (b: boolean) => void;
  /** Yeni Stüdyo (Open Design tarzı brief→önizleme deneyimi). Klasik DesignStudio
      "Gelişmiş tuval" olarak erişilebilir kalır. */
  studioOpen: boolean;
  setStudioOpen: (b: boolean) => void;
  streaming: boolean;
  setStreaming: (b: boolean) => void;

  chats: Chat[];
  currentId: string | null;
  incognito: boolean;
  loadChats: (userId: string | null) => Promise<void>;
  importBackup: (data: { config?: Config; chats?: Chat[] }) => void;
  newChat: (incognito?: boolean) => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => void;
  tagChat: (id: string, tags: string[]) => void;
  pinChat: (id: string, pinned: boolean) => void;
  current: () => Chat | null;
  pushMessage: (m: ChatMessage) => void;
  updateLastContent: (content: string) => void;
  updateLastThinking: (thinking: string) => void;
  setPlanOnLast: (plan: string) => void;
  setSwarmOnLast: (swarm: import("./types").SwarmState) => void;
  addCommandRun: (command: string) => void;
  setCommandOutput: (command: string, output: string, status: "done" | "error") => void;
  setCheckpointsOnLast: (checkpoints: FileCheckpoint[]) => void;
  setFinishReasonOnLast: (finishReason: string | undefined) => void;
  setSourcesOnLast: (sources: { title: string; url: string }[]) => void;
  updateLastTokens: (tokenIn: number, tokenOut: number) => void;
  setLastAgentId: (agentId: string | undefined) => void;
  popLastMessage: () => void;
  editMessageAt: (index: number, content: string) => void;
  truncateAfter: (index: number) => void;
  editMessageBranch: (index: number, content: string) => void;
  switchMessageVersion: (index: number, branchIndex: number) => void;
  maybeSetTitle: (text: string) => void;
  persistCurrent: () => Promise<void>;
  exportChat: (id: string) => void;
  copyChatMarkdown: (id: string) => Promise<void>;

  // follow-up
  followUpSuggestions: string[];
  setFollowUpSuggestions: (s: string[]) => void;

  // artifact
  artifact: Artifact | null;
  setArtifact: (a: Artifact | null) => void;

  // toast
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;

  // coder
  repo: RepoState | null;
  tree: TreeNode | null;
  currentFile: OpenFile | null;
  setRepo: (r: RepoState | null) => void;
  setTree: (t: TreeNode | null) => void;
  setCurrentFile: (f: OpenFile | null) => void;

  pendingInput: string | null;
  setPendingInput: (s: string | null) => void;

  // kütüphane (snippet'ler + prompt şablonları, tek modal)
  libraryOpen: boolean;
  setLibraryOpen: (b: boolean) => void;
  libraryTab: "snippets" | "prompts";
  setLibraryTab: (t: "snippets" | "prompts") => void;

  // command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (b: boolean) => void;
  /** Denetim günlüğü (etkinlik) modali açık mı. */
  activityOpen: boolean;
  setActivityOpen: (b: boolean) => void;

  // keyboard shortcuts overlay
  shortcutsOpen: boolean;
  setShortcutsOpen: (b: boolean) => void;

  // onboarding
  onboardingDone: boolean;
  setOnboardingDone: (b: boolean) => void;

  // thinking mode
  thinkingMode: "auto" | "low" | "medium" | "high" | "max";
  setThinkingMode: (m: "auto" | "low" | "medium" | "high" | "max") => void;

  // tool-use
  toolsEnabled: boolean;
  setToolsEnabled: (b: boolean) => void;
  appendToolCallToLast: (tc: ToolCallRecord) => void;
  updateToolCallOnLast: (id: string, patch: Partial<ToolCallRecord>) => void;

  // snippets
  snippets: Snippet[];
  addSnippet: (s: Omit<Snippet, "id" | "created_at">) => void;
  removeSnippet: (id: string) => void;
  reorderSnippets: (fromId: string, toId: string) => void;

  // diff modal
  diffModal: { original: string; newCode: string; language: string; path?: string } | null;
  setDiffModal: (m: { original: string; newCode: string; language: string; path?: string } | null) => void;

  // message rating
  rateMessage: (chatId: string, msgIndex: number, rating: "up" | "down" | null) => void;

  // MCP servers
  addMcpServer: (s: Omit<McpServer, "id">) => void;
  removeMcpServer: (id: string) => void;
  updateMcpServer: (id: string, patch: Partial<McpServer>) => void;
  addHook: (h: Omit<Hook, "id">) => void;
  removeHook: (id: string) => void;
  updateHook: (id: string, patch: Partial<Hook>) => void;

  // compare view
}

export const useStore = create<StoreState>()((set, get) => ({
  userId: null,
  plan: "free",
  userEmail: null,
  setUser: (id, email) => {
    const prev = get().userId;
    set({ userId: id, userEmail: email });
    /* Çıkış (önceki kullanıcı vardı, şimdi yok) → yerel config'i temizle ki
       önceki kullanıcının modelleri/git hesapları tarayıcıda kalmasın. Sonraki
       giriş owner kontrolüyle zaten kendi config'ini yükler. */
    if (!id && prev) {
      const clean: Config = { ...DEFAULT_CONFIG };
      applyTheme(clean.theme ?? "dark");
      const store = getStore();
      if (store) { try { store.setItem(CONFIG_KEY, JSON.stringify(clean)); } catch { /* yok */ } }
      setConfigOwner(null);
      set({ config: clean, chats: [], currentId: null });
    }
  },
  loadPlan: async (userId) => {
    if (!userId) { set({ plan: "free" }); return; }
    const sb = createClient();
    if (!sb) { set({ plan: "free" }); return; }
    try {
      const { data } = await sb
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", userId)
        .maybeSingle();
      const pro = data?.plan === "pro" && (data?.status === "active" || data?.status === "trialing");
      set({ plan: pro ? "pro" : "free" });
    } catch {
      set({ plan: "free" }); // hata → güvenli varsayılan, BYOK çalışır
    }
  },

  config: loadConfig(),
  saveConfig: (c) => {
    const store = getStore();
    if (store) {
      applyTheme(c.theme);
      /* Gizli alanları (API anahtarları/token'lar) AES-GCM ile şifreleyip öyle
         yaz → düz metin bırakma. Şifreleme async; kripto yoksa Config aynen döner
         (eski davranış). Sıra numarasıyla eski yazımların yenisini ezmesi önlenir.
         Bellekteki state DÜZ METİN kalır (uygulama anahtarları doğrudan kullanır). */
      const seq = ++saveSeq;
      void encryptConfigSecrets(c).then((enc) => {
        if (seq !== saveSeq || !store) return;
        try {
          store.setItem(CONFIG_KEY, JSON.stringify(enc));
        } catch (e) {
          if ((e as Error)?.name === "QuotaExceededError") {
            get().addToast("Tarayıcı depolaması dolu — eski sohbetleri/skill'leri sil.", "error");
          }
        }
        if (!isGuestMode()) {
          try { window.sessionStorage.setItem(CONFIG_KEY + "_backup", JSON.stringify(enc)); } catch { /* ignore */ }
        }
      });
    }
    set({ config: c });
    /* Supabase'e senkron (giriş yapıldıysa). Hata yutulmaz: kalıcı başarısızlıkta
       kullanıcı tek seferlik bir uyarı görür (tablo/RLS eksikse "kayboluyor"
       hissinin sessiz kalmaması için). */
    const { userId } = get();
    if (userId) setConfigOwner(userId);
    if (userId && !isGuestMode()) pushCloudConfig(get, userId, c);
  },
  rehydrateSecrets: async () => {
    if (!isCryptoAvailable()) return; // kripto yok → düz metin zaten kullanılıyor
    const cur = get().config;
    /* Depodan gelen şifreli gizli alanları çöz (düz metinse passthrough). */
    const dec = await decryptConfigSecrets(cur);
    if (JSON.stringify(dec) !== JSON.stringify(cur)) {
      set({ config: dec });
    }
    /* Migrasyon: hâlâ düz metin anahtar varsa (eski veri), şifreli forma yaz.
       saveConfig zaten şifreli kalıcılaştırır; burada yalnızca depoyu günceller. */
    if (hasPlaintextSecret(dec)) {
      const store = getStore();
      if (store) {
        const seq = ++saveSeq;
        const enc = await encryptConfigSecrets(dec);
        if (seq === saveSeq) {
          try { store.setItem(CONFIG_KEY, JSON.stringify(enc)); } catch { /* yok say */ }
          if (!isGuestMode()) {
            try { window.sessionStorage.setItem(CONFIG_KEY + "_backup", JSON.stringify(enc)); } catch { /* yok say */ }
          }
        }
      }
    }
  },
  syncConfig: async (userId) => {
    if (isGuestMode()) return;
    const sb = createClient();
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from("user_config")
        .select("config")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        get().addToast("Hesap senkronu okunamadı — Supabase 'user_config' tablosunu kontrol et.", "error");
        return;
      }
      const remote = (data?.config ?? null) as Partial<Config> | null;
      const owner = getConfigOwner();
      const apply = (cfg: Config) => {
        applyTheme(cfg.theme ?? "dark");
        const store = getStore();
        if (store) store.setItem(CONFIG_KEY, JSON.stringify(cfg));
        set({ config: cfg });
        setConfigOwner(userId);
      };
      if (owner === userId) {
        /* Aynı kullanıcı → cihazlar arası birleştir (model/git kaybetme). */
        const local = get().config;
        if (remote) { const merged = mergeConfigs(local, remote); apply(merged); pushCloudConfig(get, userId, merged); }
        else { apply(local); pushCloudConfig(get, userId, local); }
      } else {
        /* Farklı kullanıcı (veya bu hesap bu tarayıcıda ilk kez) → YEREL config'i
           KULLANMA (önceki kullanıcının modeli/git'i sızmasın). Buluttaki kendi
           config'i varsa onu TEMİZ tabana uygula; yoksa temiz varsayılan (Pollinations). */
        if (remote) { apply(mergeConfigs(DEFAULT_CONFIG, remote)); }
        else { apply({ ...DEFAULT_CONFIG }); pushCloudConfig(get, userId, DEFAULT_CONFIG); }
      }
    } catch {
      get().addToast("Hesap senkronu sırasında hata oluştu.", "error");
    }
  },
  addModel: (m) => {
    const model: ModelProfile = { ...m, id: uid() };
    const config = get().config;
    get().saveConfig({
      ...config,
      models: [...config.models, model],
      activeModelId: config.activeModelId ?? model.id,
    });
  },
  updateModel: (id, patch) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      models: config.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  },
  removeModel: (id) => {
    const config = get().config;
    const models = config.models.filter((m) => m.id !== id);
    get().saveConfig({
      ...config,
      models,
      activeModelId:
        config.activeModelId === id ? (models[0]?.id ?? null) : config.activeModelId,
    });
  },
  setActiveModel: (id) => get().saveConfig({ ...get().config, activeModelId: id }),
  activeModel: () => {
    const { models, activeModelId } = get().config;
    return models.find((m) => m.id === activeModelId) || models[0] || null;
  },
  strongestModel: () => {
    const { models } = get().config;
    if (models.length <= 1) return get().activeModel();
    /* Yalnızca API anahtarı OLAN modeller arasından seç — erişimi olmayan
       (anahtarsız) bir modele düşüp 403 "No access" almayı önler (ör. preset
       gpt-4o-mini anahtarsızsa atlanır, aktif modele/anahtarlı güçlüye gidilir). */
    const pool = models.filter((m) => (m.apiKey || "").trim().length > 0);
    if (pool.length === 0) return get().activeModel();
    /* En güçlüden zayıfa öncelik sırası — ilk eşleşen yapılandırılmış model
       seçilir; hiçbiri tanınmıyorsa aktif modele düşer. */
    const order = ["opus", "gpt-5", "o4", "o3", "deepseek-reasoner", "sonnet", "claude-3.7", "grok-4", "gpt-4.1", "gemini-2.5-pro", "gpt-4o", "deepseek", "gemini-2.5", "llama-3.3-70b", "70b", "qwen3", "mistral-large", "codestral"];
    for (const key of order) {
      const m = pool.find((x) => `${x.model} ${x.label}`.toLowerCase().includes(key));
      if (m) return m;
    }
    return get().activeModel();
  },
  addGithub: (a) => {
    const acc: GitHubAccount = { ...a, id: uid() };
    const config = get().config;
    get().saveConfig({
      ...config,
      githubAccounts: [...config.githubAccounts, acc],
      activeGithubId: config.activeGithubId ?? acc.id,
    });
  },
  removeGithub: (id) => {
    const config = get().config;
    const githubAccounts = config.githubAccounts.filter((a) => a.id !== id);
    get().saveConfig({
      ...config,
      githubAccounts,
      activeGithubId:
        config.activeGithubId === id ? (githubAccounts[0]?.id ?? null) : config.activeGithubId,
    });
  },
  setActiveGithub: (id) => get().saveConfig({ ...get().config, activeGithubId: id }),
  activeGithub: () => {
    const { githubAccounts, activeGithubId } = get().config;
    return githubAccounts.find((a) => a.id === activeGithubId) || null;
  },
  addGitlab: (a) => {
    const acc: GitLabAccount = { ...a, id: uid() };
    const config = get().config;
    get().saveConfig({
      ...config,
      gitlabAccounts: [...(config.gitlabAccounts ?? []), acc],
      activeGitlabId: config.activeGitlabId ?? acc.id,
    });
  },
  removeGitlab: (id) => {
    const config = get().config;
    const gitlabAccounts = (config.gitlabAccounts ?? []).filter((a) => a.id !== id);
    get().saveConfig({
      ...config,
      gitlabAccounts,
      activeGitlabId:
        config.activeGitlabId === id ? (gitlabAccounts[0]?.id ?? null) : config.activeGitlabId,
    });
  },
  setActiveGitlab: (id) => get().saveConfig({ ...get().config, activeGitlabId: id }),
  activeGitlab: () => {
    const { gitlabAccounts, activeGitlabId } = get().config;
    return (gitlabAccounts ?? []).find((a) => a.id === activeGitlabId) || null;
  },
  addRepo: (repo) => {
    const config = get().config;
    const repos = [repo, ...config.repos.filter((r) => r !== repo)].slice(0, 12);
    get().saveConfig({ ...config, repos, activeRepo: repo });
  },
  setActiveRepo: (repo) => get().saveConfig({ ...get().config, activeRepo: repo }),
  removeRepo: (repo) => {
    const config = get().config;
    const repos = config.repos.filter((r) => r !== repo);
    const activeRepo = config.activeRepo === repo ? (repos[0] ?? null) : config.activeRepo;
    get().saveConfig({ ...config, repos, activeRepo });
  },
  toggleTheme: () => {
    const config = get().config;
    get().saveConfig({ ...config, theme: config.theme === "dark" ? "light" : "dark" });
  },

  /* ─── Projeler ─── */
  addProject: (name) => {
    const project: Project = { id: uid(), name, systemPrompt: "", created_at: Date.now() };
    const config = get().config;
    get().saveConfig({
      ...config,
      projects: [...config.projects, project],
      activeProjectId: project.id,
    });
    return project.id;
  },
  addProjectFromTemplate: (tpl) => {
    const project: Project = {
      id: uid(),
      name: tpl.name,
      systemPrompt: tpl.systemPrompt ?? "",
      created_at: Date.now(),
      icon: tpl.icon,
      color: tpl.color,
      description: tpl.description,
    };
    const config = get().config;
    get().saveConfig({
      ...config,
      projects: [...config.projects, project],
      activeProjectId: project.id,
    });
    return project.id;
  },
  addProjectFile: (projectId, file) => {
    const config = get().config;
    const entry = { id: uid(), name: file.name, content: file.content, createdAt: Date.now() };
    get().saveConfig({
      ...config,
      projects: config.projects.map((p) =>
        p.id === projectId ? { ...p, files: [...(p.files ?? []), entry] } : p,
      ),
    });
  },
  removeProjectFile: (projectId, fileId) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      projects: config.projects.map((p) =>
        p.id === projectId ? { ...p, files: (p.files ?? []).filter((f) => f.id !== fileId) } : p,
      ),
    });
  },
  removeProject: (id) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      projects: config.projects.filter((p) => p.id !== id),
      activeProjectId: config.activeProjectId === id ? null : config.activeProjectId,
    });
    set((s) => ({
      chats: s.chats.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)),
    }));
  },
  updateProject: (id, patch) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      projects: config.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  },
  setActiveProject: (id) => get().saveConfig({ ...get().config, activeProjectId: id }),
  projectModalId: null,
  setProjectModalId: (id) => set({ projectModalId: id }),

  /* ─── Bellek ─── */
  addMemory: (content) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      memories: [...config.memories, { id: uid(), content }],
    });
  },
  removeMemory: (id) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      memories: config.memories.filter((m) => m.id !== id),
    });
  },
  editMemory: (id, content) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      memories: config.memories.map((m) => m.id === id ? { ...m, content } : m),
    });
  },
  skillsOpen: false,
  setSkillsOpen: (b) => set({ skillsOpen: b }),

  addSkill: (s) => {
    const config = get().config;
    const skill: Skill = {
      ...s,
      id: uid(),
      createdAt: Date.now(),
      usageCount: 0,
    };
    get().saveConfig({ ...config, skills: [skill, ...(config.skills ?? [])] });
  },
  addAutoMemoryFacts: (facts) => {
    const config = get().config;
    const skills = (config.skills ?? []).slice();
    const idx = skills.findIndex((sk) => sk.id === "auto_memory");
    const existingLines = idx >= 0
      ? skills[idx].content.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim())
      : [];
    const seen = new Set(existingLines.map((l) => l.toLowerCase()));
    const fresh = facts
      .map((f) => f.trim().replace(/^[-•*]\s*/, ""))
      .filter((f) => f.length > 4 && f.length < 200 && !seen.has(f.toLowerCase()));
    if (fresh.length === 0) return;
    const all = [...existingLines, ...fresh].slice(-40); // en eskiler düşer
    const content =
      "# Otomatik Bellek\n\nKonuşmalardan damıtılan kalıcı tercihler — her sohbete otomatik eklenir.\n\n" +
      all.map((l) => `- ${l}`).join("\n");
    if (idx >= 0) {
      skills[idx] = { ...skills[idx], content };
    } else {
      skills.unshift({
        id: "auto_memory",
        title: "🧠 Otomatik Bellek",
        content,
        tags: ["bellek", "otomatik"],
        enabled: true,
        source: "manual",
        usageCount: 0,
        createdAt: Date.now(),
      });
    }
    get().saveConfig({ ...config, skills });
  },
  setAutoMemoryFacts: (facts) => {
    const config = get().config;
    const skills = (config.skills ?? []).slice();
    const idx = skills.findIndex((sk) => sk.id === "auto_memory");
    if (idx < 0) return;
    const clean = facts.map((f) => f.trim().replace(/^[-•*]\s*/, "")).filter((f) => f.length > 0);
    if (clean.length === 0) {
      /* Tümü silindi → otomatik bellek skill'ini kaldır. */
      skills.splice(idx, 1);
    } else {
      const content =
        "# Otomatik Bellek\n\nKonuşmalardan damıtılan kalıcı tercihler — her sohbete otomatik eklenir.\n\n" +
        clean.map((l) => `- ${l}`).join("\n");
      skills[idx] = { ...skills[idx], content };
    }
    get().saveConfig({ ...config, skills });
  },
  updateSkill: (id, patch) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      skills: (config.skills ?? []).map((s) => s.id === id ? { ...s, ...patch } : s),
    });
  },
  removeSkill: (id) => {
    const config = get().config;
    addRemovedDefault(id);
    get().saveConfig({
      ...config,
      skills: (config.skills ?? []).filter((s) => s.id !== id),
    });
  },
  toggleSkill: (id) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      skills: (config.skills ?? []).map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s),
    });
  },
  incrementSkillUsage: (ids) => {
    if (!ids.length) return;
    const config = get().config;
    const set = new Set(ids);
    get().saveConfig({
      ...config,
      skills: (config.skills ?? []).map((s) => set.has(s.id) ? { ...s, usageCount: s.usageCount + 1 } : s),
    });
  },
  resetSkillProgress: () => {
    const config = get().config;
    get().saveConfig({
      ...config,
      skills: (config.skills ?? []).map((s) => ({ ...s, usageCount: 0 })),
    });
  },

  view: "chat",
  setView: (v) => set({ view: v }),
  sidebarOpen: false,
  setSidebarOpen: (b) => set({ sidebarOpen: b }),
  settingsOpen: false,
  setSettingsOpen: (b) => set({ settingsOpen: b }),
  imageStudioOpen: false,
  setImageStudioOpen: (b) => set({ imageStudioOpen: b }),
  designStudioOpen: false,
  setDesignStudioOpen: (b) => set({ designStudioOpen: b }),
  studioOpen: false,
  setStudioOpen: (b) => set({ studioOpen: b }),
  streaming: false,
  setStreaming: (b) => set({ streaming: b }),

  chats: [],
  currentId: null,
  incognito: false,

  loadChats: async (userId) => {
    if (userId) {
      const sb = createClient();
      if (sb) {
        const { data } = await sb
          .from("chats")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        if (data) {
          const cloud: Chat[] = data.map((r) => ({
            id: r.id,
            title: r.title,
            messages: r.messages,
            created_at: new Date(r.created_at).getTime(),
            projectId: r.project_id ?? undefined,
          }));
          /* MUTLAK KURAL: yerel sohbetleri EZME — buluttakilerle BİRLEŞTİR. */
          const { merged, toUpload } = mergeChats(loadLocalChats(), cloud);
          set({ chats: merged });
          /* Yerelde olup bulutta olmayan / yerelin kazandığı sohbetleri buluta
             yükle ki hiçbir veri kaybolmasın. */
          if (toUpload.length) {
            void sb.from("chats").upsert(
              toUpload.map((c) => ({
                id: c.id,
                user_id: userId,
                title: c.title,
                messages: c.messages,
                project_id: c.projectId ?? null,
                created_at: new Date(c.created_at).toISOString(),
                updated_at: new Date().toISOString(),
              })),
            );
          }
          return;
        }
      }
    }
    set({ chats: loadLocalChats() });
  },

  importBackup: (data) => {
    if (data.config) get().saveConfig({ ...DEFAULT_CONFIG, ...data.config });
    if (Array.isArray(data.chats)) {
      set({ chats: data.chats, currentId: data.chats[0]?.id ?? null });
      saveLocalChats(data.chats);
    }
  },

  newChat: (incognito = false) => {
    const config = get().config;
    const chat: Chat = {
      id: uid(),
      title: "Yeni sohbet",
      messages: [],
      created_at: Date.now(),
      incognito,
      projectId: config.activeProjectId ?? undefined,
    };
    set((state) => ({
      chats: [chat, ...state.chats],
      currentId: chat.id,
      incognito,
      view: "chat",
      followUpSuggestions: [],
    }));
  },

  selectChat: (id) =>
    set({ currentId: id, incognito: false, view: "chat", followUpSuggestions: [] }),

  deleteChat: async (id) => {
    const { userId } = get();
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
    }));
    if (userId) {
      const sb = createClient();
      if (sb) await sb.from("chats").delete().eq("id", id);
    } else {
      saveLocalChats(get().chats);
    }
  },

  renameChat: (id, title) => {
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, title } : c)) }));
    const { userId } = get();
    if (userId) {
      const sb = createClient();
      if (sb) sb.from("chats").update({ title }).eq("id", id);
    } else {
      saveLocalChats(get().chats);
    }
  },

  tagChat: (id, tags) => {
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, tags } : c)) }));
    saveLocalChats(get().chats);
  },

  pinChat: (id, pinned) => {
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, pinned } : c)) }));
    saveLocalChats(get().chats);
  },

  current: () => {
    const { chats, currentId } = get();
    return chats.find((c) => c.id === currentId) || null;
  },

  pushMessage: (m) =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: [...c.messages, m] } : c,
      ),
    })),

  updateLastContent: (content) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], content };
        }
        return { ...c, messages };
      }),
    })),

  updateLastThinking: (thinking) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], thinking };
        }
        return { ...c, messages };
      }),
    })),
  setPlanOnLast: (plan) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], plan };
        }
        return { ...c, messages };
      }),
    })),
  setSwarmOnLast: (swarm) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], swarm };
        }
        return { ...c, messages };
      }),
    })),
  setCheckpointsOnLast: (checkpoints) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], checkpoints };
        }
        return { ...c, messages };
      }),
    })),
  /* Terminal komutu kutusu: son asistan mesajına "çalışıyor" satırı ekle. */
  addCommandRun: (command) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        let idx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant") { idx = i; break; }
        }
        if (idx < 0) idx = messages.length - 1;
        if (idx < 0) return c;
        const existing = messages[idx].commands ?? [];
        messages[idx] = { ...messages[idx], commands: [...existing, { command, status: "running" as const }] };
        return { ...c, messages };
      }),
    })),
  /* Komut çıktısı geldi: eşleşen "çalışıyor" komutunu (en yeni) güncelle. */
  setCommandOutput: (command, output, status) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        for (let i = messages.length - 1; i >= 0; i--) {
          const cmds = messages[i].commands;
          if (!cmds) continue;
          const j = (() => {
            for (let k = cmds.length - 1; k >= 0; k--) {
              if (cmds[k].command === command && cmds[k].status === "running") return k;
            }
            return -1;
          })();
          if (j >= 0) {
            const next = cmds.slice();
            next[j] = { ...next[j], output, status };
            messages[i] = { ...messages[i], commands: next };
            break;
          }
        }
        return { ...c, messages };
      }),
    })),
  setFinishReasonOnLast: (finishReason) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], finishReason };
        }
        return { ...c, messages };
      }),
    })),

  setSourcesOnLast: (sources) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], sources };
        }
        return { ...c, messages };
      }),
    })),

  updateLastTokens: (tokenIn, tokenOut) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            tokenIn,
            tokenOut,
          };
        }
        return {
          ...c,
          messages,
          totalInTokens: (c.totalInTokens ?? 0) + tokenIn,
          totalOutTokens: (c.totalOutTokens ?? 0) + tokenOut,
        };
      }),
    })),

  setLastAgentId: (agentId) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], agentId };
        }
        return { ...c, messages };
      }),
    })),

  popLastMessage: () =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: c.messages.slice(0, -1) } : c,
      ),
    })),

  editMessageAt: (index, content) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages[index]) messages[index] = { ...messages[index], content };
        return { ...c, messages };
      }),
    })),

  truncateAfter: (index) =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: c.messages.slice(0, index + 1) } : c,
      ),
    })),

  editMessageBranch: (index, content) =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: applyEditBranch(c.messages, index, content) } : c,
      ),
    })),

  switchMessageVersion: (index, branchIndex) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: applySwitchBranch(c.messages, index, branchIndex) } : c,
      ),
    }));
    void get().persistCurrent();
  },

  maybeSetTitle: (text) =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId && c.title === "Yeni sohbet"
          ? { ...c, title: text.slice(0, 48) }
          : c,
      ),
    })),

  persistCurrent: async () => {
    const { incognito, userId } = get();
    const chat = get().current();
    if (incognito || !chat) return;
    if (userId) {
      const sb = createClient();
      if (sb) {
        await sb.from("chats").upsert({
          id: chat.id,
          user_id: userId,
          title: chat.title,
          messages: chat.messages,
          project_id: chat.projectId ?? null,
          created_at: new Date(chat.created_at).toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      saveLocalChats(get().chats);
    }
  },

  exportChat: (id) => {
    const chat = get().chats.find((c) => c.id === id);
    if (!chat) return;
    let md = `# ${chat.title}\n\n`;
    for (const m of chat.messages) {
      md += `**${m.role === "user" ? "Kullanıcı" : "Asistan"}:**\n\n${m.content}\n\n---\n\n`;
    }
    download(md, `${safeName(chat.title)}.md`, "text/markdown");
  },

  copyChatMarkdown: async (id: string) => {
    const chat = get().chats.find((c) => c.id === id);
    if (!chat) return;
    let md = `# ${chat.title}\n\n`;
    for (const m of chat.messages) {
      md += `**${m.role === "user" ? "Kullanıcı" : "Asistan"}:**\n\n${m.content}\n\n---\n\n`;
    }
    try {
      await navigator.clipboard.writeText(md);
      get().addToast("Markdown panoya kopyalandı", "success");
    } catch {
      get().addToast("Kopyalanamadı", "error");
    }
  },

  followUpSuggestions: [],
  setFollowUpSuggestions: (s) => set({ followUpSuggestions: s }),

  artifact: null,
  setArtifact: (a) => set({ artifact: a }),

  toasts: [],
  addToast: (message, type = "info") => {
    const toast: Toast = { id: uid(), message, type };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => get().removeToast(toast.id), 3500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  repo: null,
  tree: null,
  currentFile: null,
  setRepo: (r) => {
    set({ repo: r });
    /* Claude Code tarzı: repo bağlanınca araçları (Tools) OTOMATİK aç —
       kullanıcı bilerek kapatmadıysa (localStorage "0"). Böylece ajan dosyaları
       kendi okuyup düzenler, kullanıcı ayrıca açmak zorunda kalmaz. */
    if (r && typeof window !== "undefined" && localStorage.getItem("craftai_tools") !== "0") {
      set({ toolsEnabled: true });
    }
  },
  setTree: (t) => set({ tree: t }),
  setCurrentFile: (f) => set({ currentFile: f }),

  pendingInput: null,
  setPendingInput: (s) => set({ pendingInput: s }),

  libraryOpen: false,
  setLibraryOpen: (b) => set({ libraryOpen: b }),
  libraryTab: "snippets",
  setLibraryTab: (t) => set({ libraryTab: t }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (b) => set({ commandPaletteOpen: b }),
  activityOpen: false,
  setActivityOpen: (b) => set({ activityOpen: b }),

  shortcutsOpen: false,
  setShortcutsOpen: (b) => set({ shortcutsOpen: b }),

  onboardingDone:
    typeof window !== "undefined" && localStorage.getItem("craftai_onboarded") === "1",
  setOnboardingDone: (b) => {
    if (typeof window !== "undefined") {
      if (b) localStorage.setItem("craftai_onboarded", "1");
      else localStorage.removeItem("craftai_onboarded");
    }
    set({ onboardingDone: b });
  },

  /* thinking mode — migrate old "fast"→"medium", "pro"→"high" */
  thinkingMode: (() => {
    if (typeof window === "undefined") return "auto";
    const raw = localStorage.getItem("craftai_thinking");
    if (raw === "fast") return "medium";
    if (raw === "pro") return "high";
    if (raw === "auto" || raw === "low" || raw === "medium" || raw === "high" || raw === "max") return raw;
    return "auto"; // varsayılan: efor OTOMATİK (göreve göre seçilir)
  })() as "auto" | "low" | "medium" | "high" | "max",
  setThinkingMode: (m) => {
    if (typeof window !== "undefined") localStorage.setItem("craftai_thinking", m);
    set({ thinkingMode: m });
  },

  /* tool-use */
  toolsEnabled:
    typeof window !== "undefined" && localStorage.getItem("craftai_tools") === "1",
  setToolsEnabled: (b) => {
    /* "1"=açık, "0"=kullanıcı bilerek kapattı, yok=hiç seçilmedi (repo bağlanınca
       otomatik açılabilir). */
    if (typeof window !== "undefined") {
      localStorage.setItem("craftai_tools", b ? "1" : "0");
    }
    set({ toolsEnabled: b });
  },
  appendToolCallToLast: (tc) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          const last = messages[messages.length - 1];
          messages[messages.length - 1] = {
            ...last,
            toolCalls: [...(last.toolCalls ?? []), tc],
          };
        }
        return { ...c, messages };
      }),
    })),
  updateToolCallOnLast: (id, patch) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          const last = messages[messages.length - 1];
          messages[messages.length - 1] = {
            ...last,
            toolCalls: (last.toolCalls ?? []).map((tc) =>
              tc.id === id ? { ...tc, ...patch } : tc,
            ),
          };
        }
        return { ...c, messages };
      }),
    })),

  /* snippets */
  snippets: loadSnippets(),
  addSnippet: (s) => {
    const snippet: Snippet = { ...s, id: uid(), created_at: Date.now() };
    set((st) => {
      const snippets = [snippet, ...st.snippets];
      saveSnippets(snippets);
      return { snippets };
    });
  },
  removeSnippet: (id) =>
    set((st) => {
      const snippets = st.snippets.filter((x) => x.id !== id);
      saveSnippets(snippets);
      return { snippets };
    }),
  reorderSnippets: (fromId, toId) => {
    const snips = [...get().snippets];
    const fromIdx = snips.findIndex((s) => s.id === fromId);
    const toIdx = snips.findIndex((s) => s.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [item] = snips.splice(fromIdx, 1);
    snips.splice(toIdx, 0, item);
    saveSnippets(snips);
    set({ snippets: snips });
  },

  /* diff modal */
  diffModal: null,
  setDiffModal: (m) => set({ diffModal: m }),

  /* message rating */
  rateMessage: (chatId, msgIndex, rating) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== chatId) return c;
        const messages = c.messages.slice();
        if (messages[msgIndex]) {
          messages[msgIndex] = { ...messages[msgIndex], rating: rating ?? undefined };
        }
        return { ...c, messages };
      }),
    })),

  /* MCP servers */
  addMcpServer: (s) => {
    const server: McpServer = { ...s, id: uid() };
    const config = get().config;
    get().saveConfig({ ...config, mcpServers: [...(config.mcpServers ?? []), server] });
  },
  removeMcpServer: (id) => {
    const config = get().config;
    get().saveConfig({ ...config, mcpServers: (config.mcpServers ?? []).filter((s) => s.id !== id) });
  },
  updateMcpServer: (id, patch) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      mcpServers: (config.mcpServers ?? []).map((s) => s.id === id ? { ...s, ...patch } : s),
    });
  },
  addHook: (h) => {
    const hook: Hook = { ...h, id: uid() };
    const config = get().config;
    get().saveConfig({ ...config, hooks: [...(config.hooks ?? []), hook] });
  },
  removeHook: (id) => {
    const config = get().config;
    get().saveConfig({ ...config, hooks: (config.hooks ?? []).filter((h) => h.id !== id) });
  },
  updateHook: (id, patch) => {
    const config = get().config;
    get().saveConfig({
      ...config,
      hooks: (config.hooks ?? []).map((h) => h.id === id ? { ...h, ...patch } : h),
    });
  },

}));

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, "").trim() || "sohbet";
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
