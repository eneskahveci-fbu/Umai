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
  /** Web aramada kullanılan kaynaklar — yanıt altında "Kaynaklar" olarak listelenir. */
  sources?: { title: string; url: string }[];
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
  /** Kalite turu (fusion) bu yanıt için çalıştıysa kullanılan taslak
      modellerinin adları — mesaj üzerinde kalıcı bir rozet olarak gösterilir. */
  fusionModels?: string[];
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
  /** LLM/araç hatası nedeniyle üretilen bir yanıt — MessageBubble bunu
      normal metinden görsel olarak ayırır (kırmızı vurgu + belirgin
      tekrar-dene eylemi). */
  isError?: boolean;
}

export interface SwarmAgentState {
  title: string;
  role: string;
  status: "running" | "done" | "error";
  /** Ajanın kendi ürettiği ham sonuç — bitince dolar; "Ajan Ekibi" panelinde
      tıklayınca açılır (yalnız nihai birleşik cevabı değil, bu ajanın kendi
      katkısını da görebilmek için). */
  output?: string;
}
export interface SwarmState {
  phase: "planning" | "working" | "synthesizing" | "done";
  agents: SwarmAgentState[];
  /** Panel görünümü: "swarm" = Ajan Ekibi (varsayılan), "research" = Derin Araştırma. */
  kind?: "swarm" | "research";
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
  /** Mağaza kartından oluşturulduysa o katalog girdisinin id'si (mcpCatalog.ts)
      — kartın aç/kapat durumunu bu sunucuya güvenilir şekilde eşlemek için. */
  catalogId?: string;
  /** Bu sunucunun araçlarını hangi model profilleri (ModelProfile.id) görebilir.
      undefined veya boş dizi = TÜM modeller (varsayılan, önceki davranışla aynı). */
  allowedModelIds?: string[];
}

/** Olay kancası (Claude Code "hooks" benzeri): ajan bir turu bitirince otomatik
    bir kabuk komutu çalıştırır. `afterEdit` = ajan dosya düzenledikten sonra
    (çıktı ajana geri beslenir → lint/test/typecheck kendiliğinden düzeltilir);
    `onFinish` = ajan tamamen durduğunda (yalnız bildirim, geri besleme yok);
    `onError` = ajan/komut hata verdiğinde (yalnız bildirim, geri besleme yok). */
export interface Hook {
  id: string;
  /** İnsan-okur etiket (ör. "Lint düzelt"). Boşsa komut gösterilir. */
  label?: string;
  event: "afterEdit" | "onFinish" | "onError";
  command: string;
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
  /** "İlgili" (bkz. relatedItems.ts) — istemci taraflı önbelleklenmiş gömme
      vektörü + hesaplandığı andaki mesaj sayısı (bayatlığı algılamak için). */
  embedding?: number[];
  embeddingVersion?: number;
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
  | "openai"
  | "pollinations"
  | "github"
  | "nvidia"
  | "ovh"
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

/** Kullanıcının kendi tanımladığı yazı stili (yerleşik 5 stile ek). Aktifken
    talimatları sistem prompt'una eklenir. */
export interface CustomStyle {
  id: string;
  name: string;
  instructions: string;
}

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
  /** Claude Artifacts paritesi: görsel tasarım (html), vektör (svg), diyagram
      (mermaid), herhangi bir dilde kod (code) veya biçimlendirilmiş belge
      (markdown). */
  type: "html" | "svg" | "mermaid" | "code" | "markdown";
  content: string;
  title: string;
  /** "code" tipi için sözdizimi vurgulama dili (ör. "python", "go", "sql"). */
  language?: string;
}

