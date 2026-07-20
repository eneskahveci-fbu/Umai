import { create } from "zustand";
import { newHighlight, pushHighlight } from "./cards";
import type {
  Artifact,
  Chat,
  ChatMessage,
  Config,
  FileCheckpoint,
  GitHubAccount,
  GitLabAccount,
  Hook,
  MediaAsset,
  McpServer,
  MemoryItem,
  ModelProfile,
  Project,
  RepoState,
  Skill,
  Snippet,
  Toast,
  ToolCallRecord,
  TreeNode,
} from "./types";
import { deriveJobTitle, type BackgroundJob } from "./jobs";
import { DEFAULT_CONFIG, DEFAULT_REPO, DEFAULT_SKILLS, POLLINATIONS_DEFAULT_MODEL } from "./constants";
import { encryptConfigSecrets, decryptConfigSecrets, isCryptoAvailable, hasPlaintextSecret } from "./secureKeys";
import { applyEditBranch, applySwitchBranch, mergeRegeneratedBranches } from "./branching";
import { createClient } from "./supabase/client";

/* Config yazımları için monotonik sıra: async şifreli yazımların sırasını korur
   (eski yazım yeniyi ezmesin). */
let saveSeq = 0;
/* persistCurrent için monotonik sıra: streaming sırasında sık art arda
   tetiklenen çağrılar ağ üzerinde SIRASIZ tamamlanabilir (eski/az-mesajlı bir
   istek, yeni/çok-mesajlı bir isteği geride bırakıp DB'de son yazım olarak
   kalabilir). Tam çözüm sunucu taraflı koşullu yazım gerektirir; burada
   kendi-kendini-onaran bir yaklaşım kullanılıyor: bir çağrı tamamlandığında
   arada başka çağrı başladıysa (sıra ilerlediyse), o an bilinen EN GÜNCEL
   sohbet durumu bir kez daha yazılır. */
let persistSeq = 0;
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

/* Görev kuyruğu (Otonom Ajan) — yalnız yerelde tutulur (cloud'a gitmez;
   geçici, cihaza özgü). Sayfa yenilenince yarım kalan işler tekrar "queued"a
   çekilir → çalıştırıcı kaldığı yerden sürdürür. */