export interface PromptTemplate {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

/** Stüdyo tasarım sistemi (marka sözleşmesi). Üretimde designMd promptuna,
    tokensCss üretilen tasarımın <head>'ine enjekte edilir. */
export interface DesignSystem {
  id: string;
  name: string;
  category: string;
  accent: string;
  designMd: string;
  tokensCss: string;
}

/** Stüdyo projesi — kaydedilen bir tasarım (üretilen artifact + meta). user_config
    ile senkronlanır. `versions`: aynı projenin son birkaç üretimi (geri dönüş için,
    hepsi `artifactType`/`artifactLanguage` türünde varsayılır — bir takip
    mesajında format değişirse (ör. html → code) DesignStudio.tsx sürüm
    zincirini SIFIRLAR, karışık-türlü geçmiş oluşmaz). */
export interface StudioProject {
  id: string;
  name: string;
  brief: string;
  html: string;
  artifactType?: Artifact["type"];
  /** "code" tipi sürümler için sözdizimi dili. */
  artifactLanguage?: string;
  designSystemId: string;
  skillId: string | null;
  directionId: string | null;
  versions?: string[];
  createdAt: number;
  updatedAt: number;
  /** Bağlı olduğu proje (bkz. Project — Claude Projects tarzı klasörleme).
      Tanımsız = hiçbir projeye bağlı değil. */
  projectId?: string;
}

/** Sunum Stüdyosu — slayt düzenleri (Google Slides'tan ilhamla, craft yorumu). */
export type SlideLayout = "cover" | "section" | "bullets" | "two-col" | "image" | "quote" | "end";

export interface Slide {
  id: string;
  layout: SlideLayout;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  /** Serbest gövde metni (two-col ikinci sütunu, quote sözü, image alt yazısı). */
  body?: string;
  /** Pollinations görseli için İngilizce sahne betimi (image/cover düzenleri). */
  imagePrompt?: string;
  /** Sabitlenmiş görsel URL'i — imagePrompt + deterministik seed'den üretilir. */
  imageUrl?: string;
  /** Konuşmacı notları: sunumda gizli, seslendirmede (TTS) okunur. */
  notes?: string;
}

/** Docs/Forms/Notebook/Slides stüdyolarının paylaştığı taban şekil
    (bkz. useStudioProject.ts — ortak kaydet/sil/liste mantığı bunun üzerine kurulu). */
export interface StudioProjectBase {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Bağlı olduğu proje (bkz. Project — Claude Projects tarzı klasörleme).
      Tanımsız = hiçbir projeye bağlı değil. */
  projectId?: string;
}

export interface SlideDeck extends StudioProjectBase {
  themeId: string;
  slides: Slide[];
  brief?: string;
}

/** Doküman Stüdyosu — Notion'dan ilhamla blok tabanlı doküman (craft yorumu). */
export type DocBlockType = "h1" | "h2" | "h3" | "p" | "bullet" | "todo" | "quote" | "code" | "divider" | "callout" | "image";

export interface DocBlock {
  id: string;
  type: DocBlockType;
  text: string;
  /** Yalnız todo blokları için. */
  checked?: boolean;
}

export interface CraftDoc extends StudioProjectBase {
  blocks: DocBlock[];
  brief?: string;
  /** "İlgili" (bkz. relatedItems.ts) — istemci taraflı önbelleklenmiş gömme
      vektörü + hesaplandığı andaki blok sayısı (bayatlığı algılamak için). */
  embedding?: number[];
  embeddingVersion?: number;
}

/** Anket Stüdyosu — Google Forms'tan ilhamla (craft yorumu). */
export type FormQuestionType = "short" | "long" | "choice" | "multi" | "rating" | "dropdown" | "date";

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  label: string;
  /** choice/multi/dropdown için seçenekler. */
  options?: string[];
  required?: boolean;
  /** Koşullu görünürlük: önceki bir choice/dropdown sorusu belirli bir
      değeri aldığında göster (Google Forms'un "bölüme atla"sının craft
      yorumu — sunucusuz HTML'de de çalışır). */
  showIf?: { questionId: string; equals: string };
}

export interface CraftForm extends StudioProjectBase {
  desc?: string;
  questions: FormQuestion[];
  brief?: string;
  /** "İlgili" (bkz. relatedItems.ts) — istemci taraflı önbelleklenmiş gömme
      vektörü + hesaplandığı andaki soru sayısı (bayatlığı algılamak için). */
  embedding?: number[];
  embeddingVersion?: number;
}

/** Defter — NotebookLM'den ilhamla kaynak-temelli çalışma alanı. */
export interface NotebookSource {
  id: string;
  name: string;
  text: string;
  url?: string;
  /** Sohbet bağlamına dahil mi. */
  enabled: boolean;
}

export interface CraftNotebook extends StudioProjectBase {
  sources: NotebookSource[];
  /** "İlgili" (bkz. relatedItems.ts) — istemci taraflı önbelleklenmiş gömme
      vektörü + hesaplandığı andaki kaynak sayısı (bayatlığı algılamak için). */
  embedding?: number[];
  embeddingVersion?: number;
}

/** Kartlar (Anki'den İLHAM): tek bilgi kartı — Leitner kutusu tabanlı
    aralıklı tekrar (box 0-4; bkz. lib/cards.ts gradeCard/dueCards). */
export interface FlashCard {
  id: string;
  front: string;
  back: string;
  /** Leitner kutusu: 0 (yeni/zor) … 4 (kalıcı). */
  box: number;
  /** Bir sonraki tekrar zamanı (epoch ms). */
  due: number;
}

export interface CraftDeck extends StudioProjectBase {
  cards: FlashCard[];
  brief?: string;
}

/** Vurgular (Readwise'dan İLHAM): sohbet yanıtlarından seçilip kaydedilen
    pasajlar — Kartlar stüdyosunda yeniden okunur ve karta dönüştürülür. */
export interface Highlight {
  id: string;
  text: string;
  /** Kaynağın kısa etiketi (ör. sohbet başlığı). */
  source: string;
  createdAt: number;
}

/** Kroki (mind-map) düğümü — özyinelemeli ağaç. */
export interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
}

/** Kroki: brief'ten AI ile üretilen / elle düzenlenen zihin haritası.
    Tek kök düğüm; dışa aktarma SVG/Markdown (bkz. lib/mindmap.ts). */
export interface CraftMap extends StudioProjectBase {
  root: MindNode;
  brief?: string;
}

/** Görüntü Stüdyosu'nda kaydedilen tek bir oturum — sohbet akışı (prompt +
    üretilen görsel URL'leri) tekrar açılabilir olsun diye. URL'ler
    deterministik (Pollinations seed'e bağlı) olduğundan görsel verisinin
    kendisi değil yalnızca URL'ler saklanır — hafif. */
export interface CraftImageSession {
  id: string;
  title: string;
  model: string;
  format: string;
  msgs: { id: string; role: "user" | "assistant"; text?: string; model?: string; items?: { id: string; url: string; w: number; h: number }[] }[];
  createdAt: number;
  updatedAt: number;
}

/** Sohbet, Stüdyo veya dönüştürücüden üretilen kalıcı medya kaydı. Görsel
    verisi yerine URL/metaveri tutulur; böylece tarayıcı deposu şişmez. */