const JOBS_KEY = "craftai_jobs";
function loadJobs(): BackgroundJob[] {
  const store = getStore();
  if (!store) return [];
  try {
    const raw = JSON.parse(store.getItem(JOBS_KEY) || "[]") as BackgroundJob[];
    if (!Array.isArray(raw)) return [];
    /* Yenilemede "running" kalmış iş varsa (çalıştırıcı öldü) yeniden kuyruğa al. */
    return raw.map((j) => (j.status === "running" ? { ...j, status: "queued" as const } : j)).slice(0, 40);
  } catch { return []; }
}
function saveJobs(jobs: BackgroundJob[]) {
  const store = getStore();
  if (!store) return;
  try { store.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 40))); } catch { /* kota — yok say */ }
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
      /* Eski purple/blue/amber accent renklerini pine'a migrate et (amber sınıfı artık yok) */
      if (
        (merged.accentColor as string) === "purple" ||
        (merged.accentColor as string) === "blue" ||
        (merged.accentColor as string) === "amber"
      ) {
        merged.accentColor = "pine";
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
      /* Eski Görüntü Stüdyosu oturumlarını yeni Kütüphane'ye bir kez taşı.
         URL'ler zaten deterministik olduğu için indirme/yükleme gerekmez. */
      if (!Array.isArray(merged.mediaAssets) && Array.isArray(merged.craftImages)) {
        const mediaAssets: MediaAsset[] = merged.craftImages.flatMap((session: import("./types").CraftImageSession) =>
          session.msgs.flatMap((msg) => (msg.items ?? []).map((item) => ({
            id: item.id,
            title: session.title,
            url: item.url,
            prompt: msg.role === "user" ? msg.text : undefined,
            createdAt: session.updatedAt || session.createdAt || Date.now(),
            source: "image-gen" as const,
          }))),
        ).filter((asset: MediaAsset, index: number, all: MediaAsset[]) => Boolean(asset.url) && all.findIndex((x: MediaAsset) => x.id === asset.id) === index);
        merged.mediaAssets = mediaAssets;
        try { store.setItem(CONFIG_KEY, JSON.stringify(merged)); } catch { /* kota — yok say */ }
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
  deleted?: Set<string>,
): T[] {
  const map = new Map<string, T>();
  for (const item of local ?? []) { if (!deleted?.has(item.id)) map.set(item.id, item); }
  for (const item of remote ?? []) {
    if (deleted?.has(item.id)) continue;
    const existing = map.get(item.id);
    map.set(item.id, existing && pick ? pick(existing, item) : item);
  }
  return [...map.values()];
}

/* Silme "mezar taşı": bir öğe (model/hesap/proje/skill/mcp/hook) SİLİNDİĞİNDE
   id'si `config.deletedIds`'e eklenir — böylece cihazlar arası merge onu henüz
   senkronlanmamış bir cihazın bayat kopyasından GERİ GETİRMEZ (mergeById salt
   birleşim yaptığından, tombstone olmadan silinen öğe diğer cihazdan "dirilir").
   Sınırsız büyümesin diye son 500 id ile sınırlı (uid() rastgele olduğundan
   gerçek bir objeyle çakışma pratikte imkânsız). */
function markDeleted(config: Config, id: string): string[] {
  return [...new Set([...(config.deletedIds ?? []), id])].slice(-500);
}

export function mergeConfigs(local: Config, remote: Partial<Config>): Config {
  /* Skalar tercihler için uzak (en son senkronlanan cihaz) kazanır. */
  const base: Config = { ...DEFAULT_CONFIG, ...local, ...remote };
  /* İki taraftan silme mezar taşlarını birleştir (bkz. markDeleted). */
  const deletedIds = new Set([...(local.deletedIds ?? []), ...(remote.deletedIds ?? [])]);
  /* Diziler: id'ye göre birleştir; çakışmada anahtarı/token'ı dolu olanı koru.
     models için: ikisinde de updatedAt varsa en YENİ kazanır — böylece bir
     cihazda BİLEREK temizlenen (apiKey: "") bir anahtar, henüz senkronlanmamış
     eski bir cihazın hâlâ dolu kopyasıyla "geri gelmez". Zaman damgası
     yoksa (eski veri) geriye dönük uyum için eski sezgisel kural korunur. */
  base.models = mergeById(local.models, remote.models ?? [], (l, r) => {
    if (l.updatedAt !== undefined && r.updatedAt !== undefined) return r.updatedAt >= l.updatedAt ? r : l;
    return r.apiKey ? r : l;
  }, deletedIds);
  base.githubAccounts = mergeById(local.githubAccounts, remote.githubAccounts ?? [], (l, r) => (r.token ? r : l), deletedIds);
  base.gitlabAccounts = mergeById(local.gitlabAccounts, remote.gitlabAccounts ?? [], (l, r) => (r.token ? r : l), deletedIds);
  base.skills = mergeById(local.skills, remote.skills ?? [], undefined, deletedIds);
  base.projects = mergeById(local.projects, remote.projects ?? [], undefined, deletedIds);
  base.mcpServers = mergeById(local.mcpServers ?? [], remote.mcpServers ?? [], undefined, deletedIds);
  base.hooks = mergeById(local.hooks ?? [], remote.hooks ?? [], undefined, deletedIds);
  base.repos = [...new Set([...(remote.repos ?? []), ...(local.repos ?? [])])];
  base.deletedIds = [...deletedIds].slice(-500);
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

  // skills
  skillsOpen: boolean;
  setSkillsOpen: (b: boolean) => void;

  // eklenti mağazası (Sidebar → Eklentiler, Settings'i açmadan hızlı erişim)
  extensionStoreOpen: boolean;
  setExtensionStoreOpen: (b: boolean) => void;

  // editör (IDE) paneli — CommandPalette'in de erişebilmesi için global
  editorOpen: boolean;
  setEditorOpen: (b: boolean) => void;
  addSkill: (s: Omit<Skill, "id" | "createdAt" | "usageCount">) => void;
  /** Vurgular (Readwise'dan ilham): sohbet yanıtından pasaj kaydet/sil.
      Tekilleştirme + üst sınır lib/cards.ts pushHighlight'ta. */
  addHighlight: (text: string, source: string) => void;
  removeHighlight: (id: string) => void;
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
  /** Stüdyo (Open Design tarzı brief→önizleme deneyimi, tek tuval). */
  studioOpen: boolean;
  setStudioOpen: (b: boolean) => void;
  /** Doküman Stüdyosu (Notion'dan ilhamla; blok tabanlı doküman). */
  docsStudioOpen: boolean;
  setDocsStudioOpen: (b: boolean) => void;
  /** Anket Stüdyosu (Google Forms'tan ilhamla). */
  formsStudioOpen: boolean;
  setFormsStudioOpen: (b: boolean) => void;
  /** Kroki (zihin haritası; brief → AI ağaç → SVG). */
  mapStudioOpen: boolean;
  setMapStudioOpen: (b: boolean) => void;
  /** Kartlar (Anki'den ilhamla; aralıklı tekrar) + Vurgular. */
  cardsStudioOpen: boolean;
  setCardsStudioOpen: (b: boolean) => void;
  /** Defter (NotebookLM'den ilhamla; kaynak-temelli sohbet). */
  notebookStudioOpen: boolean;
  setNotebookStudioOpen: (b: boolean) => void;
  streaming: boolean;
  setStreaming: (b: boolean) => void;

  chats: Chat[];
  currentId: string | null;
  incognito: boolean;
  loadChats: (userId: string | null) => Promise<void>;
  /** Oturum içinde sohbetlerin hangi kullanıcı için yüklendiği (tek-yükleme koruması). */
  chatsLoadedFor?: string | null;
  /** Config senkron mutabakatı tamamlanan kullanıcı — saveConfig cloud-push kapısı. */
  configHydratedFor?: string | null;
  importBackup: (data: { config?: Config; chats?: Chat[] }) => void;
  newChat: (incognito?: boolean) => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => void;
  tagChat: (id: string, tags: string[]) => void;
  pinChat: (id: string, pinned: boolean) => void;
  moveChat: (id: string, projectId: string | null) => void;
  /** "İlgili" (bkz. relatedItems.ts) — yeni hesaplanan gömme vektörlerini
      önbelleğe yazar. Yalnız yerel (cihaz-içi) önbellektir; sunucuya gitmez. */
  updateChatEmbeddings: (updates: { id: string; embedding: number[]; embeddingVersion: number }[]) => void;
  current: () => Chat | null;
  pushMessage: (m: ChatMessage) => void;
  updateLastContent: (content: string, opts?: { isError?: boolean }) => void;
  updateLastThinking: (thinking: string) => void;
  setFusionModelsOnLast: (models: string[]) => void;
  setPlanOnLast: (plan: string) => void;
  setSwarmOnLast: (swarm: import("./types").SwarmState) => void;
  addCommandRun: (command: string) => void;
  setCommandOutput: (command: string, output: string, status: "done" | "error") => void;
  setCheckpointsOnLast: (checkpoints: FileCheckpoint[]) => void;
  setFinishReasonOnLast: (finishReason: string | undefined) => void;
  setSourcesOnLast: (sources: { title: string; url: string }[]) => void;
  updateLastTokens: (tokenIn: number, tokenOut: number) => void;
  popLastMessage: () => void;
  editMessageBranch: (index: number, content: string) => void;
  /** Dallanma YARATMADAN bir mesajın içeriğini yerinde düzeltir (ör. sohbet
      içi bir işaretleme kutusuna tıklanınca) — editMessageBranch'ten farklı
      olarak yeni bir sürüm/dal açmaz, sonraki mesajları etkilemez. */
  updateMessageContentAt: (index: number, content: string) => void;
  switchMessageVersion: (index: number, branchIndex: number) => void;
  /** "Yeniden oluştur" akışının ikinci yarısı — regenerate BAŞLAMADAN önce
      alınan `stashAsPendingBranches` çıktısını, biten yeni son mesaja işler
      (bkz. CoderView.tsx `regenerate()`, branching.ts). */
  mergeRegenerateBranches: (pendingBranches: ChatMessage[][]) => void;
  /** Karşılaştırma modu: kullanıcı `compareResults`'tan birini seçince o
      mesajı normal bir yanıta "çökertir" — content seçilen olur, compareResults
      silinir (bir daha karşılaştırma sütunları gösterilmez). */
  pickCompareResult: (index: number, resultIndex: number) => void;
  maybeSetTitle: (text: string) => void;
  persistCurrent: () => Promise<void>;
  exportChat: (id: string) => void;
  copyChatMarkdown: (id: string) => Promise<void>;

  // artifact
  artifact: Artifact | null;
  setArtifact: (a: Artifact | null) => void;

  // toast
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"], opts?: { action?: Toast["action"]; duration?: number }) => void;
  removeToast: (id: string) => void;

  // coder
  repo: RepoState | null;
  tree: TreeNode | null;
  setRepo: (r: RepoState | null) => void;
  setTree: (t: TreeNode | null) => void;

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

  // görev kuyruğu (Otonom Ajan — arka plan işleri)
  backgroundJobs: BackgroundJob[];
  /** Yeni bir hedefi kuyruğa ekler, işin id'sini döndürür. */
  enqueueJob: (goal: string) => string;
  updateJob: (id: string, patch: Partial<BackgroundJob>) => void;
  removeJob: (id: string) => void;
  /** Biten/hatalı/iptal işleri temizler. */
  clearFinishedJobs: () => void;

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
    /* İZOLASYON SÜPÜRGESİ — üç durumda yerel config ANINDA temizlenir:
       (a) çıkış (prev var, id yok), (b) CANLI HESAP DEĞİŞİMİ (prev≠id — login
       SPA navigasyonu store'u öldürmez, eski config bellekte kalıyordu),
       (c) yabancı yerel config (sayfa yenilenip FARKLI kullanıcıyla giriş:
       localStorage sahibi başka kullanıcı). Böylece önceki kullanıcının
       depoları/bellek kayıtları/anahtarları ne görünür ne de yeni hesabın
       bulutuna sızar; kullanıcının KENDİ verisi syncConfig ile buluttan gelir. */
    const localOwner = getConfigOwner();
    const foreignLocal = !!id && !!localOwner && localOwner !== id;
    if ((prev && prev !== id) || foreignLocal) {
      const clean: Config = { ...DEFAULT_CONFIG, models: [POLLINATIONS_DEFAULT_MODEL], activeModelId: POLLINATIONS_DEFAULT_MODEL.id };
      applyTheme(clean.theme ?? "dark");
      const store = getStore();
      if (store) {
        try { store.setItem(CONFIG_KEY, JSON.stringify(clean)); } catch { /* yok */ }
        /* Snippet kütüphanesi/arka plan görev kuyruğu/kaldırılmış-varsayılan-
           skill izleri CONFIG_OWNER_KEY'e bağlı DEĞİL — süpürge bunları
           atlarsa önceki kullanıcının prompt snippet'leri ve görev hedef
           metni (hassas olabilir) aynı tarayıcıda yeni hesaba aynen
           görünür kalırdı; kaldırılmış-varsayılan izleri de kalıcı olarak
           yeni kullanıcıdan bir varsayılan skill'i gizlerdi. */
        try { store.removeItem(SNIPPETS_KEY); } catch { /* yok */ }
        try { store.removeItem(JOBS_KEY); } catch { /* yok */ }
        try { store.removeItem(REMOVED_DEFAULTS_KEY); } catch { /* yok */ }
      }
      setConfigOwner(null);
      set({ config: clean, chats: [], currentId: null, chatsLoadedFor: undefined, configHydratedFor: null, snippets: [], backgroundJobs: [] });
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
  configHydratedFor: null,
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
    const { userId, configHydratedFor } = get();
    /* HİDRASYON KAPISI: owner damgası ve cloud yazımı YALNIZ syncConfig
       mutabakatı bittikten sonra — giriş anındaki yarış penceresinde bayat
       (önceki kullanıcıya ait) config asla yeni hesabın bulutuna gidemez.
       Erken save'ler yerelde kalır; sync birleşimi zaten cloud'a çıkarır. */
    if (userId && configHydratedFor === userId) {
      setConfigOwner(userId);
      if (!isGuestMode()) pushCloudConfig(get, userId, c);
    }
  },
  rehydrateSecrets: async () => {
    if (!isCryptoAvailable()) return; // kripto yok → düz metin zaten kullanılıyor
    const cur = get().config;
    /* Depodan gelen şifreli gizli alanları çöz (düz metinse passthrough). */
    const dec = await decryptConfigSecrets(cur);
    /* YARIŞ KORUMASI: decrypt async — bu sürede setUser (hesap değişimi
       izolasyon süpürgesi) veya syncConfig (gerçek hidrasyon) config'i
       TAMAMEN değiştirmiş olabilir. `cur` artık BAYAT bir anlık görüntüdür;
       onu uygulamak doğru izole edilmiş YENİ kullanıcının config'ini önceki
       kullanıcının çözülmüş anahtarlarıyla sessizce ezer. `set()` config'e
       dokunan her çağrıda YENİ bir nesne ürettiğinden (setUser/syncConfig'in
       kendi `set({config:...})` çağrıları), referans hâlâ `cur` ise hiçbir
       şey araya girmemiştir; değiştiyse sessizce vazgeç (doğru config zaten
       yerinde). */
    if (get().config !== cur) return;
    let appliedConfig = cur;
    if (JSON.stringify(dec) !== JSON.stringify(cur)) {
      set({ config: dec });
      appliedConfig = dec;
    }
    /* Migrasyon: hâlâ düz metin anahtar varsa (eski veri), şifreli forma yaz.
       saveConfig zaten şifreli kalıcılaştırır; burada yalnızca depoyu günceller. */
    if (hasPlaintextSecret(dec)) {
      const store = getStore();
      if (store) {
        const seq = ++saveSeq;
        const enc = await encryptConfigSecrets(dec);
        /* İkinci await'ten sonra da AYNI yarış kontrolü: bu süre zarfında da
           kullanıcı değişmiş olabilir — o zaman bayat şifreli veriyi depoya
           yazma. */
        if (seq === saveSeq && get().config === appliedConfig) {
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
      /* KRİTİK: bellekteki config HER ZAMAN düz metin olmalı (saveConfig
         sözleşmesi). Yerel taraf açılıştaki rehydrate yarışında hâlâ şifreli
         olabilir, buluttan gelen de şifreli kaydedilmiş olabilir — uygulamadan
         önce ÇÖZ. Aksi halde enc:1: anahtarlar bellekte kalıp sağlayıcılara
         gidiyor ve 401 veriyordu ("anahtar test edilmiyor / ücretsiz model
         bile hata veriyor" şikayetinin kök nedeni). */
      const apply = async (cfg: Config): Promise<Config> => {
        const plain = await decryptConfigSecrets(cfg);
        applyTheme(plain.theme ?? "dark");
        const store = getStore();
        /* Depoya saveConfig ile tutarlı biçimde ŞİFRELİ yaz — düz metin bırakma. */
        if (store) {
          try { store.setItem(CONFIG_KEY, JSON.stringify(await encryptConfigSecrets(plain))); } catch { /* kota — yok say */ }
        }
        set({ config: plain, configHydratedFor: userId });
        setConfigOwner(userId);
        return plain;
      };
      if (owner === userId) {
        /* Aynı kullanıcı → cihazlar arası birleştir (model/git kaybetme). */
        const local = get().config;
        if (remote) { const merged = await apply(mergeConfigs(local, remote)); pushCloudConfig(get, userId, merged); }
        else { const plain = await apply(local); pushCloudConfig(get, userId, plain); }
      } else {
        /* Farklı kullanıcı (veya bu hesap bu tarayıcıda ilk kez) → YEREL config'i
           KULLANMA (önceki kullanıcının modeli/git'i sızmasın). Buluttaki kendi
           config'i varsa onu TEMİZ tabana uygula; yoksa temiz varsayılan (Pollinations). */
        if (remote) { await apply(mergeConfigs(DEFAULT_CONFIG, remote)); }
        else { await apply({ ...DEFAULT_CONFIG }); pushCloudConfig(get, userId, DEFAULT_CONFIG); }
      }
    } catch {
      get().addToast("Hesap senkronu sırasında hata oluştu.", "error");
    }
  },
  updateModel: (id, patch) => {
    const config = get().config;
    /* apiKey değişince (temizleme dahil) zaman damgası da güncellenir — merge
       sırasında "boş anahtar" ile "henüz senkronlanmamış eski anahtar"
       ayrımı yapılabilsin diye (bkz. mergeConfigs). */
    const stamp = "apiKey" in patch ? { updatedAt: Date.now() } : {};
    get().saveConfig({
      ...config,
      models: config.models.map((m) => (m.id === id ? { ...m, ...patch, ...stamp } : m)),
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
      deletedIds: markDeleted(config, id),
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
      deletedIds: markDeleted(config, id),
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
      deletedIds: markDeleted(config, id),
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
      deletedIds: markDeleted(config, id),
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
  skillsOpen: false,
  setSkillsOpen: (b) => set({ skillsOpen: b }),
  extensionStoreOpen: false,
  setExtensionStoreOpen: (b) => set({ extensionStoreOpen: b }),

  editorOpen: false,
  setEditorOpen: (b) => set({ editorOpen: b }),

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
  addHighlight: (text, source) => {
    const config = get().config;
    const next = pushHighlight(config.highlights ?? [], newHighlight(text, source));
    if (next !== (config.highlights ?? [])) get().saveConfig({ ...config, highlights: next });
  },
  removeHighlight: (id) => {
    const config = get().config;
    get().saveConfig({ ...config, highlights: (config.highlights ?? []).filter((h) => h.id !== id) });
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
      deletedIds: markDeleted(config, id),
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
  studioOpen: false,
  setStudioOpen: (b) => set({ studioOpen: b }),
  docsStudioOpen: false,
  setDocsStudioOpen: (b) => set({ docsStudioOpen: b }),
  formsStudioOpen: false,
  setFormsStudioOpen: (b) => set({ formsStudioOpen: b }),
  mapStudioOpen: false,
  setMapStudioOpen: (b) => set({ mapStudioOpen: b }),
  cardsStudioOpen: false,
  setCardsStudioOpen: (b) => set({ cardsStudioOpen: b }),
  notebookStudioOpen: false,
  setNotebookStudioOpen: (b) => set({ notebookStudioOpen: b }),
  streaming: false,
  setStreaming: (b) => set({ streaming: b }),

  chats: [],
  chatsLoadedFor: undefined,
  currentId: null,
  incognito: false,

  loadChats: async (userId) => {
    /* KORUMA 1: Akış sürerken bellek ASLA ezilmez — akan (henüz persist
       edilmemiş) asistan/user mesajı kaybolmasın. Akış bitince persistCurrent
       zaten kalıcılaştırır. */
    if (get().streaming) return;
    /* KORUMA 2: Aynı kullanıcı için oturumda bir kez yükle — /app her remount
       olduğunda (ör. /studio'dan dönüş) bellekteki taze durum bayat
       localStorage+cloud birleşimiyle ezilmesin. Login/logout (farklı değer)
       normal yükler. */
    if (get().chatsLoadedFor === (userId ?? null)) return;
    set({ chatsLoadedFor: userId ?? null });
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
            tags: r.tags ?? undefined,
            pinned: r.pinned ?? false,
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
                tags: c.tags ?? null,
                pinned: c.pinned ?? false,
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
    }));
  },

  selectChat: (id) =>
    set({ currentId: id, incognito: false, view: "chat" }),

  deleteChat: async (id) => {
    const { userId } = get();
    const deleted = get().chats.find((c) => c.id === id);
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
    /* Yanlışlıkla silmeye karşı 6 sn "Geri al" — sohbet ve senkron geri gelir. */
    if (deleted && !deleted.incognito) {
      get().addToast("Sohbet silindi.", "info", {
        duration: 6000,
        action: {
          label: "Geri al",
          fn: () => {
            set((s) => ({ chats: [deleted, ...s.chats.filter((c) => c.id !== deleted.id)] }));
            if (userId) {
              const sb = createClient();
              if (sb) void sb.from("chats").upsert({
                id: deleted.id, user_id: userId, title: deleted.title, messages: deleted.messages,
                project_id: deleted.projectId ?? null,
                tags: deleted.tags ?? null,
                pinned: deleted.pinned ?? false,
                created_at: new Date(deleted.created_at).toISOString(),
                updated_at: new Date().toISOString(),
              });
            } else {
              saveLocalChats(get().chats);
            }
          },
        },
      });
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
    const { userId } = get();
    if (userId) {
      const sb = createClient();
      if (sb) sb.from("chats").update({ tags }).eq("id", id);
    } else {
      saveLocalChats(get().chats);
    }
  },

  pinChat: (id, pinned) => {
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, pinned } : c)) }));
    const { userId } = get();
    if (userId) {
      const sb = createClient();
      if (sb) sb.from("chats").update({ pinned }).eq("id", id);
    } else {
      saveLocalChats(get().chats);
    }
  },

  moveChat: (id, projectId) => {
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, projectId: projectId ?? undefined } : c)) }));
    const { userId } = get();
    if (userId) {
      const sb = createClient();
      if (sb) sb.from("chats").update({ project_id: projectId ?? null }).eq("id", id);
    } else {
      saveLocalChats(get().chats);
    }
  },

  updateChatEmbeddings: (updates) => {
    if (!updates.length) return;
    const byId = new Map(updates.map((u) => [u.id, u]));
    set((s) => ({
      chats: s.chats.map((c) => {
        const u = byId.get(c.id);
        return u ? { ...c, embedding: u.embedding, embeddingVersion: u.embeddingVersion } : c;
      }),
    }));
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

  updateLastContent: (content, opts) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content,
            ...(opts?.isError ? { isError: true } : {}),
          };
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
  setFusionModelsOnLast: (models) =>
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const messages = c.messages.slice();
        if (messages.length) {
          messages[messages.length - 1] = { ...messages[messages.length - 1], fusionModels: models };
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

  popLastMessage: () =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: c.messages.slice(0, -1) } : c,
      ),
    })),

  editMessageBranch: (index, content) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: applyEditBranch(c.messages, index, content) } : c,
      ),
    }));
    void get().persistCurrent();
  },

  updateMessageContentAt: (index, content) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId
          ? { ...c, messages: c.messages.map((m, i) => (i === index ? { ...m, content } : m)) }
          : c,
      ),
    }));
    void get().persistCurrent();
  },

  switchMessageVersion: (index, branchIndex) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: applySwitchBranch(c.messages, index, branchIndex) } : c,
      ),
    }));
    void get().persistCurrent();
  },

  mergeRegenerateBranches: (pendingBranches) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === s.currentId ? { ...c, messages: mergeRegeneratedBranches(c.messages, pendingBranches) } : c,
      ),
    }));
    void get().persistCurrent();
  },

  pickCompareResult: (index, resultIndex) => {
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== s.currentId) return c;
        const target = c.messages[index];
        const picked = target?.compareResults?.[resultIndex];
        if (!picked) return c;
        const messages = c.messages.map((m, i) =>
          i === index ? { ...m, content: picked.content, compareResults: undefined } : m,
        );
        return { ...c, messages };
      }),
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
        const seq = ++persistSeq;
        await sb.from("chats").upsert({
          id: chat.id,
          user_id: userId,
          title: chat.title,
          messages: chat.messages,
          project_id: chat.projectId ?? null,
          created_at: new Date(chat.created_at).toISOString(),
          updated_at: new Date().toISOString(),
        });
        /* Bu istek tamamlanana kadar arada başka bir persistCurrent daha
           başladıysa (sıra ilerlediyse), ağ gecikmesiyle bu eski çağrı DB'de
           son yazım olarak kalmış olabilir — o an bilinen en güncel durumu
           bir kez daha yazarak düzelt. */
        if (seq !== persistSeq) {
          const latest = get().current();
          if (latest && latest.id === chat.id) {
            await sb.from("chats").upsert({
              id: latest.id,
              user_id: userId,
              title: latest.title,
              messages: latest.messages,
              project_id: latest.projectId ?? null,
              created_at: new Date(latest.created_at).toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
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

  artifact: null,
  setArtifact: (a) => set({ artifact: a }),

  toasts: [],
  addToast: (message, type = "info", opts) => {
    const toast: Toast = { id: uid(), message, type, action: opts?.action, duration: opts?.duration };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => get().removeToast(toast.id), opts?.duration ?? 3500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  repo: null,
  tree: null,
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

  /* görev kuyruğu (Otonom Ajan) */
  backgroundJobs: loadJobs(),
  enqueueJob: (goal) => {
    const now = Date.now();
    const id = `job_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const job: BackgroundJob = { id, goal: goal.trim(), title: deriveJobTitle(goal), status: "queued", steps: [], createdAt: now, updatedAt: now };
    set((st) => { const jobs = [job, ...st.backgroundJobs].slice(0, 40); saveJobs(jobs); return { backgroundJobs: jobs }; });
    return id;
  },
  updateJob: (id, patch) =>
    set((st) => {
      const jobs = st.backgroundJobs.map((j) => (j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j));
      saveJobs(jobs);
      return { backgroundJobs: jobs };
    }),
  removeJob: (id) =>
    set((st) => { const jobs = st.backgroundJobs.filter((j) => j.id !== id); saveJobs(jobs); return { backgroundJobs: jobs }; }),
  clearFinishedJobs: () =>
    set((st) => {
      const jobs = st.backgroundJobs.filter((j) => j.status === "queued" || j.status === "running");
      saveJobs(jobs);
      return { backgroundJobs: jobs };
    }),

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
    get().saveConfig({
      ...config,
      mcpServers: (config.mcpServers ?? []).filter((s) => s.id !== id),
      deletedIds: markDeleted(config, id),
    });
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
    get().saveConfig({
      ...config,
      hooks: (config.hooks ?? []).filter((h) => h.id !== id),
      deletedIds: markDeleted(config, id),
    });
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