export interface MediaAsset {
  id: string;
  title: string;
  url: string;
  prompt?: string;
  seed?: number;
  createdAt: number;
  projectId?: string;
  chatId?: string;
  source: "image-gen" | "upload" | "converter";
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
  /** Kullanıcının kendi yazı stilleri (yerleşiklere ek). */
  customStyles?: CustomStyle[];
  /** Aktif özel stilin id'si — doluysa yerleşik stil yerine bu uygulanır. */
  activeCustomStyleId?: string | null;
  memories: MemoryItem[];
  skills: Skill[];
  /** Kullanıcı tanımlı slash-ajanları — config'te saklanır (kalıcı + senkron +
      kişiye özel). Eskiden localStorage'daydı (kaybolma sorunu); migrate edilir. */
  userAgents?: import("./agents").Agent[];
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
  /** Öğrenme Modu: yanıtlar eğitsel olur — adım adım açıklama, kavram/jargon
      tanımı, "neden" gerekçesi, sırada öğrenilecekler. Yazılım öğrencileri için. */
  learningMode?: boolean;
  webSearch: boolean;
  /** Ajan Ekibi (swarm) ve alt-ajanlar otomatik EN GÜÇLÜ yapılandırılmış modeli
      kullansın → ajanlar en yetenekli modelle çalışır. Tanımsız = açık. */
  agentsUseStrongestModel?: boolean;
  cliMode: boolean;
  autoTerminal: boolean;
  /** Otomatik Ajan Ekibi: açıkça çok-parçalı/çok-adımlı ağır isteklerde swarm
      kendiliğinden devreye girer. Tanımsız = açık. */
  autoSwarm?: boolean;
  /** Otomatik Pilot: eforu, web aramayı, araştırmayı, kaliteyi ve ajan
      ekibini mesaja göre platform seçer (tanımsız = açık). */
  autoPilot?: boolean;
  /** Otonom Doğrula-Düzelt: ajan dosya yazınca arka plandaki terminalde otomatik
      lint/tip/derleme çalışır, hata varsa ajana beslenir → hata kalmayana kadar
      düzeltir (en çok 5 tur). Tanımsız = açık. */
  autoVerify?: boolean;
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
  accentColor: "pine" | "green" | "orange";
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
  /** Stüdyo: kaydedilen projeler (çok-proje çalışma alanı). */
  studioProjects?: StudioProject[];
  /** Doküman Stüdyosu: kaydedilen dokümanlar. */
  craftDocs?: CraftDoc[];
  /** Anket Stüdyosu: kaydedilen anketler. */
  craftForms?: CraftForm[];
  /** Defter: kaydedilen kaynak defterleri. */
  craftNotebooks?: CraftNotebook[];
  /** Kartlar: kaydedilen kart desteleri. */
  craftDecks?: CraftDeck[];
  /** Vurgular: sohbetlerden kaydedilen pasajlar (en yeni önce, sınırlı). */
  highlights?: Highlight[];
  /** Kroki: kaydedilen zihin haritaları. */
  craftMaps?: CraftMap[];
  /** Görüntü Stüdyosu: kaydedilen üretim oturumları. */
  craftImages?: CraftImageSession[];
  /** Kütüphane: sohbetten/stüdyodan üretilen görseller ve dosya sonuçları. */
  mediaAssets?: MediaAsset[];
  /** Seslendirme (TTS) için tercih edilen Pollinations sesi (varsayılan: nova). */
  ttsVoice?: string;
  mcpServers?: McpServer[];
  /** Yerel Mod: kullanıcının makinesindeki Local Bridge adresi (ör. http://localhost:4319).
      Doluysa ve localMode açıksa ajan GitHub/GitLab API yerine gerçek dosya
      sistemine + kabuğa erişir (bkz. local-bridge/). */
  localBridgeUrl?: string;
  /** Yerel Mod köprü erişim token'ı (Local Bridge başlatılırken belirlenen). */
  localBridgeToken?: string;
  /** Açıksa repo işlemleri Yerel Mod köprüsüne yönlendirilir. */
  localMode?: boolean;
  /** Olay kancaları: ajan turu bitince otomatik komut çalıştırır (bkz. Hook). */
  hooks?: Hook[];
  /** Tehlikeli komut kalkanı (varsayılan açık): açıkken ajanın run_command'i
      katastrofik kalıplara (rm -rf /, fork bomb, mkfs, curl|sh…) karşı engellenir
      ve sonuç ajana geri bildirilir. false ⇒ kapalı. */
  commandGuard?: boolean;
  /** Fusion taslak modeli seçimi: "auto" (varsayılan) craft en uygun 1-3 modeli
      kendisi seçer; "manual" kullanıcının `fusionModelIds`'te seçtiği modelleri
      kullanır (herhangi bir kullanıcı seçebilir — admin şartı yok). */
  fusionMode?: "auto" | "manual";
  /** Manuel Fusion modunda taslak üretecek `models` id'leri (en fazla 3). */
  fusionModelIds?: string[];
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

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  /** Opsiyonel eylem butonu (ör. silmede "Geri al"). */
  action?: { label: string; fn: () => void };
  /** Özel görünme süresi (ms). */
  duration?: number;
}
