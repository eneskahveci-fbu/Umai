import { rateLimit } from "@/lib/rate-limit";
import { resolveModelAccess } from "@/lib/plan";
import { isProRequest } from "@/lib/serverPlan";
import { anthropicUpstream, type OpenAIChatBody } from "@/lib/anthropic";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";
import { PLATFORM_KNOWLEDGE, PLATFORM_KNOWLEDGE_BRIEF, needsPlatformKnowledge } from "@/lib/platform-knowledge";
import { buildContextSections } from "@/lib/prompt";
import { runReadOnlyAgent } from "@/lib/subagent";
import { filterByGlob } from "@/lib/glob";
import { ipynbToReadable, isNotebook } from "@/lib/notebook";
import { pruneMessages } from "@/lib/contextWindow";
import { detectFrameworks, extractDeps, parseGitignore } from "@/lib/projectContext";
import { ASK_USER_TOOL, CODER_TOOLS, GENERATE_IMAGE_TOOL, RUN_CODE_TOOL } from "@/lib/tools";
import { EXTENSION_TOOLS } from "@/lib/extensions/registry";
import { searchWeb, formatResults, fetchUrl } from "@/lib/webSearch";
import { pollinationsImageUrl, stableSeed } from "@/lib/pollinations";
import { runDeepResearch } from "@/lib/researchPipeline";
import { cached, repoCacheKey } from "@/lib/repoContextCache";
import { isSafeRemoteUrl } from "@/lib/urlSafety";
import { markProviderDown, markProviderUp, prioritizeHealthyCandidates } from "@/lib/providerHealth";
import { detectModelCapabilities, JSON_MODE_PROVIDERS, EFFORT_TOKENS, THINKING_BUDGET } from "@/lib/modelCapabilities";
import { downgradeRequest, isOpenAiReasoningModel, adaptForOpenAiReasoning } from "@/lib/requestDowngrade";
import { buildIdentityPrompt } from "@/lib/modelIdentity";
import { isBuiltinMcpServerId } from "@/lib/mcpBuiltins";
import { buildBridgeSyncCommand, isLikelyLongRunning } from "@/lib/bridgeRepo";
import { redactSecrets } from "@/lib/pii";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import type { ChatMessage, MemoryItem, Provider, ResponseStyle, SwarmAgentState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Vercel: yanıt döndükten sonra da (after) devam eder — sekme kapansa bile
   yanıt sunucuda tamamlanır ve kalıcı hâle gelir (bkz. aşağıda `after()`). */
export const maxDuration = 300;

interface RepoCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab" | "local";
  /** Yerel Mod: kullanıcının makinesindeki Local Bridge adresi/token'ı.
      provider === "local" iken dosya işlemleri GitHub/GitLab API yerine
      bu köprüye (gerçek dosya sistemi + shell) gider. */
  bridgeUrl?: string;
  bridgeToken?: string;
  /** Köprü kökü ALTINDA projenin bulunduğu alt klasör (ör. "craft-coder").
      Köprünün çalışma kökü çoğu kurulumda birden çok projeyi barındıran bir
      üst klasördür (ör. /opt/craft-bridge/workspace) ve KENDİSİ bir git
      deposu değildir. Bu alan boşken ajan tüm kökü tarıyor, alâkasız
      projelerin dosyalarını "bağlı depo" sanıyor ve `git remote -v` gibi
      komutlar kökte anlamsız sonuç veriyordu. Doluysa tüm köprü dosya
      yolları bu klasörle öneklenir, dönen yollardan önek soyulur — yani ajan
      YALNIZ bağlı deponun içini görür. */
  bridgeDir?: string;
  /** Bağlı deponun KENDİ sağlayıcısı/token'ı (GitHub/GitLab) — köprü modunda
      dahi taşınır. Doluysa, ensureBridgeRepo() bu bilgiyle depoyu köprünün
      diskine (bridgeDir altına) klonlar/günceller: böylece "GitLab'a token ile
      bağlandım ama köprü de açık" durumunda iki sistem birbirini SESSİZCE
      görmezden gelmez — köprü, bağlı deponun GERÇEK bir kopyasını tutar. */
  gitSource?: { provider: "github" | "gitlab"; token?: string };
}

/* Köprü yollarını proje alt klasörüne hapseden yardımcılar. Tek yerde
   uygulanır (bridgeCall) ki her çağrı yeri ayrı ayrı doğru yapmak zorunda
   kalmasın. */
function bridgeScope(ctx: RepoCtx): string {
  return (ctx.bridgeDir || "").replace(/^\/+|\/+$/g, "");
}
function scopedPath(dir: string, p: unknown): string {
  const rel = String(p ?? "").replace(/^\/+/, "");
  return dir ? `${dir}/${rel}` : rel;
}
/** Dönen mutlak-köke-göreli yollardan proje önekini soyar; proje dışındakileri
    tamamen eler (ajan onları hiç görmemeli). */
function unscopePaths(dir: string, paths: unknown): string[] {
  const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string") : [];
  if (!dir) return list;
  const pre = `${dir}/`;
  return list.filter((p) => p.startsWith(pre)).map((p) => p.slice(pre.length));
}

/* Yerel Mod köprüsüne JSON çağrısı (gerçek FS/shell, kullanıcının makinesinde). */
async function bridgeCall(ctx: RepoCtx, endpoint: string, payload?: unknown): Promise<Record<string, unknown>> {
  const base = (ctx.bridgeUrl || "").replace(/\/$/, "");
  /* SSRF: köprü adresi istemciden gelir; canlıda (Vercel) yalnız genel adres
     kabul et — iç ağ/loopback/bulut-metadata (169.254.169.254) engellenir.
     Yerelde (npm run dev) localhost köprüsü meşrudur → yalnız production'da kısıtla. */
  if (process.env.NODE_ENV === "production" && !isSafeRemoteUrl(base)) {
    throw new Error("Güvensiz köprü adresi — yalnızca genel (public) HTTPS adresleri kabul edilir.");
  }
  /* Proje alt klasörü varsa: giden yolları önekle, dönen yolları soy.
     Köprünün /fs/list, /fs/glob, /fs/grep uçları HER ZAMAN kökten yürür ve
     köke göreli yol döner; alt klasör parametresi kabul etmezler. Bu yüzden
     kapsama, desen/filtre alanları üzerinden uygulanır. */
  const dir = bridgeScope(ctx);
  const body: Record<string, unknown> = { ...(payload as Record<string, unknown> ?? {}) };
  if (dir) {
    if (endpoint === "/fs/read" || endpoint === "/fs/write" || endpoint === "/fs/delete") {
      body.path = scopedPath(dir, body.path);
    } else if (endpoint === "/fs/rename") {
      body.path = scopedPath(dir, body.path);
      body.newPath = scopedPath(dir, body.newPath);
    } else if (endpoint === "/fs/glob") {
      body.pattern = scopedPath(dir, body.pattern ?? "**");
    } else if (endpoint === "/fs/grep") {
      body.glob = scopedPath(dir, body.glob ?? "**");
    } else if (endpoint === "/fs/list") {
      /* `filter` alt-dize eşleşmesidir; kaba bir ön eleme yapar, kesin
         ayıklama aşağıda dönen yollar üzerinde yapılır. */
      body.filter = body.filter ? `${dir}/${String(body.filter)}` : `${dir}/`;
    }
  }

  const res = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.bridgeToken || ""}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Yerel köprü hatası ${res.status} — köprü çalışıyor mu? (node local-bridge/server.js)`);
  const data = await res.json() as Record<string, unknown>;

  if (dir) {
    if (Array.isArray(data.paths)) data.paths = unscopePaths(dir, data.paths);
    if (Array.isArray(data.matches)) {
      /* grep satırları "yol:satır: metin" biçiminde döner — baştaki proje
         önekini soy, proje dışı eşleşmeleri at. */
      const pre = `${dir}/`;
      data.matches = (data.matches as unknown[])
        .filter((m): m is string => typeof m === "string" && m.startsWith(pre))
        .map((m) => m.slice(pre.length));
    }
  }
  return data;
}

/* ensureBridgeRepo başarılı senkron zamanlarını tutar → aynı depo/köprü için
   her mesajda yeniden klonlama/fetch yapılmaz (gereksiz gecikme + Oracle'a
   yük). Vercel serverless fonksiyonları arasında paylaşılmaz (her instance
   kendi belleğinde tutar) — en kötü ihtimalle soğuk başlangıçta bir kez daha
   senkron yapılır, zararsız. */
const bridgeSyncCache = new Map<string, number>();
const BRIDGE_SYNC_TTL_MS = 60_000;

/** Bağlı depoyu (ctx.gitSource ile) köprünün diskinde (ctx.bridgeDir altında)
   GERÇEKTEN var olacak şekilde klonlar/günceller. Yalnızca gitSource + bridgeDir
   ikisi de doluyken çalışır — biri eksikse (genel köprü kullanımı, repo'suz)
   sessizce atlanır. Hata durumunda TURU ÇÖKERTMEZ: agent en azından ne olduğunu
   bilsin diye çağıran taraf notu sistem prompt'una ekler. */
async function ensureBridgeRepo(ctx: RepoCtx): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = bridgeScope(ctx);
  if (!ctx.gitSource || !dir || !ctx.bridgeUrl) return { ok: true };
  const cacheKey = `${ctx.bridgeUrl}::${dir}::${ctx.branch}`;
  const lastSync = bridgeSyncCache.get(cacheKey);
  if (lastSync && Date.now() - lastSync < BRIDGE_SYNC_TTL_MS) return { ok: true };
  try {
    const command = buildBridgeSyncCommand({
      source: ctx.gitSource, owner: ctx.owner, repo: ctx.repo, branch: ctx.branch, dir,
    });
    /* Doğrudan bridgeCall'ı DEĞİL, ROOT'a göre çalışan çıplak /exec'i kullan —
       bridgeCall'ın /fs/* yol-önekleme mantığı /exec'e uygulanmaz (komut zaten
       kendi içinde `dir`i taşıyor) ve klon henüz yokken `dir` altında
       çalıştırmaya kalkışmak (cwd) klonlamayı imkânsız kılardı. */
    const res = await fetch(`${ctx.bridgeUrl!.replace(/\/$/, "")}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.bridgeToken || ""}` },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return { ok: false, error: `Köprü senkron hatası ${res.status}` };
    const data = await res.json() as { output?: string; exitCode?: number; error?: string };
    if (data.error) return { ok: false, error: data.error };
    if (typeof data.exitCode === "number" && data.exitCode !== 0) {
      return { ok: false, error: (data.output || "").slice(-500) || `exit ${data.exitCode}` };
    }
    bridgeSyncCache.set(cacheKey, Date.now());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const BRIDGE_EXEC_POLL_MS = 1_200;

/** Komutu köprüde SUNUCUDAN DOĞRUDAN çalıştırır — tarayıcıya/telefona hiç
   gerek kalmadan. Eskiden run_command bir SSE olayıyla istemciye yollanıyor,
   istemcinin (RealTerminal) WebSocket üzerinden Oracle'a iletip sonucu YENİ
   bir /api/chat isteğiyle geri getirmesi bekleniyordu — telefon arka plana
   düşünce (kilitlenince/uygulama değiştirilince) bu zincir kopuyordu, tam da
   "arka planda çalışmaya devam etmiyor" şikâyetinin sebebiydi. Artık köprüde
   gerçek bir /exec ucu varsa komut ORADAN, bu HTTP isteği üzerinden çalışır;
   telefonun durumu sonucu etkilemez.

   Her zaman ARKA PLANDA başlatılır (background:true) ve kısa aralıklarla
   yoklanır — bu, hem kısa komutların (git status vb.) sonucunu hızlıca
   döndürür HEM DE bir geliştirme sunucusu gibi bitmeyen komutların turu
   sonsuza dek kilitlemesini önler: yoklama süresi dolunca "hâlâ çalışıyor"
   notuyla devam edilir, komutun kendisi köprüde çalışmaya DEVAM EDER. */
async function execCommandViaBridge(
  ctx: RepoCtx,
  command: string,
): Promise<{ output: string; done: boolean; exitCode: number | null; taskId: string }> {
  const base = ctx.bridgeUrl!.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${ctx.bridgeToken || ""}` };
  const dir = bridgeScope(ctx);

  const startRes = await fetch(`${base}/exec`, {
    method: "POST",
    headers,
    body: JSON.stringify({ command, cwd: dir || undefined, background: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!startRes.ok) throw new Error(`Köprü /exec hatası ${startRes.status}`);
  const startData = await startRes.json() as { taskId?: string; error?: string };
  if (startData.error) throw new Error(startData.error);
  const taskId = startData.taskId;
  if (!taskId) throw new Error("Köprü görev kimliği döndürmedi.");

  /* Kalıcı çalışan komutlar (dev sunucusu vb.) için az bekle — nasıl olsa
     bitmeyecek; hemen "arka planda başladı" bildirimine geç. */
  const maxPolls = isLikelyLongRunning(command) ? 3 : 15;
  let lastOutput = "";
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, BRIDGE_EXEC_POLL_MS));
    const statusRes = await fetch(`${base}/exec/status?id=${encodeURIComponent(taskId)}`, {
      headers, signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!statusRes || !statusRes.ok) continue;
    const rec = await statusRes.json() as { status: string; output?: string; exitCode?: number | null };
    lastOutput = rec.output || "";
    if (rec.status !== "running") return { output: lastOutput, done: true, exitCode: rec.exitCode ?? null, taskId };
  }
  return { output: lastOutput, done: false, exitCode: null, taskId };
}

/** Arka plandaki komudun O ANKİ durumunu/çıktısını okur (check_command). */
async function checkCommandViaBridge(
  ctx: RepoCtx,
  taskId: string,
): Promise<{ status: string; output: string; exitCode: number | null }> {
  const base = ctx.bridgeUrl!.replace(/\/$/, "");
  const res = await fetch(`${base}/exec/status?id=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${ctx.bridgeToken || ""}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) throw new Error("Görev bulunamadı (kimlik yanlış ya da sunucu yeniden başlamış olabilir).");
  if (!res.ok) throw new Error(`Köprü /exec/status hatası ${res.status}`);
  const rec = await res.json() as { status?: string; output?: string; exitCode?: number | null };
  return { status: rec.status || "unknown", output: rec.output || "", exitCode: rec.exitCode ?? null };
}

/** Arka plandaki komudu durdurur (stop_command). Köprü bu ucu bilmiyorsa
    (eski sürüm — kullanıcı sunucusunu henüz güncellememiş olabilir) bunu
    ANLAŞILIR biçimde söyler; sessizce "başarılı" demez. */
async function stopCommandViaBridge(ctx: RepoCtx, taskId: string): Promise<string> {
  const base = ctx.bridgeUrl!.replace(/\/$/, "");
  const res = await fetch(`${base}/exec/kill`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.bridgeToken || ""}` },
    body: JSON.stringify({ id: taskId }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) {
    return "Bu köprü sürümü komut durdurmayı desteklemiyor (sunucudaki bridge.mjs güncellenmeli). Komut çalışmaya devam ediyor.";
  }
  if (!res.ok) return `Hata: köprü /exec/kill ${res.status}`;
  const data = await res.json() as { ok?: boolean; error?: string; alreadyStopped?: boolean; status?: string };
  if (data.error) return `Hata: ${data.error}`;
  if (data.alreadyStopped) return `Komut zaten çalışmıyordu (durum: ${data.status ?? "bilinmiyor"}).`;
  return "✅ Komut durduruldu.";
}

interface SkillPayload {
  title: string;
  content: string;
  tags?: string[];
  source?: "manual" | "file";
  fileName?: string;
}

interface McpServerConfig {
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

interface ChatRequest {
  messages: (ChatMessage | { role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string })[];
  /** Bu sohbetin id'si — verilirse ve kullanıcı girişliyse, sekme yanıt bitmeden
      kapanırsa (bkz. `after()` bloğu) sunucu nihai yanıtı doğrudan `chats`
      tablosuna yazar + push bildirimi gönderir. Yoksa davranış birebir eskisi
      gibi (yalnız istemci taraflı kalıcılık). */
  chatId?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
  /** İstemci SADECE geçerli JSON bekliyor (ör. çok-slaytlı sunum motoru) —
      destekleyen sağlayıcılarda native "JSON modu" istenir (bkz. openCandidate),
      böylece geçersiz/yarım JSON riski prompt talimatına değil sağlayıcının
      kendi garantisine dayanır. Desteklemeyen sağlayıcılarda sessizce yok
      sayılır (yalnız prompt talimatına güvenilir, davranış eskisi gibi). */
  jsonMode?: boolean;
  style?: ResponseStyle;
  memories?: MemoryItem[];
  skills?: SkillPayload[];
  searchContext?: string;
  projectPrompt?: string;
  tools?: boolean;
  webSearch?: boolean;
  /** Faz 6 — yalnız generate_image: repo bağlı olmasa/Tools kapalı olsa bile
      bu TEK aracı tool-loop'a ekler (bkz. autoPilot.ts'teki autoImageGen). */
  imageGen?: boolean;
  /** İstemcinin (Ayarlar → Model → Görsel üretimi tercihine göre, bkz.
      imageGen.ts pickImageProvider) ÖNCEDEN çözdüğü BYOK görsel sağlayıcısı +
      anahtarı. Verilmezse (ya da üretim başarısız olursa) generate_image
      anahtarsız Pollinations tabanına düşer — "istek asla düşmez" sözleşmesi. */
  imageModel?: { provider: string; apiKey: string; model?: string };
  /** İstemcinin kurduğu TAM görsel yedek zinciri (en iyiden en kötüye; bkz.
      imageGen.ts buildImageFallbackChain + Ayarlar → Görsel üretimi → "Yedek
      zinciri"). Verilirse sırayla denenir; verilmezse `imageModel` tek aday
      olarak kullanılır (eski davranış). */
  imageModels?: { provider: string; apiKey: string; model?: string }[];
  requireWriteApproval?: boolean;
  safeMode?: boolean;
  toolPermissions?: Record<string, boolean>;
  planApprovalMode?: boolean;
  planApproved?: boolean;
  blockNetworkTools?: boolean;
  /** İstemcide terminal (uzak WS veya WebContainer) mevcutsa true → run_command
      aracı ajana sunulur. Aksi halde araç gizlenir (çıktısız komut = takılma). */
  terminalAvailable?: boolean;
  /** L1 — istemcide kod çalıştırıcı (Pyodide/Web Worker) kullanılabilirse true
      → run_code ("analiz aracı") ajana sunulur. Tarayıcıdan gelen her istek
      bunu true yollar; tarayıcı dışı çağrılarda (test/entegrasyon) araç
      gizlenir, çünkü çıktıyı geri besleyecek bir istemci yoktur. */
  codeExec?: boolean;
  repoCtx?: RepoCtx;
  mcpServers?: McpServerConfig[];
  /** Çok-sağlayıcılı otomatik fallback: birincil model hata verirse sırayla
      bu adaylar denenir. İstemci ücretsiz/güvenilir sağlayıcılardan kurar. */
  fallbacks?: { provider?: Provider; baseUrl?: string; model?: string; apiKey?: string }[];
  /** Kesin model modu (Ayarlar → Model → Kesin model). true ise HİÇBİR yedek
      denenmez: `fallbacks` yok sayılır (savunma amaçlı — istemci zaten boş
      gönderir, bkz. fallback.ts buildChainFor) ve anahtarsız istekte
      "free-fallback" (sessiz Pollinations geçişi) yerine net bir hata döner. */
  strictModel?: boolean;
}

/** Tek bir LLM ucu (birincil veya fallback). */
interface Candidate {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const KEYLESS_CHAT_PROVIDERS = new Set<string>(["pollinations", "ovh", "ollama", "local", "custom"]);

/* JSON_MODE_PROVIDERS artık @/lib/modelCapabilities'ten geliyor (I1) — Ayarlar'daki
   yetenek rozetleriyle (SettingsModal.tsx) AYNI kaynak, iki yer asla sapmaz.
   Bilinçli hariç tutma gerekçesi (anahtarsız/ücretsiz toplayıcılar 400 riski)
   orada belgeleniyor. */

/** Sağlayıcıya göre upstream istek başlıklarını kurar. */
function buildCandidateHeaders(c: Candidate, req: Request): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (c.provider === "anthropic") {
    h["anthropic-version"] = "2023-06-01";
    if (c.apiKey) h["x-api-key"] = c.apiKey;
  } else if (c.apiKey) {
    h["Authorization"] = `Bearer ${c.apiKey}`;
  }
  if (c.provider === "openrouter") {
    h["HTTP-Referer"] = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://umai.vercel.app";
    h["X-Title"] = "UMAI";
  }
  return h;
}

/* P3 — sağlayıcı sağlığı yalnız SAĞLAYICI kaynaklı hatalarda işaretlenmeli.
   Eskiden her !ok yanıtta markProviderDown çağrılıyordu; 400 (bizim gönderdiğimiz
   alan), 401 (kullanıcının anahtarı) ve 404 (model adı) İSTEK hatalarıdır —
   sağlayıcı gayet ayakta. Bunlarda "down" işaretlemek sağlıklı bir sağlayıcıyı
   sonraki isteklerde geri plana atıyor ve gereksiz model değişimlerini
   çoğaltıyordu. Yalnız 5xx/429 ve bağlantı hataları gerçek sağlık sinyalidir. */
function isProviderFault(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

/** Bir adayın yanıt BAŞLIKLARINI göndermesi için tanınan süre (bkz. openCandidate). */
const CONNECT_TIMEOUT_MS = 20_000;

/** Yetenek hatası mı? 400/422 = "bu isteği bu biçimde yapamam" (kota/erişim
    değil). openCandidate bunları zaten 2 kademe uyumluluk düşürmesiyle
    kurtarmayı denedi; hâlâ 400 ise sorun ULAŞILABİLİRLİK değil YETENEKTİR. */
function isCapabilityFault(status: number): boolean {
  return status === 400 || status === 422;
}

/** Model KONFİGÜRASYON hatası mı? 404 = "bu model adı yok/yanlış yazılmış",
    410 = "bu model kullanımdan kaldırıldı" (canlı NVIDIA testiyle doğrulandı:
    bir hesap sağlayıcısı bir modeli emekliye ayırınca TAM OLARAK bu durum
    kodunu döndürüyor). İkisi de geçici bir arıza DEĞİL — sağlayıcı hesabı
    gayet ayakta, yalnızca o model kimliği artık çözülmüyor. isProviderFault
    (5xx/429/408 — "şu an meşgul, azıcık sonra çalışır") ile KARIŞTIRILMAMALI:
    burada beklemek/tekrar denemek durumu DÜZELTMEZ, kullanıcının model
    listesini güncellemesi gerekir. */
function isModelGoneFault(status: number): boolean {
  return status === 404 || status === 410;
}

/** Aday için chat/completions URL'i (Pollinations anahtarı varsa query-param token). */
function candidateUrl(c: Candidate): string {
  return c.provider === "pollinations" && c.apiKey
    ? `${c.baseUrl}/chat/completions?token=${encodeURIComponent(c.apiKey)}`
    : `${c.baseUrl}/chat/completions`;
}


function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

/* ── Tool execution ── */

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function glHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["PRIVATE-TOKEN"] = token;
  return h;
}

function encodeGlProject(owner: string, repo: string) {
  return encodeURIComponent(`${owner}/${repo}`);
}

/* GitLab ağaç uç noktası GitHub'ın `recursive=1`'i gibi TEK yanıtta her şeyi
   dönmez — sayfa başına en çok 100 kayıt verir ve gerisini `x-next-page`
   başlığıyla bildirir. Sayfalama yapılmadığı için ajan, GitLab'a bağlı
   depolarda yalnız İLK 100 dosyayı görüyordu: list_files/glob/grep/repo
   haritası sessizce kırpılıyor, model var olan dosyaları "yok" sanıyordu
   (aynı hata GitHub'da görünmez, çünkü orada tek çağrı yeter).
   İstemcideki fetchGitLabRepoTree zaten sayfalıyordu — bu yüzden dosya ağacı
   ARAYÜZDE eksiksiz görünürken ajan aynı depoyu eksik görüyordu.
   MAX_PAGES, lib/gitlab.ts'teki sınırla aynı tutulur (10 × 100 = 10.000 yol). */
const GL_TREE_MAX_PAGES = 10;
async function getAllGitLabPaths(ctx: RepoCtx): Promise<string[]> {
  const proj = encodeGlProject(ctx.owner, ctx.repo);
  const paths: string[] = [];
  let page = 1;
  while (page <= GL_TREE_MAX_PAGES) {
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&ref=${encodeURIComponent(ctx.branch)}&per_page=100&page=${page}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
    const data = await res.json() as { path: string; type: string }[];
    if (!Array.isArray(data) || data.length === 0) break;
    for (const t of data) if (t.type === "blob") paths.push(t.path);
    const nextPage = res.headers.get("x-next-page");
    if (!nextPage) break;
    const parsed = parseInt(nextPage, 10);
    if (!Number.isFinite(parsed) || parsed <= page) break;
    page = parsed;
  }
  return paths;
}

/* Repo'daki tüm dosya yollarını döndürür (glob/grep/list_files ortak kullanır). */
async function getAllPaths(ctx: RepoCtx): Promise<string[]> {
  if (ctx.provider === "local") {
    const data = await bridgeCall(ctx, "/fs/list", {});
    return Array.isArray(data.paths) ? data.paths as string[] : [];
  }
  if (ctx.provider === "gitlab") return await getAllGitLabPaths(ctx);
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${encodeURIComponent(ctx.branch)}?recursive=1`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
  const data = await res.json() as { tree?: { path: string; type: string }[] };
  return (data.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
}

/* Repo dosya haritası: gürültüyü (node_modules/dist/binary) ayıklar, kaynak
   dosyaları öne alır, ~120 yolla sınırlar → büyük projelerde ajan yapıyı kompakt
   görür, list_files'a gerek kalmadan doğru dosyayı hedefler.
   Önceden CAP=250'ydi (~3.250 token) — her mesajda (repo bağlıyken) sabit bir
   ön-yük olarak gönderiliyordu; kullanıcı geri bildirimi üzerine (Tem 2026)
   yarıya indirildi. 250'yi aşan repolarda zaten glob/grep'e düşülüyordu, bu
   sınırın altında da aynı yol çalışır — yalnız gecikme/token maliyeti azalır. */
const REPO_MAP_NOISE = /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|vendor|out|\.turbo|__pycache__)\//;
const REPO_MAP_BINARY = /\.(png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|mp[34]|wav|pdf|zip|gz|tgz|map|lock)$|\.min\.(js|css)$/i;
const REPO_MAP_SRC = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|c|cc|cpp|h|hpp|cs|swift|kt|vue|svelte|sql|sh|css|scss|less|html|json|md|ya?ml|toml|prisma)$/i;
function buildRepoMap(paths: string[]): string {
  const clean = paths.filter((p) => !REPO_MAP_NOISE.test(p) && !REPO_MAP_BINARY.test(p));
  const src = clean.filter((p) => REPO_MAP_SRC.test(p)).sort();
  const rest = clean.filter((p) => !REPO_MAP_SRC.test(p)).sort();
  const ordered = [...src, ...rest];
  const CAP = 120;
  const shown = ordered.slice(0, CAP).join("\n");
  return ordered.length > CAP
    ? `${shown}\n[+${ordered.length - CAP} dosya daha — glob/grep ile bul]`
    : shown;
}

async function execListFiles(ctx: RepoCtx, args: { filter?: string }): Promise<string> {
  let items: string[];
  try { items = await getAllPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
  const filter = args.filter?.toLowerCase();
  if (filter) items = items.filter((p) => p.toLowerCase().includes(filter));
  if (items.length > 200) {
    return items.slice(0, 200).join("\n") + `\n\n[${items.length - 200} dosya daha gizlendi — filtre kullan]`;
  }
  return items.join("\n") || "(eşleşen dosya yok)";
}

/* glob: '**' dahil yıldızlı desenle dosya bul. */
async function execGlob(ctx: RepoCtx, args: { pattern: string }): Promise<string> {
  if (!args.pattern) return "Hata: pattern zorunlu";
  let items: string[];
  try { items = await getAllPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
  const matched = filterByGlob(items, args.pattern);
  if (matched.length === 0) return "(eşleşen dosya yok)";
  if (matched.length > 200) return matched.slice(0, 200).join("\n") + `\n\n[${matched.length - 200} daha]`;
  return matched.join("\n");
}

/* grep: regex ile dosya içeriklerinde ara → dosya:satır eşleşmeleri. */
async function execGrep(ctx: RepoCtx, args: { pattern: string; glob?: string; ignore_case?: boolean | string }, cache?: Map<string, string>): Promise<string> {
  if (!args.pattern) return "Hata: pattern zorunlu";
  let re: RegExp;
  try { re = new RegExp(args.pattern, (args.ignore_case === true || args.ignore_case === "true") ? "i" : ""); }
  catch (e) { return `Hata: geçersiz regex: ${(e as Error).message}`; }
  let paths: string[];
  try { paths = await getAllPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
  if (args.glob) paths = filterByGlob(paths, args.glob);
  const MAX_FILES = 300;
  const capped = paths.slice(0, MAX_FILES);
  const out: string[] = [];
  let matches = 0;
  /* Dosyaları 10'lu gruplarla EŞZAMANLI çek (Promise.all) → büyük repoda hız ve
     isabet artar. 100 eşleşmeye ulaşınca dur. */
  const BATCH = 10;
  for (let b = 0; b < capped.length && matches < 100; b += BATCH) {
    const batch = capped.slice(b, b + BATCH);
    const results = await Promise.all(
      batch.map((p) => getFileRaw(ctx, p, cache).then((r) => ({ p, r }))),
    );
    for (const { p, r } of results) {
      if (!r.ok) continue;
      const lines = r.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          out.push(`${p}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
          if (++matches >= 100) break;
        }
      }
      if (matches >= 100) break;
    }
  }
  let res = out.join("\n") || "(eşleşme yok)";
  if (paths.length > MAX_FILES) res += `\n\n[Not: ${paths.length} dosyadan ilk ${MAX_FILES}'i tarandı — 'glob' ile daralt]`;
  return res;
}

/* read_files: birden çok dosyayı tek çağrıda, satır numaralı oku. */
async function execReadFiles(ctx: RepoCtx, args: { paths: string[] | string }, cache?: Map<string, string>): Promise<string> {
  let paths: string[] = Array.isArray(args.paths)
    ? args.paths
    : typeof args.paths === "string" ? args.paths.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [];
  if (paths.length === 0) return "Hata: paths zorunlu (dizi veya virgülle ayrılmış yollar)";
  paths = paths.slice(0, 10);
  const parts: string[] = [];
  for (const p of paths) {
    const r = await getFileRaw(ctx, p, cache);
    if (!r.ok) { parts.push(`### ${p}\n${r.error}`); continue; }
    const numbered = r.content.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n").slice(0, 8000);
    parts.push(`### ${p}\n${numbered}`);
  }
  return parts.join("\n\n");
}

/* Bir dosyanın TAM ham içeriğini getirir (kırpma yok). read_file ve str_replace
   ortak kullanır. İstek başına `cache` ile aynı dosya iki kez çekilmez. */
async function getFileRaw(
  ctx: RepoCtx,
  path: string,
  cache?: Map<string, string>,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  if (cache?.has(path)) return { ok: true, content: cache.get(path)! };
  if (ctx.provider === "local") {
    try {
      const data = await bridgeCall(ctx, "/fs/read", { path });
      if (typeof data.error === "string") return { ok: false, error: `Hata: ${data.error} (${path})` };
      const text = typeof data.content === "string" ? data.content : "";
      cache?.set(path, text);
      return { ok: true, content: text };
    } catch (e) { return { ok: false, error: `Hata: ${(e as Error).message}` }; }
  }
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const encoded = encodeURIComponent(path);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return { ok: false, error: `Hata: ${res.status} — dosya bulunamadı (${path})` };
    const text = await res.text();
    cache?.set(path, text);
    return { ok: true, content: text };
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(path)}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return { ok: false, error: `Hata: ${res.status} — dosya bulunamadı (${path})` };
  const data = await res.json();
  /* GitHub contents API bir DİZİN için dizi, hata için `{message}` döner — ikisinde
     de `data.content` yok. `Buffer.from(undefined,...)` TypeError fırlatır; bu
     fonksiyon checkpoint ön-okumasında (write_file/str_replace) try/catch DIŞINDA
     çağrıldığından fırlatma tüm stream'i çökertiyordu. Dosya-obje olduğunu doğrula. */
  if (Array.isArray(data) || typeof data?.content !== "string") {
    return { ok: false, error: `Hata: '${path}' bir dosya değil (dizin veya erişilemez).` };
  }
  if (typeof data.size === "number" && data.size > 100_000) return { ok: false, error: `Hata: dosya çok büyük (${data.size} bayt). 100KB üstü desteklenmiyor.` };
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  cache?.set(path, content);
  return { ok: true, content };
}

/* read_file: içeriği SATIR NUMARALARIYLA döner (Claude Code gibi) — modelin
   düzenlemede satıra atıfta bulunmasını ve isabetini artırır. */
async function execReadFile(ctx: RepoCtx, args: { path: string }, cache?: Map<string, string>): Promise<string> {
  if (!args.path) return "Hata: path boş";
  const r = await getFileRaw(ctx, args.path, cache);
  if (!r.ok) return r.error;
  /* .ipynb → hücre-bazlı okunur biçim (markdown + kod + çıktı). */
  if (isNotebook(args.path)) {
    const readable = ipynbToReadable(r.content);
    return readable.length > 20_000
      ? readable.slice(0, 20_000) + "\n\n[... kısaltıldı]"
      : readable;
  }
  const lines = r.content.split("\n");
  const numbered = lines.map((l, i) => `${i + 1}\t${l}`).join("\n");
  if (numbered.length > 20_000) {
    return numbered.slice(0, 20_000) + "\n\n[... kısaltıldı — belirli bir bölgeyi görmek için search_code kullan]";
  }
  return numbered;
}

/* str_replace yardımcıları: model old_string'i biraz hatalı kopyalasa bile
   düzenleme tutar (boşluk-duyarsız) ya da net yön gösterir → ajan tek seferde
   doğru düzenler (her modelde güvenilirlik). */
function findWhitespaceTolerant(content: string, target: string): string | null {
  const cLines = content.split("\n");
  const tLines = target.split("\n");
  if (tLines.length === 0) return null;
  const tNorm = tLines.map((l) => l.trim());
  let found: string | null = null;
  for (let i = 0; i + tLines.length <= cLines.length; i++) {
    let ok = true;
    for (let j = 0; j < tLines.length; j++) {
      if (cLines[i + j].trim() !== tNorm[j]) { ok = false; break; }
    }
    if (ok) {
      if (found) return null; // benzersiz değil → güvenli değil, dokunma
      found = cLines.slice(i, i + tLines.length).join("\n");
    }
  }
  return found;
}

function closestContext(content: string, target: string): string {
  const firstLine = target.split("\n").map((l) => l.trim()).find((l) => l.length > 3);
  if (!firstLine) return "";
  const cLines = content.split("\n");
  const idx = cLines.findIndex((l) => { const t = l.trim(); return !!t && (t.includes(firstLine) || firstLine.includes(t)); });
  if (idx < 0) return "";
  const from = Math.max(0, idx - 4);
  const to = Math.min(cLines.length, idx + 5);
  const snippet = cLines.slice(from, to).join("\n");
  return `\n\nDosyadaki en yakın bölge (satır ${from + 1}-${to}) — bunu birebir kopyalayıp tekrar dene:\n\`\`\`\n${snippet}\n\`\`\``;
}

/* str_replace: hedefli düzenleme. old_string birebir + benzersiz eşleşmeli. */
async function execStrReplace(
  ctx: RepoCtx,
  args: { path: string; old_string: string; new_string: string; commit_message?: string; replace_all?: boolean | string },
  cache?: Map<string, string>,
  writeBuffer?: Map<string, WriteEntry>,
): Promise<string> {
  if (!args.path || args.old_string == null || args.new_string == null) {
    return "Hata: path, old_string ve new_string zorunlu";
  }
  if (args.old_string === args.new_string) return "Hata: old_string ve new_string aynı — değişiklik yok";
  const r = await getFileRaw(ctx, args.path, cache);
  if (!r.ok) return r.error;
  const content = r.content;
  const replaceAll = args.replace_all === true || args.replace_all === "true";

  /* Tolerans: model read_file'dan gelen "42<TAB>kod" satır numarası önekini
     yanlışlıkla old_string'e kopyarsa, önekleri soyup tekrar dene. */
  let oldStr = args.old_string;
  if (content.split(oldStr).length - 1 === 0) {
    const stripped = oldStr.split("\n").map((l) => l.replace(/^\s*\d+\t/, "")).join("\n");
    if (stripped !== oldStr && content.split(stripped).length - 1 >= 1) oldStr = stripped;
  }
  /* Tolerans 2: hâlâ eşleşme yoksa satır-bazlı BOŞLUK-DUYARSIZ benzersiz eşleşme
     dene (girinti/sondaki boşluk farkı) → dosyadaki GERÇEK metni hedef al. */
  if (content.split(oldStr).length - 1 === 0) {
    const ws = findWhitespaceTolerant(content, oldStr);
    if (ws) oldStr = ws;
  }

  const occurrences = content.split(oldStr).length - 1;
  if (occurrences === 0) {
    return `Hata: old_string '${args.path}' içinde bulunamadı. Önce read_file ile mevcut metni kontrol et (satır numarası ve baştaki '<sayı><TAB>' olmadan, birebir kopyala).${closestContext(content, oldStr)}`;
  }
  if (occurrences > 1 && !replaceAll) {
    return `Hata: old_string ${occurrences} kez eşleşti. Benzersiz olması için daha fazla bağlam ekle ya da replace_all:true kullan.`;
  }
  let updated: string;
  if (replaceAll) {
    updated = content.split(oldStr).join(args.new_string);
  } else {
    const idx = content.indexOf(oldStr);
    updated = content.slice(0, idx) + args.new_string + content.slice(idx + oldStr.length);
  }
  const msg = args.commit_message || `chore: update ${args.path}`;
  const writeRes = await execWriteFile(ctx, { path: args.path, content: updated, commit_message: msg }, cache, writeBuffer);
  if (writeRes.startsWith("Hata")) return writeRes;
  cache?.set(args.path, updated); // önbelleği güncel tut
  return `✅ ${args.path}: ${replaceAll ? occurrences + " eşleşme" : "1 eşleşme"} değiştirildi. ${writeRes}`;
}

/* create_pr: head → base PR (GitHub) / MR (GitLab) açar. */
async function execCreatePR(ctx: RepoCtx, args: { title: string; head: string; base: string; body?: string }): Promise<string> {
  if (!args.title || !args.head || !args.base) return "Hata: title, head ve base zorunlu";
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/merge_requests`, {
      method: "POST",
      headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ source_branch: args.head, target_branch: args.base, title: args.title, description: args.body || "" }),
    });
    if (!res.ok) return `Hata: ${res.status} — ${(await res.text().catch(() => "")).slice(0, 200)}`;
    const d = await res.json() as { web_url?: string; iid?: number };
    return `✅ MR !${d.iid} oluşturuldu: ${d.web_url}`;
  }
  const res = await fetch(`https://api.github.com/repos/${ctx.owner}/${ctx.repo}/pulls`, {
    method: "POST",
    headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
    body: JSON.stringify({ title: args.title, body: args.body || "", head: args.head, base: args.base }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { message?: string };
    return `Hata: ${res.status} — ${e.message || ""}`;
  }
  const d = await res.json() as { html_url?: string; number?: number };
  return `✅ PR #${d.number} oluşturuldu: ${d.html_url}`;
}

async function execSearchFiles(ctx: RepoCtx, args: { query: string }): Promise<string> {
  if (!args.query) return "Hata: query boş";
  if (ctx.provider === "local") {
    let items: string[];
    try { items = await getAllPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
    const q = args.query.toLowerCase();
    const matches = items.filter((p) => p.toLowerCase().includes(q)).slice(0, 50);
    return matches.length ? matches.join("\n") : "(eşleşme yok)";
  }
  if (ctx.provider === "gitlab") {
    /* getAllGitLabPaths üzerinden: buradaki tek sayfalık çekim de ilk 100
       dosyayla sınırlıydı, yani ajan "dosya yok" sanıyordu (bkz. getAllPaths). */
    let items: string[];
    try { items = await getAllGitLabPaths(ctx); } catch (e) { return `Hata: ${(e as Error).message}`; }
    const q = args.query.toLowerCase();
    const matches = items.filter((p) => p.toLowerCase().includes(q)).slice(0, 50);
    return matches.length ? matches.join("\n") : "(eşleşme yok)";
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${encodeURIComponent(ctx.branch)}?recursive=1`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json();
  /* Cast, `{message:"..."}` (rate-limit/404) gibi hatalı gövdelerde `.filter`'ı
     undefined üzerinde çağırıp fırlatıyordu; dizi olduğunu doğrula. */
  if (!Array.isArray(data?.tree)) return `Hata: beklenmeyen yanıt (ağaç alınamadı).`;
  const q = args.query.toLowerCase();
  const matches = (data.tree as { path: string; type: string }[])
    .filter((t) => t.type === "blob" && t.path.toLowerCase().includes(q))
    .map((t) => t.path)
    .slice(0, 50);
  return matches.length ? matches.join("\n") : "(eşleşme yok)";
}

async function execSearchCode(ctx: RepoCtx, args: { query: string; extension?: string }): Promise<string> {
  if (!args.query) return "Hata: query boş";
  if (ctx.provider === "local") {
    try {
      const glob = args.extension ? `**/*.${args.extension}` : undefined;
      const data = await bridgeCall(ctx, "/fs/grep", { pattern: args.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), glob });
      if (typeof data.error === "string") return `Hata: ${data.error}`;
      const matches = Array.isArray(data.matches) ? data.matches as string[] : [];
      return matches.length ? matches.slice(0, 30).join("\n") : "(eşleşme yok)";
    } catch (e) { return `Hata: ${(e as Error).message}`; }
  }
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const q = encodeURIComponent(args.query);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/search?scope=blobs&search=${q}&ref=${encodeURIComponent(ctx.branch)}&per_page=20`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json() as { filename: string; path: string; data: string; startline: number }[];
    if (!data.length) return "(eşleşme yok)";
    return data
      .filter((r) => !args.extension || r.path.endsWith(`.${args.extension}`))
      .slice(0, 15)
      .map((r) => `${r.path}:${r.startline}\n  ${r.data.trim().slice(0, 120)}`)
      .join("\n\n");
  }
  const q = encodeURIComponent(`${args.query} repo:${ctx.owner}/${ctx.repo}${args.extension ? ` extension:${args.extension}` : ""}`);
  const res = await fetch(`https://api.github.com/search/code?q=${q}&per_page=15`, {
    headers: { ...ghHeaders(ctx.token), Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
  const data = await res.json() as { items?: { path: string; html_url: string }[] };
  if (!data.items?.length) return "(eşleşme yok)";
  return data.items.map((r) => r.path).join("\n");
}

type WriteEntry = { content: string; isNew: boolean };

/* Bir turun tüm dosya yazımlarını tek Git commit olarak kaydeder.
   GitLab: /api/v4/projects/{id}/repository/commits (actions array)
   GitHub: blob + tree + commit + ref-update (atomic tree API) */
async function flushAtomicCommit(
  ctx: RepoCtx,
  writes: Map<string, WriteEntry>,
  commitMessage: string,
): Promise<string> {
  if (writes.size === 0) return "Değişiklik yok";

  if (ctx.provider === "local") {
    /* Yerel diskte "commit" yok — her dosya doğrudan yazılır. */
    let okCount = 0;
    for (const [path, { content }] of writes.entries()) {
      try {
        const data = await bridgeCall(ctx, "/fs/write", { path, content });
        if (typeof data.error !== "string") okCount++;
      } catch { /* tek dosya hatası diğerlerini durdurmasın */ }
    }
    return okCount === writes.size
      ? `✅ ${okCount} dosya yerel diske yazıldı`
      : `⚠️ ${okCount}/${writes.size} dosya yazıldı (bazıları başarısız)`;
  }

  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const actions = [...writes.entries()].map(([path, { content, isNew }]) => ({
      action: isNew ? "create" : "update",
      file_path: path,
      content: Buffer.from(content, "utf-8").toString("base64"),
      encoding: "base64",
    }));
    const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/commits`, {
      method: "POST",
      headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ branch: ctx.branch, commit_message: commitMessage, actions }),
    });
    if (!res.ok) return `Hata: ${res.status} — ${(await res.text().catch(() => "")).slice(0, 200)}`;
    const d = await res.json() as { short_id?: string };
    return `✅ ${writes.size} dosya tek commit'te kaydedildi (${d.short_id ?? "?"})`;
  }

  /* GitHub: tree API — atomik */
  const refRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/ref/heads/${encodeURIComponent(ctx.branch)}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!refRes.ok) return `Hata: branch ref alınamadı (${refRes.status})`;
  const baseSha = ((await refRes.json()) as { object?: { sha: string } }).object?.sha;
  if (!baseSha) return "Hata: branch SHA alınamadı";

  /* Create blobs for each file */
  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const [path, { content }] of writes.entries()) {
    const blobRes = await fetch(
      `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/blobs`,
      {
        method: "POST",
        headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
        body: JSON.stringify({ content: Buffer.from(content, "utf-8").toString("base64"), encoding: "base64" }),
      },
    );
    if (!blobRes.ok) return `Hata: blob oluşturulamadı (${path}, ${blobRes.status})`;
    const { sha } = await blobRes.json() as { sha: string };
    treeItems.push({ path, mode: "100644", type: "blob", sha });
  }

  /* Create tree */
  const treeRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees`,
    {
      method: "POST",
      headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
    },
  );
  if (!treeRes.ok) return `Hata: tree oluşturulamadı (${treeRes.status})`;
  const { sha: treeSha } = await treeRes.json() as { sha: string };

  /* Create commit */
  const commitRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/commits`,
    {
      method: "POST",
      headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ message: commitMessage, tree: treeSha, parents: [baseSha] }),
    },
  );
  if (!commitRes.ok) return `Hata: commit oluşturulamadı (${commitRes.status})`;
  const { sha: commitSha } = await commitRes.json() as { sha: string };

  /* Update ref */
  const updateRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/refs/heads/${encodeURIComponent(ctx.branch)}`,
    {
      method: "PATCH",
      headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitSha }),
    },
  );
  if (!updateRes.ok) return `Hata: ref güncellenemedi (${updateRes.status})`;
  return `✅ ${writes.size} dosya tek commit'te kaydedildi (${commitSha.slice(0, 7)})`;
}

async function execWriteFile(
  ctx: RepoCtx,
  args: { path: string; content: string; commit_message: string },
  cache?: Map<string, string>,
  writeBuffer?: Map<string, WriteEntry>,
): Promise<string> {
  if (!args.path || !args.content) return "Hata: path ve content zorunlu";
  const msg = args.commit_message || `chore: update ${args.path}`;

  /* Toplu commit modu: dosyayı buffer'a ekle, cache'i güncelle, commit yapma. */
  if (writeBuffer) {
    const isNew = !cache?.has(args.path);
    cache?.set(args.path, args.content);
    writeBuffer.set(args.path, { content: args.content, isNew });
    return `✅ ${args.path} ${isNew ? "oluşturuldu" : "güncellendi"} (toplu commit bekleniyor)`;
  }

  if (ctx.provider === "local") {
    const data = await bridgeCall(ctx, "/fs/write", { path: args.path, content: args.content });
    if (typeof data.error === "string") return `Hata: ${data.error}`;
    return `✅ ${args.path} başarıyla ${data.created ? "oluşturuldu" : "güncellendi"} (yerel disk)`;
  }

  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const encoded = encodeURIComponent(args.path);
    /* check if file exists */
    const check = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    const method = check.ok ? "PUT" : "POST";
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}`,
      {
        method,
        headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
        body: JSON.stringify({ branch: ctx.branch, content: args.content, commit_message: msg, encoding: "text" }),
      },
    );
    if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
    return `✅ ${args.path} başarıyla ${method === "PUT" ? "güncellendi" : "oluşturuldu"} (branch: ${ctx.branch})`;
  }
  /* GitHub: get existing SHA for update */
  const checkRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(args.path)}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  const sha = checkRes.ok ? ((await checkRes.json()) as { sha?: string }).sha : undefined;
  const content64 = Buffer.from(args.content, "utf-8").toString("base64");
  const body: Record<string, unknown> = { message: msg, content: content64, branch: ctx.branch };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(args.path)}`,
    { method: "PUT", headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
  return `✅ ${args.path} başarıyla ${sha ? "güncellendi" : "oluşturuldu"} (branch: ${ctx.branch})`;
}

async function execListBranches(ctx: RepoCtx): Promise<string> {
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/branches?per_page=30`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json() as { name: string; default?: boolean }[];
    return data.map((b) => `${b.name}${b.default ? " (varsayılan)" : ""}`).join("\n");
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/branches?per_page=30`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json() as { name: string }[];
  return data.map((b) => b.name).join("\n");
}

async function execCreateBranch(ctx: RepoCtx, args: { name: string; from?: string }): Promise<string> {
  const sourceBranch = args.from || ctx.branch;
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/branches`, {
      method: "POST",
      headers: { ...glHeaders(ctx.token), "Content-Type": "application/json" },
      body: JSON.stringify({ branch: args.name, ref: sourceBranch }),
    });
    if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
    return `✅ Dal oluşturuldu: ${args.name} (kaynak: ${sourceBranch})`;
  }
  /* GitHub: get source SHA */
  const refRes = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/ref/heads/${encodeURIComponent(sourceBranch)}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!refRes.ok) return `Hata: kaynak dal bulunamadı (${sourceBranch})`;
  const refData = await refRes.json() as { object?: { sha: string } };
  const sha = refData.object?.sha;
  if (!sha) return "Hata: kaynak dal SHA alınamadı";
  const res = await fetch(`https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/refs`, {
    method: "POST",
    headers: { ...ghHeaders(ctx.token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${args.name}`, sha }),
  });
  if (!res.ok) return `Hata: ${res.status} — ${await res.text().catch(() => "")}`;
  return `✅ Dal oluşturuldu: ${args.name} (kaynak: ${sourceBranch})`;
}

async function execGetCommitHistory(ctx: RepoCtx, args: { limit?: string; path?: string }): Promise<string> {
  const limit = Math.min(30, parseInt(args.limit ?? "10", 10) || 10);
  if (ctx.provider === "gitlab") {
    const proj = encodeGlProject(ctx.owner, ctx.repo);
    const pathQ = args.path ? `&path=${encodeURIComponent(args.path)}` : "";
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/commits?ref_name=${encodeURIComponent(ctx.branch)}&per_page=${limit}${pathQ}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json() as { short_id: string; title: string; author_name: string; created_at: string }[];
    return data.map((c) => `${c.short_id} ${c.created_at.slice(0, 10)} [${c.author_name}] ${c.title}`).join("\n");
  }
  const pathQ = args.path ? `&path=${encodeURIComponent(args.path)}` : "";
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/commits?sha=${ctx.branch}&per_page=${limit}${pathQ}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json() as { sha: string; commit: { message: string; author: { name: string; date: string } } }[];
  return data.map((c) => `${c.sha.slice(0, 7)} ${c.commit.author.date.slice(0, 10)} [${c.commit.author.name}] ${c.commit.message.split("\n")[0]}`).join("\n");
}

/* SOUL.md / .craft.md — OpenClaw-inspired project context file */
async function fetchSoulFile(ctx: RepoCtx): Promise<string | null> {
  const candidates = ["SOUL.md", ".craft.md", ".craftai.md", "AGENTS.md"];
  for (const candidate of candidates) {
    try {
      if (ctx.provider === "local") {
        const r = await getFileRaw(ctx, candidate);
        if (r.ok && r.content.trim()) return r.content;
        continue;
      }
      if (ctx.provider === "gitlab") {
        const proj = encodeGlProject(ctx.owner, ctx.repo);
        const encoded = encodeURIComponent(candidate);
        const res = await fetch(
          `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encoded}/raw?ref=${encodeURIComponent(ctx.branch)}`,
          { headers: glHeaders(ctx.token) },
        );
        if (res.ok) return await res.text();
      } else {
        const res = await fetch(
          `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${candidate}?ref=${ctx.branch}`,
          { headers: ghHeaders(ctx.token) },
        );
        if (res.ok) {
          const data = await res.json() as { content: string };
          return Buffer.from(data.content, "base64").toString("utf-8");
        }
      }
    } catch { /* devam et */ }
  }
  return null;
}

/* Yerleşik (self-hosted) MCP sunucuları — AYNI dağıtımın kendi /api/mcp/builtin/*
   route'una işaret eder, dış host'a asla erişemez (SSRF riski yok) — bu yüzden
   isSafeRemoteUrl'in localhost/private-IP engelinden muaf tutulur. Muafiyet
   yalnızca URL GERÇEKTEN bu isteğin kendi origin'iyle + bilinen bir builtin
   id'siyle eşleşiyorsa uygulanır (yoksa dışarıdan taklit edilip güvenlik
   kontrolü atlatılabilir). */
function isSafeMcpServerUrl(url: string, ownOrigin: string): boolean {
  const builtinPrefix = `${ownOrigin}/api/mcp/builtin/`;
  if (url.startsWith(builtinPrefix) && isBuiltinMcpServerId(url.slice(builtinPrefix.length))) return true;
  return isSafeRemoteUrl(url);
}

async function fetchMcpTools(server: McpServerConfig, ownOrigin: string): Promise<{ name: string; description: string; parameters: object }[]> {
  if (!server.url || !isSafeMcpServerUrl(server.url, ownOrigin)) return [];
  try {
    const res = await fetch(`${server.url}/tools/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(server.headers ?? {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { result?: { tools?: { name: string; description: string; inputSchema?: object }[] } };
    return (data?.result?.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema ?? { type: "object", properties: {}, required: [] },
    }));
  } catch { return []; }
}

async function callMcpTool(server: McpServerConfig, toolName: string, args: Record<string, unknown>, ownOrigin: string): Promise<string> {
  if (!server.url || !isSafeMcpServerUrl(server.url, ownOrigin)) return "Error: güvenli olmayan MCP sunucu adresi.";
  try {
    const res = await fetch(`${server.url}/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(server.headers ?? {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: args } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return `MCP hata: ${res.status}`;
    const data = await res.json() as { result?: { content?: { type: string; text?: string }[] } };
    return (data?.result?.content ?? []).filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n") || "Sonuç yok";
  } catch (e) { return `MCP hata: ${(e as Error).message}`; }
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: RepoCtx,
  mcpServers?: McpServerConfig[],
  cache?: Map<string, string>,
  writeBuffer?: Map<string, WriteEntry>,
  ownOrigin?: string,
): Promise<string> {
  try {
    if (!ctx && ["list_files","read_file","read_files","glob","grep","search_files","search_code","write_file","str_replace","list_branches","create_branch","create_pr","get_commit_history","git_diff","git_log","git_blame","discover_rules","trigger_ci"].includes(name))
      return "Hata: repo bağlı değil. Kullanıcıya bir repo bağlamasını söyle.";
    /* Yerel Mod: git-tabanlı araçlar API yerine gerçek git ister → run_command'a yönlendir. */
    if (ctx?.provider === "local" && ["list_branches","create_branch","create_pr","get_commit_history","git_diff","git_log","git_blame","trigger_ci"].includes(name))
      return "Yerel modda bu git işlemi doğrudan desteklenmiyor. Gerçek git için run_command kullan (ör. run_command('git log --oneline -10'), run_command('git checkout -b yeni-dal'), run_command('git diff')).";
    if (name === "list_files") return await execListFiles(ctx!, args as { filter?: string });
    if (name === "glob") return await execGlob(ctx!, args as { pattern: string });
    if (name === "grep") return await execGrep(ctx!, args as { pattern: string; glob?: string; ignore_case?: boolean | string }, cache);
    if (name === "read_files") return await execReadFiles(ctx!, args as { paths: string[] | string }, cache);
    if (name === "read_file") return await execReadFile(ctx!, args as { path: string }, cache);
    if (name === "search_files") return await execSearchFiles(ctx!, args as { query: string });
    if (name === "search_code") return await execSearchCode(ctx!, args as { query: string; extension?: string });
    if (name === "str_replace") return await execStrReplace(ctx!, args as { path: string; old_string: string; new_string: string; commit_message?: string; replace_all?: boolean | string }, cache, writeBuffer);
    if (name === "write_file") {
      const res = await execWriteFile(ctx!, args as { path: string; content: string; commit_message: string }, cache, writeBuffer);
      if (!res.startsWith("Hata") && typeof args.path === "string" && typeof args.content === "string" && !writeBuffer) {
        cache?.set(args.path, args.content); // önbelleği güncel tut (buffer yoksa)
      }
      return res;
    }
    if (name === "list_branches") return await execListBranches(ctx!);
    if (name === "create_branch") return await execCreateBranch(ctx!, args as { name: string; from?: string });
    if (name === "create_pr") return await execCreatePR(ctx!, args as { title: string; head: string; base: string; body?: string });
    if (name === "get_commit_history") return await execGetCommitHistory(ctx!, args as { limit?: string; path?: string });
    /* ── Extension araçları (DeepSeek): git diff/log/blame, kural keşfi, CI ── */
    if (name === "git_diff") {
      const base = String(args.base ?? ""); const head = String(args.head ?? "");
      if (!base || !head) return "Hata: base ve head zorunlu.";
      try {
        if (ctx!.provider === "gitlab") {
          const proj = encodeGlProject(ctx!.owner, ctx!.repo);
          const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`, { headers: glHeaders(ctx!.token) });
          if (!res.ok) return `Hata: ${res.status}`;
          const data = await res.json() as { diffs?: { old_path: string; new_path: string; diff: string }[] };
          return (data.diffs ?? []).map((d) => `--- ${d.old_path}\n+++ ${d.new_path}\n${d.diff}`).join("\n").slice(0, 8000) || "Fark yok.";
        }
        const res = await fetch(`https://api.github.com/repos/${ctx!.owner}/${ctx!.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, { headers: { ...ghHeaders(ctx!.token), Accept: "application/vnd.github.diff" } });
        if (!res.ok) return `Hata: ${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`;
        return (await res.text()).slice(0, 8000) || "Fark yok.";
      } catch (e) { return `Hata: ${(e as Error).message}`; }
    }
    if (name === "git_log" || name === "git_blame") {
      const branch = String(args.branch ?? ctx!.branch);
      const path = args.path ? String(args.path) : "";
      const limit = Math.min(30, Math.max(1, Number(args.limit) || 10));
      const blameNote = name === "git_blame" ? "[Basitleştirilmiş blame: dosyayı etkileyen son commit'ler]\n" : "";
      try {
        if (ctx!.provider === "gitlab") {
          const proj = encodeGlProject(ctx!.owner, ctx!.repo);
          const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=${limit}${path ? `&path=${encodeURIComponent(path)}` : ""}`, { headers: glHeaders(ctx!.token) });
          if (!res.ok) return `Hata: ${res.status}`;
          const data = await res.json() as { short_id: string; title: string; author_name: string; created_at: string }[];
          return blameNote + (data.map((c) => `${c.short_id} ${c.created_at.slice(0, 10)} ${c.author_name}: ${c.title}`).join("\n") || "Commit yok.");
        }
        const res = await fetch(`https://api.github.com/repos/${ctx!.owner}/${ctx!.repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${limit}${path ? `&path=${encodeURIComponent(path)}` : ""}`, { headers: ghHeaders(ctx!.token) });
        if (!res.ok) return `Hata: ${res.status}`;
        const data = await res.json() as { sha: string; commit: { message: string; author: { name: string; date: string } } }[];
        return blameNote + (data.map((c) => `${c.sha.slice(0, 7)} ${c.commit.author.date.slice(0, 10)} ${c.commit.author.name}: ${c.commit.message.split("\n")[0]}`).join("\n") || "Commit yok.");
      } catch (e) { return `Hata: ${(e as Error).message}`; }
    }
    if (name === "discover_rules") {
      const candidates = ["CLAUDE.md", "AGENTS.md", ".rules", ".cursorrules", ".craft.md", ".craftai.md", "SOUL.md", ".github/copilot-instructions.md"];
      const out: string[] = [];
      for (const f of candidates) {
        const r = await getFileRaw(ctx!, f, cache);
        if (r.ok && r.content.trim()) out.push(`### ${f}\n${r.content.slice(0, 3000)}`);
      }
      return out.length ? out.join("\n\n") : "Davranış kuralı dosyası bulunamadı (CLAUDE.md, AGENTS.md, .rules, .cursorrules vb.).";
    }
    if (name === "trigger_ci") {
      const workflow = String(args.workflow ?? "");
      const ref = String(args.ref ?? ctx!.branch);
      if (!workflow) return "Hata: workflow zorunlu.";
      if (ctx!.provider === "gitlab") return "GitLab CI tetikleme için ayrı bir trigger token gerekir (şu an desteklenmiyor).";
      try {
        const res = await fetch(`https://api.github.com/repos/${ctx!.owner}/${ctx!.repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
          method: "POST",
          headers: { ...ghHeaders(ctx!.token), "Content-Type": "application/json" },
          body: JSON.stringify({ ref, ...(args.inputs && typeof args.inputs === "object" ? { inputs: args.inputs } : {}) }),
        });
        if (res.status === 204) return `✅ Workflow '${workflow}' tetiklendi (ref: ${ref}).`;
        return `Hata: ${res.status} ${(await res.text().catch(() => "")).slice(0, 150)}`;
      } catch (e) { return `Hata: ${(e as Error).message}`; }
    }
    if (name === "web_search") {
      const query = String(args.query ?? "");
      if (!query.trim()) return "Arama sorgusu boş.";
      return formatResults(await searchWeb(query));
    }
    if (name === "read_url") {
      return await fetchUrl(String(args.url ?? ""));
    }
    /* Try MCP servers for unknown tools */
    for (const srv of (mcpServers ?? [])) {
      /* enabled === undefined ise araç LİSTELEMEDE sunuluyor (filtre
         `s.enabled !== false`), dolayısıyla çalıştırmada da sunulmalı — aksi
         halde araç modele gösterilip her çağrıda "Bilinmeyen araç" dönüyordu.
         İki predicate'i eşitle: yalnız açıkça false olanı atla. */
      if (srv.enabled === false) continue;
      const result = await callMcpTool(srv, name, args, ownOrigin ?? "");
      if (!result.startsWith("MCP hata:")) return result;
    }
    return `Bilinmeyen araç: ${name}`;
  } catch (e) {
    return `Hata: ${(e as Error).message}`;
  }
}

/* ── Stream parser helpers ── */

interface AccumulatedToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

interface RoundResult {
  content: string;
  toolCalls: AccumulatedToolCall[];
  finishReason: string | null;
  /** Sağlayıcının bildirdiği GERÇEK token kullanımı (varsa). */
  usage: { prompt: number; completion: number } | null;
}

async function streamRound(
  upstream: Response,
  controller: { enqueue: (chunk: Uint8Array) => void },
  encoder: TextEncoder,
): Promise<RoundResult> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls: AccumulatedToolCall[] = [];
  let finishReason: string | null = null;
  let usage: { prompt: number; completion: number } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          content += delta.content;
          /* forward content deltas */
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`),
          );
        }
        /* Reasoning/düşünme token'larını da ilet (DeepSeek-R1: reasoning_content,
           OpenRouter/o-serisi: reasoning). İstemci bunu "Düşünce süreci"
           panelinde gösterir. */
        const reasoningDelta: string | undefined = delta?.reasoning ?? delta?.reasoning_content;
        if (reasoningDelta) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning: reasoningDelta } }] })}\n\n`),
          );
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let acc = toolCalls.find((c) => c.index === idx);
            if (!acc) {
              acc = { index: idx, id: tc.id || `call_${idx}`, name: "", arguments: "" };
              toolCalls.push(acc);
            }
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        /* OpenAI-uyumlu akışta usage son chunk'ta gelir (stream_options.include_usage).
           Anthropic stili: message_delta.usage. İkisini de yakala. */
        if (json.usage) {
          const p = Number(json.usage.prompt_tokens ?? json.usage.input_tokens ?? 0);
          const c = Number(json.usage.completion_tokens ?? json.usage.output_tokens ?? 0);
          if (p || c) usage = { prompt: p, completion: c };
        }
      } catch {
        /* parçalı satır */
      }
    }
  }
  return { content, toolCalls, finishReason, usage };
}

function friendlyApiError(status: number, rawDetail: string, ctx?: { model?: string; provider?: string }): string {
  const tag = ctx?.model || ctx?.provider ? ` [${ctx.provider ?? ""}${ctx.provider && ctx.model ? " / " : ""}${ctx.model ?? ""}]` : "";
  let providerMsg = "";
  try {
    const json = JSON.parse(rawDetail);
    /* Bazı sağlayıcılar message'ı string değil obje/dizi döndürür — string'e
       zorla; yoksa aşağıdaki .toLowerCase() hata yakalama yolunu çökertir. */
    const cand = json?.error?.message ?? json?.message ?? (typeof json?.error === "string" ? json.error : "");
    providerMsg = typeof cand === "string" ? cand : JSON.stringify(cand ?? "");
  } catch { /* raw text */ }
  const low = providerMsg.toLowerCase();

  if (low.includes("insufficient balance") || low.includes("quota") || low.includes("resource exhausted") || status === 402)
    return `💳 Yetersiz bakiye${tag}: Sağlayıcı hesabına kredi yükle veya ödeme yöntemini ekle.`;
  if (low.includes("invalid api key") || low.includes("unauthorized") || low.includes("authentication") || low.includes("permission denied") || status === 401)
    return `🔑 API anahtarı geçersiz${tag}: Ayarlar → Modeller'den anahtarı kontrol et. Anahtarın doğru sağlayıcıya ait olduğundan emin ol.`;
  if (low.includes("rate limit") || low.includes("too many") || status === 429)
    return `⏱️ İstek limiti aşıldı${tag}: 30-60 saniye bekle ve tekrar dene.`;
  if (status === 410 || (low.includes("model") && (low.includes("not found") || low.includes("does not exist") || low.includes("decommissioned") || low.includes("unknown") || low.includes("end of life") || low.includes("no longer available")))) {
    /* status===410 KOŞULSUZ eklendi: sağlayıcının tam metnini beklemek
       kırılgan (ör. NVIDIA'nın "has reached its end of life... no longer
       available" ifadesi yukarıdaki anahtar kelimelerin hiçbirini tam
       eşleştirmiyordu — canlı testte görüldü). HTTP 410 Gone zaten kendi
       başına "bu kaynak kalıcı olarak kaldırıldı" demek — sağlayıcı hangi
       kelimeyi kullanırsa kullansın anlam aynı. */
    return `🚫 Model artık mevcut değil${tag}: Bu model kaldırılmış/kullanımdan çıkarılmış olabilir. Ayarlar → Model'den bu modeli güncelle ya da kaldır.`;
  }
  if (status === 404) {
    return `🚫 Model bulunamadı${tag}: Model adı yanlış yazılmış olabilir. Ayarlar → Model'den kontrol et.`;
  }
  if (status === 400) {
    const hint = providerMsg ? `\n\nDetay: ${providerMsg.slice(0, 200)}` : "";
    return `⚠️ Geçersiz istek (${status})${tag}: Model adı, baseUrl veya sağlayıcı yanlış olabilir.${hint}`;
  }
  if (status === 403) {
    const raw = rawDetail.toLowerCase();
    if (raw.includes("host") && raw.includes("allow"))
      return `🌍 Sağlayıcı bu sunucudan istek kabul etmiyor${tag}: Bu, yerel IP/proxy engelidir; canlı deployment'tan (Vercel) çalışır.`;
    if (raw.includes("api key") || raw.includes("auth") || low.includes("api key") || low.includes("auth"))
      return `🔑 API anahtarı geçersiz${tag}: Anahtarın doğru ve aktif olduğunu kontrol et.`;
    return `🚷 Erişim reddedildi${tag}: Anahtar geçersiz veya modele erişim izni yok (bazı modeller plan/onay gerektirir).`;
  }
  if (status >= 500)
    return `🛠️ Sağlayıcı sunucu hatası (${status})${tag}: Kısa süre sonra tekrar dene.`;
  if (providerMsg) return `Sağlayıcı hatası (${status})${tag}: ${providerMsg.slice(0, 300)}`;
  return `Sağlayıcı hatası (${status})${tag}: ${rawDetail.slice(0, 200)}`;
}

export async function POST(req: Request) {
  const __rl = rateLimit(req, "chat", 60, 60_000);
  if (__rl) return __rl;
  if (!checkOrigin(req)) return new Response("Geçersiz origin.", { status: 403 });



  let body: ChatRequest;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek gövdesi", { status: 400 }); }

  /* Pro kapısı: sunucunun (ücretli) LLM anahtarı YALNIZCA Pro kullanıcıya açılır.
     BYOK ve anahtar gerektirmeyen sağlayıcılar herkes için çalışır; Pro değilse
     ücretsiz Pollinations'a düşülür → kırılma olmaz (bkz. resolveModelAccess). */
  let baseUrl = (body.baseUrl || "").replace(/\/$/, "");
  let model = body.model || "";
  let apiKey = body.apiKey || "";
  let provider: string = body.provider || "hf";
  /* Savunma: istemcinin cihaz-şifreli (enc:1:) anahtarı yanlışlıkla buraya
     sızarsa sağlayıcıya GÖNDERME — anahtarsız say. Anahtar gerektiren
     sağlayıcıda access mantığı ücretsiz Pollinations'a düşürür (401 duvarı
     yerine yanıt); anahtarsızlarda (ör. Pollinations token'ı) bozuk token
     atılır, anonim yol çalışır. */
  if (apiKey.startsWith("enc:1:")) apiKey = "";
  /* KEYLESS_CHAT_PROVIDERS ile senkron tutulmalı: "custom" (kullanıcının
     kendi anahtarsız çalışabilen OpenAI-uyumlu ucu) buradan hariç
     tutulmazsa, anahtarsız custom istek sessizce Pollinations'a düşer ve
     kullanıcının gerçek endpoint'i hiç kullanılmaz. */
  const providerNeedsKey = provider !== "pollinations" && provider !== "ovh" && provider !== "ollama" && provider !== "local" && provider !== "custom";
  const hasServerKey = !!process.env.LLM_API_KEY;

  const access = resolveModelAccess({
    hasClientKey: !!apiKey,
    providerNeedsKey,
    hasServerKey,
    isPro: !apiKey && hasServerKey && providerNeedsKey ? await isProRequest() : false,
  });
  /* Şeffaflık: "free-fallback" öncesi asıl istenen sağlayıcı/modeli sakla —
     kullanıcı seçtiği modelin ANLIK olarak kullanılamadığını (anahtar eksik/
     çözülemedi) fark edemiyordu çünkü aşağıdaki geçiş tamamen sessizdi. Akış
     başlarken bir fallback_event ile istemciye bildirilir (bkz. aşağıda). */
  const requestedProvider = provider;
  const requestedModel = model;
  let noKeyFallback = false;
  if (access === "server") {
    baseUrl = (body.baseUrl || process.env.LLM_BASE_URL || "https://router.huggingface.co/v1").replace(/\/$/, "");
    model = body.model || process.env.LLM_MODEL || model;
    apiKey = process.env.LLM_API_KEY || "";
  } else if (access === "free-fallback" && body.strictModel) {
    /* Kesin model modu: anahtarsız sessiz Pollinations geçişi YOK — kullanıcı
       net bir hata görsün ve seçtiği modelin neden çalışmadığını anlasın. */
    return new Response(
      `Seçili model (${requestedProvider ?? provider} / ${requestedModel ?? model}) için kullanılabilir bir API anahtarı yok. ` +
      `Kesin model modu açık olduğundan başka bir modele geçilmedi. Ayarlar → Modeller'den anahtar ekle ya da Kesin model modunu kapat.`,
      { status: 400 },
    );
  } else if (access === "free-fallback") {
    /* Anahtarsız istek → ücretsiz Pollinations (yine yanıt alır, kırılma yok).
       Seçili model BAŞKA sağlayıcıya ait (ör. deepseek/...:free) — Pollinations'ta
       o ID yok, korunursa 404 olur. Geçerli bir Pollinations modeline eşle. */
    noKeyFallback = true;
    baseUrl = "https://text.pollinations.ai/openai";
    provider = "pollinations";
    model = "openai";
    apiKey = "";
  }
  if (!baseUrl) baseUrl = "https://router.huggingface.co/v1";

  if (!model) return new Response("Model seçilmedi.", { status: 400 });
  /* KEYLESS_CHAT_PROVIDERS ile aynı kaynağı kullan (ovh/local/custom da
     anahtarsız çalışır) — bu satır ayrı, bayat bir liste tuttuğu için OVH
     (ve local/custom) anahtarsızken burada yanlışlıkla reddediliyordu. */
  if (!apiKey && !KEYLESS_CHAT_PROVIDERS.has(provider)) return new Response("API anahtarı yok.", { status: 400 });

  /* Proje-başına örnekleme parametreleri (temperature/max_tokens). Tanımsızsa
     sağlayıcı varsayılanı kullanılır. max_tokens için cömert bir varsayılan
     veririz; aksi halde çoğu sağlayıcı yanıtı ~2-4K token'da keser ve kullanıcı
     sürekli "Devam et" tıklamak zorunda kalır (Claude Code'da uzun yanıtlar). */
  const sampling: Record<string, unknown> = {};
  if (typeof body.temperature === "number") sampling.temperature = body.temperature;
  /* Efor seviyesi → GERÇEK API etkisi (yalnızca sistem-prompt yönlendirmesi değil):
       1) max_tokens'ı efora göre ölçekle → daha yüksek efor = daha uzun, daha
          kapsamlı, kesilmeyen yanıt.
       2) Destekleyen sağlayıcıda reasoning/effort parametresini ilet → model
          gerçekten daha fazla düşünme bütçesi harcar.
     Kullanıcı projede açıkça max_tokens belirlediyse onun değeri korunur. */
  const userMaxTokens = typeof body.maxTokens === "number" && body.maxTokens > 0 ? body.maxTokens : 0;
  sampling.max_tokens = userMaxTokens || (body.effort ? EFFORT_TOKENS[body.effort] : 8192);
  /* Claude'un genişletilmiş muhakeme (extended thinking) bütçesi — her zaman
     ilgili EFFORT_TOKENS tavanının ALTINDA (thinking + son yanıt için birlikte
     max_tokens'ı aşamaz). Yalnız modelCapabilities.ts'in extendedThinking=true
     dediği (Claude 3.7+/4.x) modellerde, aşağıdaki openCandidate içinde
     PER-CANDIDATE kullanılır (bkz. not: eskiden bu karar tek bir global
     `sampling` objesine yazılıp TÜM adaylara (farklı sağlayıcılar dahil)
     spread ediliyordu — openrouter için ayarlanan `reasoning` alanı fallback
     bir groq/xai adayına da sızabiliyordu; artık her adayın KENDİ
     provider/model'ine göre karar veriliyor). EFFORT_TOKENS/THINKING_BUDGET
     artık modelCapabilities.ts'ten (J1/J3: orchestrate/route.ts da AYNI
     kaynağı kullanıyor — iki yer sapmasın). */

  /* Aday zinciri: birincil model + istemcinin yolladığı ücretsiz fallback'ler.
     Birincil bir hata verirse (kota/erişim/5xx/bağlantı) sıradaki aday denenir →
     kullanıcı duvara çarpmaz. Geçersiz adaylar (model yok ya da anahtar gereken
     sağlayıcıda anahtar yok) elenir; aynı uç teklerleştirilir. */
  const primary: Candidate = { provider, baseUrl, model, apiKey };
  const seenCand = new Set<string>([`${provider}|${baseUrl}|${model}`]);
  const candidates: Candidate[] = [primary];
  /* Kesin model modu: `fallbacks` gönderilmiş olsa bile yok say — savunma
     amaçlı (istemci zaten boş gönderir, bkz. fallback.ts buildChainFor). */
  for (const f of body.strictModel ? [] : body.fallbacks ?? []) {
    const cp = f.provider ?? "custom";
    const cb = (f.baseUrl ?? "").replace(/\/$/, "");
    const cm = f.model ?? "";
    /* Şifreli (enc:1:) aday anahtarı sağlayıcıya sızdırma — anahtarsız say
       (anahtar gerektiren aday elenmiş olur, anahtarsızda token atılır). */
    const ck = (f.apiKey ?? "").startsWith("enc:1:") ? "" : (f.apiKey ?? "");
    if (!cb || !cm) continue;
    if (!KEYLESS_CHAT_PROVIDERS.has(cp) && !ck) continue;
    const key = `${cp}|${cb}|${cm}`;
    if (seenCand.has(key)) continue;
    seenCand.add(key);
    candidates.push({ provider: cp, baseUrl: cb, model: cm, apiKey: ck });
  }

  /* SSRF: aday baseUrl'leri istemciden gelir. Canlıda (Vercel) iç ağ/loopback/
     bulut-metadata adreslerini reddet; yerelde localhost LLM uçları meşrudur.
     (OpenRouter HTTP-Referer/X-Title başlıkları buildCandidateHeaders'ta.) */
  if (process.env.NODE_ENV === "production") {
    for (const c of candidates) {
      if (!isSafeRemoteUrl(c.baseUrl)) {
        return new Response("Güvensiz baseUrl — yalnızca genel (public) adresler kabul edilir.", { status: 400 });
      }
    }
  }

  /* Güvenilirlik: bu sıcak süreçte az önce hata verdiği bilinen adaylar
     (kota/5xx/bağlantı) listenin SONUNA alınır — aynı isteğin içinde
     saniyelerce sürebilecek bir zaman aşımını beklemeden doğrudan sıradaki
     adaya geçilir. Hiçbir aday ÇIKARILMAZ: birincil model sağlıksız
     işaretliyken bile listede kalır, böylece aşağıdaki dürüstlük kapısı
     (`c === primary`) çalışabilir (bkz. providerHealth.ts). */
  const tryOrder = prioritizeHealthyCandidates(candidates);

  /* Bir adayı çağırır (Anthropic native ucu ayrı; diğerleri OpenAI-uyumlu fetch).
     Pollinations anonim istekleri için `referrer` ekler. */
  const openCandidate = async (c: Candidate, messages: unknown, extra: Record<string, unknown> = {}): Promise<Response> => {
    const b: Record<string, unknown> = { model: c.model, messages, stream: true, ...sampling, ...extra };
    if (body.jsonMode && JSON_MODE_PROVIDERS.has(c.provider)) b.response_format = { type: "json_object" };
    if (c.provider === "pollinations") b.referrer = "craft-coder";
    /* Efor→gerçek API etkisi (I2/I3): HER adayın KENDİ provider/model'ine göre
       — bir önceki sürümde bu karar tek bir global `sampling` objesine yazılıp
       tüm adaylara (farklı sağlayıcılar dahil) spread ediliyordu, bu yüzden
       birincil openrouter ise ayarlanan `reasoning` alanı groq/xai gibi bambaşka
       bir fallback adayına da sızabiliyordu. */
    let thinkingBudget = 0;
    if (body.effort) {
      const apiEffort = body.effort === "max" ? "high" : body.effort;
      const caps = detectModelCapabilities(c.provider, c.model);
      if (c.provider === "openrouter") {
        /* OpenRouter reasoning'i normalize eder; desteklemeyen modelde sessizce
           yok sayar → 400 riski yok. */
        b.reasoning = { effort: apiEffort };
      } else if (caps.nativeReasoningEffort) {
        /* Doğrudan OpenAI o-serisi/gpt-5 — kendi native reasoning_effort alanı
           (önceden yalnız openrouter'da gönderiliyordu, doğrudan anahtarla
           eklenen bu modellerde efor kaydırıcısı max_tokens dışında HİÇBİR
           etki yapmıyordu). */
        b.reasoning_effort = apiEffort;
      } else if (caps.extendedThinking) {
        thinkingBudget = THINKING_BUDGET[body.effort];
      }
      /* deepseek/groq/xai gibi sağlayıcılarda reasoning modelleri zaten
         reasoning_content yayar; bilinmeyen alanla 400 riskine girmeyiz —
         max_tokens ölçeklemesi + sistem-prompt efor yönergesi yeterli etki sağlar. */
    }
    if (c.provider === "anthropic") return anthropicUpstream(c.baseUrl, c.apiKey, b as unknown as OpenAIChatBody, undefined, thinkingBudget);
    /* P2 — OpenAI o-serisi/gpt-5: max_tokens'ı reddedip max_completion_tokens
       ister, varsayılan dışı temperature kabul etmez. Baştan doğru gönder
       (aşağıdaki düşürme mekanizması bunu zaten kurtarırdı ama bir tur boşa
       giderdi). */
    const sendBody = isOpenAiReasoningModel(c.provider, c.model) ? adaptForOpenAiReasoning(b) : b;
    /* G3 — BAĞLANTI (TTFB) ZAMAN AŞIMI. Buradaki fetch'te hiç zaman aşımı yoktu:
       yanıt vermeyen bir sağlayıcı isteği maxDuration'a (300 sn) kadar asılı
       bırakabiliyor, kullanıcı "model çok geç cevap veriyor" diye görüyordu.
       Zamanlayıcı YALNIZ yanıt BAŞLIKLARINI bekler — fetch başlıklar gelir
       gelmez çözülür ve zamanlayıcı temizlenir, gövde ondan sonra serbestçe
       akar. Yani uzun süren meşru akışlar (uzun kod üretimi, tool-loop turları)
       ASLA kesilmez; yalnız hiç başlamayan bağlantı elenip sıradaki adaya
       geçilir (bkz. fallback.ts BuildChainOptions — zincirin sınırsız
       olabilmesinin nedeni bu). */
    const post = async (payload: Record<string, unknown>, cand: Candidate = c) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), CONNECT_TIMEOUT_MS);
      try {
        return await fetch(candidateUrl(cand), {
          method: "POST",
          headers: buildCandidateHeaders(cand, req),
          body: JSON.stringify(payload),
          signal: ctl.signal,
        });
      } catch (err) {
        /* Ham "This operation was aborted" yerine anlaşılır neden — bu metin
           zincir tükenirse kullanıcıya gösterilen hataya girer. */
        if ((err as Error)?.name === "AbortError") {
          throw new Error(`${cand.provider} ${Math.round(CONNECT_TIMEOUT_MS / 1000)} sn içinde yanıt vermedi (zaman aşımı).`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    };
    let res = await post(sendBody);
    /* Kendi kendine kurtarma: anahtarsız da çalışabilen bir sağlayıcıda (ör. OVH)
       saklı/bayat bir anahtar 401/403 alırsa AYNI adayı anonim (anahtarsız) bir
       kez daha dene. Eski bir hatadan (bkz. KEYLESS_CHAT_PROVIDERS senkron
       düzeltmesi) zaten kaydedilmiş bozuk anahtarlı model satırları, kullanıcı
       hiçbir şey yapmadan kendi kendine düzelsin. */
    if (!res.ok && (res.status === 401 || res.status === 403) && c.apiKey && KEYLESS_CHAT_PROVIDERS.has(c.provider)) {
      const anon = { ...c, apiKey: "" };
      return post(sendBody, anon);
    }
    /* P1 — uyumluluk düşürme: 400/422, "bu model bozuk" demek DEĞİLDİR; çoğu
       zaman gönderdiğimiz opsiyonel bir alanı (tools/response_format/reasoning/
       max_tokens/temperature) o modelin desteklememesidir. Eskiden bu durumda
       istek DOĞRUDAN sıradaki modele düşüyor ve kullanıcı "istediğim model
       cevap vermiyor" uyarısını görüyordu. Artık hatayı okuyup ilgili alanı
       düşürerek AYNI modelle tekrar deniyoruz; en fazla 2 kademe, sonra
       fallback zinciri devreye girer. */
    let payload = sendBody;
    for (let i = 0; i < 2 && !res.ok && (res.status === 400 || res.status === 422); i++) {
      const errText = await res.clone().text().catch(() => "");
      const down = downgradeRequest(payload, errText);
      if (!down) break;
      payload = down.body;
      res = await post(payload);
    }
    return res;
  };

  let sysPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  /* İç muhakeme sızıntısına karşı koruma: bazı ücretsiz modeller (ör. harmony
     tabanlı) çözümleme/düşünme metnini DÜZ İÇERİK olarak yayıp yanıta karıştırır
     ("we need web search…", "Provide answer. Ok."). Modele yalnızca NİHAİ cevabı
     yazmasını, muhakemeyi göstermemesini söyle → temiz yanıt. */
  sysPrompt +=
    `\n\n[Yanıt biçimi] Yalnızca KULLANICIYA yönelik NİHAİ cevabı yaz. İç muhakemeni, ` +
    `"düşünme"/"analiz" adımlarını, kendi kendine notları ("we need…", "user wants…", ` +
    `"provide answer", "no code", "ok") veya sahte konuşma dökümlerini (User:/Assistant:) ` +
    `ASLA yanıt metnine yazma. Doğrudan sonucu ver.`;
  /* G1 — DÜRÜSTLÜK. Sistem promptu (ve platform bilgisi) Umai'nin TÜM
     yeteneklerini anlatır; ama o yeteneklerin bir kısmı O ANKİ turda gerçekten
     elde olmayabilir: repo bağlı değilse dosya araçları, anahtarsız uçta
     function-calling, görsel üretimi kapalıysa generate_image yoktur. Model bu
     farkı bilmediği için elinde olmayan bir yeteneği varmış gibi davranıp
     takılıyor ya da yaptığını sanıp uydurmuş oluyordu. Kural: yapamadığında
     BUNU SÖYLE — sessizce yapamamak, yapmış gibi davranmak ya da konuyu
     değiştirmek yerine. */
  sysPrompt +=
    `\n\n[Dürüstlük] Elindeki araçlarla YAPAMAYACAĞIN bir şey istenirse (ör. sunum/slayt ` +
    `oluşturma, görsel üretme, dosya yazma, internete çıkma) bunu AÇIKÇA ve tek cümleyle ` +
    `söyle: neyi yapamadığını ve nedenini belirt, mümkünse kullanıcının bunu nasıl ` +
    `açabileceğini ekle (ör. "Ayarlar → Model'den görsel üretimi olan bir sağlayıcı ekle", ` +
    `"depo bağla"). Yapamadığın bir işi yapmış gibi anlatma, sahte çıktı/bağlantı/dosya adı ` +
    `uydurma, sessizce başka bir konuya kayma. Emin değilsen "emin değilim" de. Kısmen ` +
    `yapabiliyorsan yapabildiğin kadarını yap ve neyin eksik kaldığını açıkça yaz.`;
  /* Araç kapıları — sysPrompt rehberi de bunlara göre yazıldığı için allTools'tan
     ÖNCE hesaplanır (ikisi de aynı üç sabiti kullanır, sapma olmaz).
     askUserCapable: anahtarsız ücretsiz uçlar (Pollinations/OVH…) function-calling
     desteklemeyip `tools` alanına 400 verebilir → onlarda hiç araç eklenmez ve
     A1'in zero-copy hızlı yolu korunur.
     L2 — organik web arama: web_search/read_url önceden YALNIZ istemcideki autoWeb()
     regex'i body.webSearch'ü açtığında sunuluyordu; yani "aramam lazım" kararını
     regex veriyordu, model değil (Claude'da modelin kendisi karar verir; regex'in
     kaçırdığı güncel-bilgi sorularında Umai sessizce eski bilgiyle cevaplıyordu).
     Artık tool-yetenekli sağlayıcılarda HER ZAMAN sunulur. body.webSearch hâlâ
     onurlandırılır (kullanıcı açıkça açtıysa anahtarsız uçta bile denenir).
     L1 — analiz aracı: aynı kapı + istemcinin kod çalıştırıcı desteğini bildirmesi
     (codeExec) şart, çünkü kod sunucuda değil kullanıcının tarayıcısında çalışır. */
  const askUserCapable = !KEYLESS_CHAT_PROVIDERS.has(provider);
  const webToolsOn = !body.blockNetworkTools && (askUserCapable || !!body.webSearch);
  const codeToolOn = !!body.codeExec && askUserCapable;
  /* L1 — düz sohbette de analiz aracını tanıt: repo-ajanı rehberi (aşağıda,
     yalnız tools+repoCtx varken) bu turda hiç eklenmiyor olabilir. */
  if (codeToolOn) {
    sysPrompt +=
      `\n\n[Analiz aracı] Hesap, veri/metin analizi, tarih hesabı veya bir formülün/` +
      `algoritmanın doğrulanması gerektiğinde run_code aracını ÇAĞIR (Python veya ` +
      `JavaScript) — sonucu kafadan tahmin etme, çalıştır ve gerçek çıktıyı gör. ` +
      `Sonucu print()/console.log() ile yazdırmayı unutma; çıktı sana ayrı bir mesaj ` +
      `olarak döner.\n` +
      /* M2 — üretilen kodu doğrulama. "Her kod parçasını çalıştır" DEMİYORUZ:
         bu her yanıta gereksiz bir tur eklerdi. Ölçüt, doğruluğun gerçekten
         önemli ve kodun kendi kendine çalışabilir olması. */
      `Kendi başına çalışabilen bir Python/JS parçası ürettiğinde ve doğruluğu önemliyse ` +
      `(algoritma, dönüşüm, hesap, ayrıştırma), SUNMADAN ÖNCE run_code ile çalıştırıp ` +
      `doğrula; hata çıkarsa düzelt ve tekrar dene, sonra çalışan sürümü ver. Çalıştırmadıysan ` +
      `"test ettim/çalışıyor" deme. Dış bağımlılık, ağ, dosya ya da kullanıcı girdisi gerektiren ` +
      `kodu çalıştırmaya çalışma — orada doğrulama beklenmiyor.`;
  }
  /* Açıklayıcı diyalog (Claude Code'un plan-onay döngüsü gibi): belirsiz
     isteklerde rastgele varsayımla ilerlemek yerine tıklanabilir bir seçenek
     listesi sun ve kullanıcının kararını bekle. ask_user aracı artık HER
     modda sunuluyor (repo bağlı olmasa bile, bkz. allTools aşağıda) — bu
     yüzden birincil yol GERÇEK tool-call'dır (istemci bunu Claude'daki gibi
     tıklanabilir bir anket kartı olarak render eder). GFM checkbox biçimi
     yalnızca ask_user'ı desteklemeyen bir uca düşülürse (fallback zinciri
     tool-calling'i reddederse) devreye giren İKİNCİL bir yedektir. */
  sysPrompt +=
    `\n\n[Açıklayıcı diyalog] İstek belirsizse veya birden fazla makul yorumu/parametresi ` +
    `varsa hemen bir varsayımla ilerleme: ask_user aracını çağırarak kısa, tıklanabilir bir ` +
    `seçenek listesi sun ve kararını bekle (araç bir nedenle çağrılamıyorsa GFM checkbox ` +
    `biçiminde yaz, ör. "- [ ] Seçenek A"). Kullanıcı yanıtlayınca seçimine göre ilerle; hâlâ ` +
    `netlik gerekiyorsa aynı yolla yeni bir kısa soru daha sorarak bu turu birkaç kez ` +
    `tekrarlayabilirsin — ama gereksiz yere sorma, istek zaten netse doğrudan işe koyul.`;
  /* R1 — Kimlik: model kendi kimliğini TAHMİN ETMESİN diye gerçeği veriyoruz.
     DİKKAT: kimlik bloğu BURAYA (sysPrompt'a) YAZILMAZ. sysPrompt istek
     başında BİR KEZ kurulur ve o an yalnızca BİRİNCİL adayın kim olduğu
     bilinir; oysa yanıtı gerçekte hangi adayın vereceği aşağıdaki fallback
     döngüsünde belli olur. Kimlik burada sabitlenirse zincir devreye
     girdiğinde yanıtı veren model kendisine söylenen YANLIŞ kimliği bildirir
     — canlıda görülen tam da buydu: aktif model NVIDIA NIM, istek
     gemini-2.5-flash'e düştü, yanıt ise "DeepSeek V4 Pro modeliyim" dedi
     (birincil NIM modeli bir DeepSeek'ti ve Gemini itaatle onu tekrarladı).
     Kimlik artık ADAY BAŞINA ekleniyor — bkz. withIdentity / toolBodyFor. */
  /* R3 — Platform bilgisi iki kademeli: kısa dizin her zaman, 11 KB'lik tam
     rehber yalnız soru gerçekten arayüz/platform hakkındaysa. Her isteğe
     ~3.150 token dokümantasyon eklemek ilk token gecikmesini büyütüyordu. */
  const lastUserContent = [...body.messages].reverse().find((m) => m.role === "user")?.content;
  sysPrompt += `\n\n${PLATFORM_KNOWLEDGE_BRIEF}`;
  if (needsPlatformKnowledge(typeof lastUserContent === "string" ? lastUserContent : "")) {
    sysPrompt += `\n\n${PLATFORM_KNOWLEDGE}`;
  }
  if (body.projectPrompt) sysPrompt += `\n\n[Proje talimatları]: ${body.projectPrompt}`;
  /* Stil + hafıza + skills — istemci ile ortak tek kaynak. searchContext
     BİLİNÇLİ OLARAK burada DEĞİL (bkz. aşağıdaki volatileTail): bu turdan
     turа değişen TEK parça olduğundan, sysPrompt'un geri kalanından (repo
     haritası/SOUL.md/araç talimatları — hepsi turlar arası SABİT) ayrı
     tutulursa Anthropic prompt caching (anthropic.ts) sysPrompt'un büyük,
     değişmeyen kısmını gerçekten önbellekten okuyabilir. */
  sysPrompt += buildContextSections({
    style: body.style,
    memories: body.memories,
    skills: body.skills,
  });
  if (body.tools && body.repoCtx) {
    const rc = body.repoCtx;
    /* SOUL.md / repo ağacı / package.json / .gitignore — kısa ömürlü (3dk)
       sunucu-taraflı önbellek: hem gereksiz GitHub/GitLab API tekrarını
       önler hem de bu metnin ardışık turlarda BAYT-BAYT aynı kalmasını
       garanti eder → Anthropic prompt caching (anthropic.ts) gerçekten
       isabet eder (bkz. repoContextCache.ts). */
    const soulContent = await cached(repoCacheKey(rc, "soul"), () => fetchSoulFile(rc)).catch(() => null);
    if (soulContent) {
      sysPrompt += `\n\n[Proje bağlamı — SOUL.md]:\n${soulContent.slice(0, 6000)}`;
    }
    /* Proje profili: framework algılama (package.json) + .gitignore farkındalığı.
       Tek seferlik, paralel çekim; hata olursa sessiz geçilir. */
    const [pkgRaw, gitignoreRaw] = await Promise.all([
      cached(repoCacheKey(rc, "pkg"), () => getFileRaw(rc, "package.json").then((r) => (r.ok ? r.content : null))).catch(() => null),
      cached(repoCacheKey(rc, "gitignore"), () => getFileRaw(rc, ".gitignore").then((r) => (r.ok ? r.content : null))).catch(() => null),
    ]);
    const frameworks = pkgRaw ? detectFrameworks({ deps: extractDeps(pkgRaw) }) : [];
    if (frameworks.length || gitignoreRaw) {
      sysPrompt += `\n\n[Proje profili]`;
      if (frameworks.length) sysPrompt += `\n• Algılanan teknolojiler: ${frameworks.join(", ")} — bu ekosistemin en iyi pratiklerini uygula.`;
      if (gitignoreRaw) {
        const ignored = parseGitignore(gitignoreRaw).slice(0, 30).join(", ");
        sysPrompt += `\n• .gitignore kalıpları (bunlara dokunma/oluşturma): ${ignored}`;
      }
    }
    /* Büyük kod tabanı: repo DOSYA HARİTASINI prompt'a enjekte et → ajan
       list_files çağırmadan yapıyı bilir, doğru dosyayı hedefler. Tek tree
       çağrısı; Anthropic'te cache'lenir, diğerlerinde kompakt (yalnız yollar). */
    /* Köprü modunda ajan GERÇEK bir dosya sisteminde çalışır ve komutları
       (run_command) o makinede koşar. Çalışma klasörünü AÇIKÇA söylemezsek
       ajan komutları köprünün kökünde çalıştırıyor; kök bir git deposu
       olmadığı için `git remote -v` gibi komutlar anlamsız hata veriyor ya da
       yandaki alâkasız projeyi gösteriyordu.

       gitSource + bridgeDir doluysa: dosya haritasını çıkarmadan ÖNCE bağlı
       depoyu köprünün diskinde GERÇEKTEN var/güncel hale getir (ensureBridgeRepo).
       Aksi halde "GitLab'a token ile bağlandım ama köprü de açık" durumunda
       köprü hâlâ eski/boş bir klasöre bakar, ajan depoyu "göremez" — token
       bağlantısı var olsa da hiç kullanılmamış olur. */
    let bridgeSyncNote = "";
    if (rc.provider === "local" && rc.gitSource && rc.bridgeDir) {
      const sync = await ensureBridgeRepo(rc);
      if (!sync.ok) {
        bridgeSyncNote = `\nUYARI: bağlı depo köprüde güncellenemedi (${sync.error}). Aşağıdaki dosya haritası/araçlar BAYAT ya da BOŞ olabilir — kullanıcıya bunu söyle, tahminde bulunma.\n`;
      }
    }
    try {
      const allPaths = await cached(repoCacheKey(rc, "tree"), () => getAllPaths(rc));
      if (allPaths.length) {
        sysPrompt += `\n\n[Repo dosya haritası — ${allPaths.length} dosya]\n${buildRepoMap(allPaths)}`;
      }
    } catch { /* harita yoksa sessiz geç — araçlar yine çalışır */ }
    if (rc.provider === "local") {
      const dir = (rc.bridgeDir || "").replace(/^\/+|\/+$/g, "");
      sysPrompt +=
        `\n\n[Çalışma alanı — GERÇEK dosya sistemi]\n` +
        `Bağlı depo: ${rc.owner}/${rc.repo} (${rc.branch}).\n` +
        (dir
          ? `Proje klasörü köprü kökünün ALTINDA: "${dir}". Dosya araçların zaten bu klasöre göre çalışır — yollara "${dir}/" EKLEME. ` +
            `run_command da AYNI klasörde başlar (cd gerekmez) — doğrudan run_command('git status') gibi çağır.\n` +
            (rc.gitSource
              ? `Bu klasör her mesajda bağlı depoyla OTOMATİK senkronlanır (klon/fetch+reset) — elle git clone/pull yapmana gerek yok.\n`
              : "") +
            bridgeSyncNote
          : `Proje klasörü belirtilmemiş; köprü kökü doğrudan kullanılıyor.\n`);
    }
    sysPrompt +=
      `\n\n[Ajan modu — Repo: ${body.repoCtx.owner}/${body.repoCtx.repo} (${body.repoCtx.branch})]\n` +
      `ÖNEMLİ — SEN GERÇEK BİR KODLAMA AJANISIN, sohbet botu DEĞİL. "üret / oluştur / yaz / ekle / kur / yap" ` +
      `istendiğinde kodu SOHBETE YAPIŞTIRMA; write_file/str_replace araçlarıyla repoda GERÇEK dosyalar oluştur/düzenle ve commit'le. ` +
      `Açıklama değil EYLEM: "şöyle yapabilirsin" deyip örnek kod göstermek YETMEZ — aracı çağırıp uygula. ` +
      `Görev bitince dosyalar gerçekten oluşmuş/commit'lenmiş olmalı. Çok dosyalı bir proje istense bile ` +
      `dosyaları tek tek write_file ile oluştur (sohbete tek büyük blok dökme).\n` +
      `Mevcut araçlar:\n` +
      `• list_files(filter?) — repo dosya ağacını listele\n` +
      `• read_file(path) — dosya içeriğini oku (SATIR NUMARALARIYLA döner)\n` +
      `• read_files(paths[]) — birden çok dosyayı TEK çağrıda oku\n` +
      `• glob(pattern) — yıldızlı desenle dosya bul (ör. src/**/*.tsx)\n` +
      `• grep(pattern, glob?, ignore_case?) — regex ile içerik ara (dosya:satır)\n` +
      `• search_files(query) — dosya yolunda arama\n` +
      `• search_code(query, extension?) — dosya İÇERİĞİNDE arama (basit)\n` +
      `• str_replace(path, old_string, new_string, commit_message?) — HEDEFLİ düzenleme (tercih et)\n` +
      `• write_file(path, content, commit_message) — YENİ dosya veya tam değişim\n` +
      `• delete_file(path, reason?) — dosya silmeyi ÖNERİR (kullanıcı onaylar)\n` +
      `• rename_file(path, new_path, reason?) — yeniden adlandırmayı ÖNERİR (kullanıcı onaylar)\n` +
      `• list_branches() / create_branch(name, from?) — dal işlemleri\n` +
      `• create_pr(title, head, base, body?) — PR/MR aç (başlık+açıklamayı sen üret)\n` +
      `• get_commit_history(limit?, path?) — commit geçmişi\n` +
      /* Aynı koşul araç filtresinde de var (bridgeExecAvailable) ama o
         DEĞİŞKEN burada henüz tanımlı değil — sysPrompt ondan önce kuruluyor.
         Koşulu yerinde hesapla ki talimat ile gerçekten sunulan araç listesi
         asla çelişmesin (olmayan aracı tarif etmek modeli yanıltır). */
      (rc.provider === "local" && !!rc.bridgeUrl
        ? `• check_command(task_id) — arka planda süren komudun ANLIK çıktısını/durumunu oku\n` +
          `• stop_command(task_id) — arka plandaki komudu (ve alt süreçlerini) durdur\n` +
          `  ↳ run_command bitmeyen bir komut başlattığında bir görev kimliği döner. "npm run dev" gibi ` +
          `bir şey başlattıysan KÖRLEŞME: check_command ile sunucunun gerçekten ayağa kalktığını doğrula, ` +
          `işin bitince stop_command ile kapat.\n`
        : "") +
      `• git_diff(base, head) — iki dal/commit arasındaki farkı göster\n` +
      `• git_log(branch?, path?, limit?) — commit geçmişini listele\n` +
      `• git_blame(path, startLine?, endLine?) — dosyayı etkileyen son commit'ler\n` +
      `• discover_rules() — CLAUDE.md/AGENTS.md/.rules gibi davranış dosyalarını otomatik tara\n` +
      `• trigger_ci(workflow, ref?, inputs?) — GitHub Actions workflow'unu tetikle\n` +
      `• dispatch_agents(tasks[]) — karmaşık görevi PARALEL salt-okunur alt-ajanlara böl (Claude'daki gibi)\n` +
      `• generate_image(prompt, aspect_ratio?) — kullanıcı görsel/resim isteyince ÇAĞIR (doğal dilde, komut gerekmez); görsel arayüzde OTOMATİK gösterilir, yanıtına markdown/URL/base64 YAZMA\n` +
      `• deep_research(topic) — kullanıcı derinlemesine/kaynaklı bir araştırma/rapor isteyince ÇAĞIR; dönen atıflı raporu ÖZETLEMEDEN aynen ilet\n` +
      `• update_plan(plan) — çok adımlı görevde canlı yapılacaklar listesi\n` +
      (webToolsOn ? `• web_search(query) — internette ara\n• read_url(url) — web sayfası oku\n` : "") +
      (codeToolOn ? `• run_code(language, code) — Python/JS kodu ÇALIŞTIR ve gerçek çıktısını al\n` : "") +
      `\nÇalışma pratiği:\n` +
      (codeToolOn ? `— Hesap, veri analizi, formül/algoritma doğrulama veya yazdığın kodun çalıştığını kanıtlama gerektiğinde run_code'u ÇAĞIR — sonucu kafadan tahmin etme, çalıştır ve gör.\n` : "") +
      `— ARAÇLARI GERÇEKTEN ÇAĞIR — anlatma/simüle etme. Komutu veya kodu kullanıcıya "şunu çalıştır / şunu yapıştır" diye METİN olarak VERME; uygun araç varsa (run_command, str_replace, write_file) KENDİN çağır ve sonucu göster. Kullanıcı senin yapmanı bekliyor, tarif etmeni değil.\n` +
      `— Çok adımlı (2+) görevlerde MUTLAKA önce update_plan ile yapılacaklar listesini yaz (kullanıcı ilerlemeyi canlı "todo" kutusunda görür), her adım bitince planı güncelleyip [x] işaretle — bunu atlama.\n` +
      `— Görev BAĞIMSIZ paralel parçalara bölünebiliyorsa (ör. birden çok modülü ayrı ayrı incelemek) dispatch_agents ile alt-ajanlara dağıt; basitse kendin yap.\n` +
      `— Kullanıcı bir görsel/resim/illüstrasyon istediğinde (komut/buton beklemeden, doğal dilden anla) generate_image'i çağır. Üretilen görsel arayüzde OTOMATİK olarak gösterilir: yanıtına markdown görsel etiketi (![...]), URL ya da base64 veri YAZMA — yalnızca bir-iki cümleyle tanıt.\n` +
      `— Kullanıcı derinlemesine/kaynaklı/kapsamlı bir araştırma istediğinde deep_research'ü çağır; dönen atıflı raporu ÖZETLEMEDEN/KISALTMADAN, atıfları ve Kaynaklar bölümünü koruyarak ilet.\n` +
      `— Cevaplamadan önce ilgili dosyaları oku. Bağımsız okumaları TEK turda birlikte iste (paralel çalışır).\n` +
      `— list_files veya search_code ile önce yapıyı anla, sonra spesifik dosyalara gir.\n` +
      `— Var olan dosyada KÜÇÜK değişiklik için str_replace kullan (tüm dosyayı yeniden yazma); old_string ham metin olmalı (satır numarası DEĞİL), birebir ve benzersiz.\n` +
      `— Yalnızca yeni dosya veya köklü değişimde write_file kullan. Kullanıcının onayına gerek yok.\n` +
      `— Silme/yeniden adlandırma YIKICIDIR: delete_file/rename_file yalnızca ÖNERİR, kullanıcı onaylayana kadar gerçekleşmez; buna güvenip 'sildim' deme.\n` +
      `— Aynı dosyayı tekrar okuma; okuduklarını hatırla.\n` +
      `— Karmaşık görevde adım adım ilerle: keşfet → analiz et → değiştir → doğrula.`;
    if (body.safeMode) {
      sysPrompt +=
        `\n\n[ÖNEMLİ — Salt-okunur (Güvenli Mod) açık]\n` +
        `Bu oturumda HİÇBİR değiştirici işlem yapamazsın: dosya yazma/düzenleme, ` +
        `silme, yeniden adlandırma, dal/PR oluşturma ve komut çalıştırma araçları DEVRE DIŞI. ` +
        `Yalnızca okuma, arama ve analiz yap. Bir değişiklik gerekiyorsa onu \`\`\`dil:dosya/yolu ` +
        `kod bloğu olarak ÖNER; kullanıcı Güvenli Mod'u kapatıp kendisi uygular.`;
    } else if (body.requireWriteApproval) {
      sysPrompt +=
        `\n\n[ÖNEMLİ — Onay modu açık]\n` +
        `Dosyaları DOĞRUDAN YAZMA/commit ETME (write_file/str_replace KULLANMA). ` +
        `Bunun yerine değişiklikleri \`\`\`dil:dosya/yolu biçiminde kod bloğu olarak ÖNER; ` +
        `kullanıcı inceleyip commit arayüzüyle kendisi uygular. Okuma/arama araçlarını serbestçe kullan.`;
    }
    if (body.planApprovalMode && !body.planApproved) {
      sysPrompt +=
        `\n\n[ÖNEMLİ — Plan modu açık]\n` +
        `ÖNCE ilgili dosyaları okuyup anla, sonra update_plan ile NET ve ayrıntılı bir uygulama planı sun ve DUR. ` +
        `Hiçbir değişiklik YAPMA (yazma/silme araçları zaten devre dışı). Planı + kısa gerekçeyi yaz, ` +
        `kullanıcı planı onaylayıp 'uygula' dediğinde bir sonraki turda gerçekleştireceksin.`;
    }
  }
  if (body.webSearch && !body.repoCtx) {
    sysPrompt +=
      `\n\n[Web arama modu]\n` +
      `Mevcut araçlar: web_search(query), read_url(url)\n` +
      `Bilgi gerektiren sorularda önce web_search ile ara, sonra ilgili sayfaları read_url ile oku.`;
  }
  /* Faz 6 — yalnız generate_image: repo bağlı/Tools açık senaryoda bu araç
     zaten yukarıdaki [Ajan modu] bloğunda anlatıldı (tekrar etme); burada
     yalnızca O YOKKEN (repo bağlı değil veya Tools kapalı) bu TEK aracın
     nasıl kullanılacağını ayrıca anlat. */
  if (body.imageGen && !(body.tools && body.repoCtx)) {
    sysPrompt +=
      `\n\n[Görsel üretim modu]\n` +
      `Mevcut araç: generate_image(prompt, aspect_ratio?) — kullanıcı bir görsel/resim/illüstrasyon ` +
      `istediğinde (doğal dilden anla, komut/buton gerekmez) ÇAĞIR. Üretilen görsel arayüzde OTOMATİK ` +
      `gösterilir; yanıtına markdown görsel etiketi (![...]), URL ya da base64 veri YAZMA — yalnızca ` +
      `bir-iki cümleyle kısaca tanıt.`;
  }

  /* searchContext'i (varsa) AYRI, İKİNCİ bir system mesajı olarak en sona
     ekle. anthropic.ts'teki convertMessages yalnız SON system bloğunu
     önbelleksiz bırakır (cache_control almaz) — böylece önündeki büyük,
     turlar arası sabit blok (repo haritası + SOUL.md + araç talimatları +
     PLATFORM_KNOWLEDGE) gerçekten önbellekten okunur, yalnız bu küçük
     değişken kuyruk her seferinde tam fiyata gider. */
  const systemMessages: { role: "system"; content: string }[] = body.searchContext
    ? [{ role: "system", content: sysPrompt }, { role: "system", content: `\n\n[Web arama sonuçları]:\n${body.searchContext}` }]
    : [{ role: "system", content: sysPrompt }];

  const encoder = new TextEncoder();

  /* Tool-use loop — HER istek (repo bağlı olmasa, Tools kapalı olsa bile) bu
     yoldan geçer: ask_user (Faz 6 dar kapsam — bkz. tools.ts) her modda
     sunulur ki belirsiz isteklerde Claude'daki gibi gerçek, tıklanabilir bir
     anket kartı göster(ebil)sin. Eskiden araçsız/webSearch'süz/imageGen'siz
     sohbet ham upstream body'sini doğrudan (zero-copy) ilettiği bir kısayola
     sahipti; ask_user için tool-call'ları ayrıştırmak (streamRound) şart
     olduğundan bu kısayol kaldırıldı — fallback zinciri + fallback_event
     şeffaflığı aşağıdaki döngüde birebir korunuyor (bkz. "İlk tur" bloğu). */
  const repoCtx = body.repoCtx;
  const ownOrigin = new URL(req.url).origin;
  /* Eskiden yalnız bu üçü tool-loop'a girerdi (araçsız düz sohbet passthrough
     alırdı) — MCP sunucu çağrısı ve Supabase dayanıklılık kontrolü gibi EK
     ağ maliyetli işler hâlâ SADECE bu durumlarda yapılsın; ask_user (her
     modda sunulan tek küçük araç) bunları TETİKLEMESİN, aksi halde en yaygın
     düz sohbet mesajına gereksiz MCP/Supabase gecikmesi eklenir. */
  const wantsFullTools = !!(body.tools && body.repoCtx) || !!body.webSearch || !!body.imageGen;
  /* Yerleşik (self-hosted) sunucular göreli bir yol (/api/mcp/builtin/*) taşır
     — fetch() bunu tek başına çözemez, bu isteğin kendi origin'iyle mutlak
     hale getirilir (bkz. isSafeMcpServerUrl). */
  const activeMcpServers = wantsFullTools
    ? (body.mcpServers ?? [])
        .filter((s) => s.enabled !== false)
        .map((s) => (s.url?.startsWith("/") ? { ...s, url: `${ownOrigin}${s.url}` } : s))
    : [];
  const convo: ChatRequest["messages"] = [
    ...systemMessages,
    ...body.messages,
  ];

  /* Fetch MCP tools in parallel */
  const mcpToolDefs = (await Promise.all(
    activeMcpServers.map((srv) => fetchMcpTools(srv, ownOrigin)),
  )).flat();
  const WEB_TOOLS = [
    {
      type: "function" as const,
      function: {
        name: "web_search",
        description: "Web'de arama yapar. Güncel bilgi, haber, dökümantasyon veya herhangi bir konu hakkında internette arama yap.",
        parameters: {
          type: "object" as const,
          properties: { query: { type: "string", description: "Arama sorgusu" } },
          required: ["query"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "read_url",
        description: "Bir web sayfasını okur ve içeriğini döndürür. web_search sonucundaki linkleri okumak için kullan.",
        parameters: {
          type: "object" as const,
          properties: { url: { type: "string", description: "Okunacak URL (tam adres)" } },
          required: ["url"],
        },
      },
    },
  ];
  /* İzin/plan moduna göre araçları kısıtla:
     - Onay modu veya plan-modu(onaylanmadan): yazma araçları kaldırılır.
     - Plan modu (onaylanmadan): yıkıcı öneriler de kaldırılır → ajan yalnızca planlar. */
  const planGate = !!body.planApprovalMode && !body.planApproved;
  const blockWrites = !!body.requireWriteApproval || planGate;
  let coderTools = [...CODER_TOOLS, ...EXTENSION_TOOLS];
  if (blockWrites) coderTools = coderTools.filter((t) => t.function.name !== "write_file" && t.function.name !== "str_replace");
  if (planGate) coderTools = coderTools.filter((t) => t.function.name !== "delete_file" && t.function.name !== "rename_file");
  /* Salt-okunur Güvenli Mod: TÜM değiştirici araçları kaldır (yazma/silme/
     yeniden adlandırma/dal/PR/komut). Yalnızca okuma+arama kalır. */
  if (body.safeMode) {
    const MUTATING_TOOLS = new Set(["write_file", "str_replace", "delete_file", "rename_file", "create_branch", "create_pr", "run_command"]);
    coderTools = coderTools.filter((t) => !MUTATING_TOOLS.has(t.function.name));
  }
  /* run_command şu ikisinden biri varsa sunulur: istemcide terminal (WebContainer/
     uzak WS) VEYA köprüde gerçek /exec (repoCtx.provider==="local" + bridgeUrl) —
     ikinci durumda komut SUNUCUDAN çalışır, istemcinin terminali hiç gerekmez. */
  const bridgeExecAvailable = repoCtx?.provider === "local" && !!repoCtx.bridgeUrl;
  if (!body.terminalAvailable && !bridgeExecAvailable) {
    coderTools = coderTools.filter((t) => t.function.name !== "run_command");
  }
  /* check_command/stop_command YALNIZ köprü modunda anlamlı — istemci
     terminalinde (WebContainer/uzak WS) arka plan görev kimliği kavramı yok,
     komut çıktısı ayrı bir mesaj olarak zaten geliyor. Sunulursa model
     çağırır ve her seferinde "kullanılamaz" cevabı alır (boşa tur). */
  if (!bridgeExecAvailable) {
    coderTools = coderTools.filter((t) => t.function.name !== "check_command" && t.function.name !== "stop_command");
  }
  /* ask_user (Claude tarzı tıklanabilir anket) düz sohbette de sunulur AMA yalnız
     tool-YETENEKLİ (anahtarlı) birincil sağlayıcıda: Pollinations/OVH gibi anahtarsız
     ücretsiz uçlar function-calling desteklemeyip `tools` alanına 400 verebilir →
     en yaygın ücretsiz sohbet yolunu kırardı (regresyon). Anahtarsızda araç eklenmez;
     allTools boş kalırsa aşağıda zero-copy passthrough'a düşülür (hız + 400 riski yok),
     netleştirme GFM-checkbox ikincil yoluyla yine interaktif kalır. */
  let allTools = [
    ...(body.tools && body.repoCtx
      ? coderTools
      : [...(askUserCapable ? [ASK_USER_TOOL] : []), ...(body.imageGen ? [GENERATE_IMAGE_TOOL] : [])]),
    ...(codeToolOn ? [RUN_CODE_TOOL] : []),
    ...(webToolsOn ? WEB_TOOLS : []),
    ...mcpToolDefs.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  ];
  /* Granüler izin: kullanıcının açıkça reddettiği (toolPermissions[name] === false)
     araçlar ajana hiç sunulmaz. Anahtar yoksa veya true ise izinli. */
  if (body.toolPermissions) {
    const perms = body.toolPermissions;
    allTools = allTools.filter((t) => perms[t.function.name] !== false);
  }

  /* A1 — düz sohbet hızlı yolu (regresyon düzeltmesi): hiç araç yoksa (anahtarsız
     düz sohbet: ask_user tool-yetenekli değil, repo/webSearch/imageGen yok) tool-loop
     yerine ilk başarılı adayın gövdesini ZERO-COPY ilet — hem sıcak yol yeniden
     kodlama maliyeti ortadan kalkar hem de `tools` alanı hiç gönderilmez (uyumsuz
     uçlarda 400 riski yok). Şeffaflık (noKeyFallback / birincilden fallback'e geçiş)
     birebir korunur. wantsFullTools'ta ASLA girme (repo/websearch/imageGen tool-loop'a
     ait; durability orada). */
  if (allTools.length === 0 && !wantsFullTools) {
    const messages = [...systemMessages, ...body.messages];
    let lastStatus = 502, lastDetail = "", lastCand: Candidate = primary;
    for (const c of tryOrder) {
      let upstream: Response;
      try {
        upstream = await openCandidate(c, messages);
      } catch (err) {
        markProviderDown(c.provider, c.baseUrl, c.model);
        lastStatus = 502; lastDetail = (err as Error).message; lastCand = c;
        continue; // bağlantı hatası → sıradaki aday
      }
      if (upstream.ok && upstream.body) {
        markProviderUp(c.provider, c.baseUrl, c.model);
        const headers = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" };
        if (!noKeyFallback && c === primary) {
          return new Response(upstream.body, { headers });
        }
        /* Şeffaflık olayını akışın başına ekle, sonra upstream'i olduğu gibi ilet. */
        const reader = upstream.body.getReader();
        const prefix = encoder.encode(`data: ${JSON.stringify({
          fallback_event: noKeyFallback
            ? { provider: c.provider, model: c.model, reason: "no_key", requestedProvider, requestedModel }
            : { provider: c.provider, model: c.model },
        })}\n\n`);
        const combined = new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(prefix); },
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); return; }
            controller.enqueue(value);
          },
          cancel(reason) { void reader.cancel(reason).catch(() => {}); },
        });
        return new Response(combined, { headers });
      }
      lastStatus = upstream.status || 500;
      if (isProviderFault(lastStatus)) markProviderDown(c.provider, c.baseUrl, c.model);
      lastDetail = await upstream.text().catch(() => "");
      lastCand = c;
    }
    return new Response(friendlyApiError(lastStatus, lastDetail, { model: lastCand.model, provider: lastCand.provider as Provider }), { status: lastStatus });
  }

  /* Dayanıklılık: chatId verilmiş + kullanıcı girişliyse, sekme yanıt
     bitmeden kapansa bile nihai yanıt aşağıdaki after() bloğunda `chats`
     tablosuna yazılır + push bildirimi gönderilir. Supabase yoksa/girişsizse
     ya da chatId gelmemişse (gizli sohbet vb.) davranış birebir eskisi gibi.
     Yalnızca wantsFullTools'ta hesapla — düz sohbette (yalnız ask_user)
     bu HER mesaja bir Supabase auth çağrısı ekler, önceden hiç yoktu. */
  const durableSupabase = wantsFullTools ? await createClient() : null;
  const durableUser = durableSupabase ? (await durableSupabase.auth.getUser()).data.user : null;
  const durableChatId = durableUser && body.chatId ? body.chatId : null;

  const stream = new ReadableStream({
    async start(controller) {
      /* İstemci bağlantıyı kapatınca (sekme kapanır/ağ gider) bunu güvenilir
         biçimde yakala — orchestrate/route.ts'teki aynı desen. enqueue'daki
         try/catch, abort olayı zamanında yetişmezse son bir güvenlik ağı. */
      let clientGone = false;
      req.signal.addEventListener("abort", () => { clientGone = true; }, { once: true });
      const safe = {
        enqueue: (chunk: Uint8Array) => {
          try { controller.enqueue(chunk); } catch { clientGone = true; }
        },
      };
      /* Seçili model için kullanılabilir anahtar yoktu → sessizce ücretsiz
         Pollinations'a geçildi (bkz. yukarıda "free-fallback"). Kullanıcı
         bunu hiç fark edemiyordu; akış başlarken açıkça bildir. */
      if (noKeyFallback) {
        safe.enqueue(encoder.encode(`data: ${JSON.stringify({
          fallback_event: { provider, model, reason: "no_key", requestedProvider, requestedModel },
        })}\n\n`));
      }
      /* Turlar boyunca biriken tam yanıt metni — dayanıklılık kaydı bunu yazar. */
      let fullContent = "";
      let lastFinishReason: string | null = null;
      const MAX_ROUNDS = 25;
      /* İstek başına dosya-okuma önbelleği: aynı dosya tekrar çekilmez. */
      const readCache = new Map<string, string>();
      const realUsage = { prompt: 0, completion: 0 };
      /* Seçili aday: ilk turda fallback adayları sırayla denenir; ilki başarılı
         olunca tüm sohbet o sağlayıcıya sabitlenir (tutarlı tool-call durumu). */
      let chosen: Candidate | null = null;
      /* Kimlik bloğunu O ADAY için üretip system bloğunun HEMEN ARDINA koyar
         (kullanıcı mesajlarından önce). Böylece yanıtı kim veriyorsa kimliği
         de o söyler; zincir başka bir modele düşünce kimlik onunla birlikte
         değişir. Ayrı bir system mesajı olarak eklenir çünkü:
         • pruneMessages mesaj SİLMEZ (yalnız uzun içeriği kırpar) → blok
           uzun sohbetlerde de hayatta kalır;
         • Anthropic native yolu her system mesajını KENDİ bloğuna çevirir
           (bkz. anthropic.ts convertMessages) → orada da doğru iletilir;
         • sysPrompt'un büyük ve turlar arası SABİT gövdesine dokunmaz →
           Anthropic prompt caching bozulmaz. */
      const withIdentity = (msgs: ChatRequest["messages"], c: Candidate): ChatRequest["messages"] => {
        const out = msgs.slice();
        out.splice(systemMessages.length, 0, {
          role: "system",
          content: buildIdentityPrompt(c.provider, c.model),
        });
        return out;
      };
      const toolBodyFor = (c: Candidate, lastRound: boolean) => ({
        /* Bağlam yönetimi: eski/büyük tool çıktılarını kırp (yapı korunur). */
        messages: pruneMessages(withIdentity(convo, c), { keepRecent: 16, maxContentChars: 12000 }),
        extra: {
          tools: allTools,
          tool_choice: lastRound ? "none" : "auto",
          ...(!KEYLESS_CHAT_PROVIDERS.has(c.provider) ? { stream_options: { include_usage: true } } : {}),
        },
      });
      /* ask_user çağrıldığında tool-loop kırılır → kullanıcı yanıtı beklenir. */
      let askUserCalled = false;
      /* deep_research'ün döndürdüğü atıflı raporun bir SONRAKİ turda modelce
         özetlenip/kısaltılıp atıfların kaybolmaması için: rapor geldikten
         hemen sonraki tur zorla tool_choice:"none" olur (model yalnızca
         raporu ilet/çerçevele, yeni araç çağırmasın). */
      let forceNoToolsNextRound = false;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const lastRound = round === MAX_ROUNDS - 1 || forceNoToolsNextRound;
        forceNoToolsNextRound = false;
        let upstream: Response | null = null;

        if (chosen) {
          /* Sonraki turlar: yalnızca seçili adayı kullan (sohbet ortasında
             sağlayıcı değiştirmek tool-call durumunu bozabilir). */
          try {
            const { messages: msgs, extra } = toolBodyFor(chosen, lastRound);
            upstream = await openCandidate(chosen, msgs, extra);
          } catch (err) {
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**Bağlantı hatası:** ${(err as Error).message}` } }] })}\n\n`));
            break;
          }
          if (!upstream.ok || !upstream.body) {
            const detail = await upstream.text().catch(() => "");
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**${friendlyApiError(upstream.status, detail, { model: chosen.model, provider: chosen.provider as Provider })}**` } }] })}\n\n`));
            break;
          }
        } else {
          /* İlk tur: henüz hiç byte yazılmadı → adayları sırayla güvenle dene. */
          let lastStatus = 502, lastDetail = "", lastCand = primary;
          for (const c of tryOrder) {
            let r: Response;
            try {
              const { messages: msgs, extra } = toolBodyFor(c, lastRound);
              r = await openCandidate(c, msgs, extra);
            } catch (err) {
              markProviderDown(c.provider, c.baseUrl, c.model);
              lastStatus = 502; lastDetail = (err as Error).message; lastCand = c; continue;
            }
            if (r.ok && r.body) { markProviderUp(c.provider, c.baseUrl, c.model); chosen = c; upstream = r; break; }
            lastStatus = r.status || 500;
            if (isProviderFault(lastStatus)) markProviderDown(c.provider, c.baseUrl, c.model);
            lastDetail = await r.text().catch(() => ""); lastCand = c;
            /* G1 — DÜRÜSTLÜK KAPISI. Yedek zinciri ULAŞILABİLİRLİK arızaları
               içindir (kota/yetki/sunucu/bağlantı): "istek asla düşmez" sözü
               budur. Kullanıcının SEÇTİĞİ model bir YETENEK hatası (400/422 —
               ör. araç çağırmayı/JSON modunu desteklemiyor) YA DA MODEL
               KONFİGÜRASYON hatası (404/410 — model adı yanlış ya da
               kullanımdan kaldırılmış; canlı NVIDIA testiyle doğrulandı: bir
               model emekliye ayrılınca tam 410 dönüyor) verdiğinde sessizce
               başka bir modele geçmek kullanıcıyı yanıltıyordu: yanıt
               seçtiğini sandığı modelden gelmiyor, üstelik "bu model artık
               yok" demek yerine her mesajda yeniden deneyip başka model
               devraldığı için sorun HİÇ ÇÖZÜLMEDEN sürekli tekrarlanıyordu —
               kullanıcının "model çok bekletiyor, farklı modele geçiyor"
               şikâyetinin doğrudan sebebiydi. Artık zincir burada kırılır ve
               aşağıdaki friendlyApiError kullanıcıya NE olduğunu (ve model
               listesini güncellemesi gerektiğini) dürüstçe söyler. Yalnız
               BİRİNCİL model için: zaten yedeğe düşülmüşse dayanıklılık
               öncelikli, sıradaki aday denenmeye devam eder. */
            if ((isCapabilityFault(lastStatus) || isModelGoneFault(lastStatus)) && c === primary) break;
          }
          if (!upstream) {
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**${friendlyApiError(lastStatus, lastDetail, { model: lastCand.model, provider: lastCand.provider as Provider })}**` } }] })}\n\n`));
            break;
          }
          if (chosen !== primary) {
            /* Bir fallback'e geçildi → kullanıcı şeffaflık için bilgilendirilir. */
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ fallback_event: { provider: chosen!.provider, model: chosen!.model } })}\n\n`));
          }
        }

        const { content, toolCalls, finishReason, usage } = await streamRound(upstream, safe, encoder);
        fullContent += content;
        if (finishReason) lastFinishReason = finishReason;
        if (usage) {
          /* prompt = en güncel turun bağlam boyutu; completion = turların toplamı. */
          realUsage.prompt = usage.prompt || realUsage.prompt;
          realUsage.completion += usage.completion;
          safe.enqueue(encoder.encode(`data: ${JSON.stringify({ usage_event: { prompt: realUsage.prompt, completion: realUsage.completion } })}\n\n`));
        }

        /* Araç çağrısı VARSA onları çalıştır — finishReason'a bakma. Bazı OpenAI-
           uyumlu sağlayıcılar tool_calls yayıp finish_reason:"stop" (veya boş)
           gönderiyor; eski `|| finishReason==="stop"` koşulu bu durumda çağrıları
           çalıştırMADAN kırılıp istenen eylemi sessizce düşürüyordu. Yalnız HİÇ
           araç yoksa bitir. */
        if (toolCalls.length === 0) {
          /* Bitiş nedenini istemciye ilet: "length" ⇒ yanıt token sınırında
             kesildi → istemci kesilme şeridi gösterir / otomatik devam eder. */
          if (finishReason && finishReason !== "tool_calls") {
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ finish_event: { reason: finishReason } })}\n\n`));
          }
          break;
        }

        /* Append assistant turn with tool calls */
        convo.push({
          role: "assistant",
          content: content || "",
          tool_calls: toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        });

        /* Araç çağrılarını yürüt: OKUMALAR paralel (hız), YAZMALAR sıralı
           (aynı dosyaya eşzamanlı yazıp veri kaybını önlemek için). start
           olayları önce; tool mesajları orijinal sırada (tool_call_id eşleşir). */
        for (const tc of toolCalls) {
          safe.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "start", id: tc.id, name: tc.name, arguments: tc.arguments } })}\n\n`),
          );
        }
        const MUTATING = new Set(["write_file", "str_replace"]);
        const resultById = new Map<string, string>();
        /* Tur başına tek-commit buffer: tüm write_file/str_replace bu Map'e eklenir,
           tur sonunda tek bir atomik commit olarak kaydedilir. */
        const roundWrites = new Map<string, WriteEntry>();

        const runOne = async (tc: AccumulatedToolCall) => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.arguments || "{}"); } catch { /* invalid */ }
          /* dispatch_agents: ana ajan görevi paralel SALT-OKUNUR alt-ajanlara
             böler (Claude'daki Task aracı gibi). Sonuçlar birleştirilip döner. */
          if (tc.name === "dispatch_agents") {
            const tasks = Array.isArray(args.tasks)
              ? (args.tasks as { title?: string; instruction?: string }[])
                  .filter((t) => t && typeof t.instruction === "string" && t.instruction.trim())
                  .slice(0, 4)
              : [];
            const fail = (m: string) => {
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: m } })}\n\n`));
              resultById.set(tc.id, m);
            };
            /* Depo şartı KALDIRILDI: alt-ajanlar depo yokken salt-okunur repo
               araçları olmadan çalışır (bkz. runReadOnlyAgent'ın null ctx dalı),
               tıpkı /api/orchestrate işçilerinin yaptığı gibi. Önceden hem burada
               hem istemcideki autoPilot'ta kapı vardı ve ikisi birlikte "ajan
               ekibi hiç çalışmıyor" belirtisini üretiyordu. */
            if (tasks.length === 0) { fail("Hata: en az 1 alt görev (tasks) gerekli"); return; }
            /* Alt-ajanlar seçili adayın (fallback'e geçilmişse onun) ucunu kullanır.
               apiKey de veriliyor (J1) — provider "anthropic" ise runReadOnlyAgent
               bunu anthropicUpstream'e (native uç) geçirmek için kullanır. */
            const sc = chosen ?? primary;
            const subCfg = { baseUrl: sc.baseUrl, model: sc.model, provider: sc.provider as Provider, headers: buildCandidateHeaders(sc, req), apiKey: sc.apiKey };

            /* "Ajan Ekibi" paneli deep_research ile AYNI swarm_event şemasını
               dinliyor (SwarmPanel). Önceden dispatch_agents yalnız tool_event
               yayıyordu → ajan ekibi çalışsa bile kullanıcı çalıştığını
               GÖREMİYORDU. Artık planlama → çalışma → bitiş adımları yayılıyor. */
            const agents: SwarmAgentState[] = tasks.map((t) => ({
              title: t.title || "Alt görev",
              role: "alt-ajan",
              status: "running",
            }));
            const emitSwarm = (phase: "planning" | "working" | "synthesizing" | "done") =>
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ swarm_event: { kind: "swarm", phase, agents } })}\n\n`));
            emitSwarm("working");

            const results = await Promise.all(tasks.map(async (t, i) => {
              try {
                const out = await runReadOnlyAgent(subCfg, [
                  { role: "system", content: "Sen uzman, son derece yetenekli bir alt-ajansın — ana modelin tüm kapasitesini kullan. Yöntem: (1) görevi kısaca planla, (2) gereken dosyaları read_file/list_files/grep ile KENDİN incele (varsayma, doğrula), (3) bulgularını dosya/satır kanıtına dayandır, (4) sonucu sunmadan önce kendi çıktını gözden geçir (öz-doğrulama). SADECE verilen alt göreve odaklan; NET, uygulanabilir, kanıtlı bir sonuç döndür. Uydurma — emin değilsen belirt. Türkçe yaz." + (repoCtx ? "" : " Bu görevde bağlı bir depo YOK; dosya araçların yok, kendi bilginle yanıtla ve dosya içeriği uydurma.") },
                  { role: "user", content: `ALT GÖREV: ${t.title || ""}\n${t.instruction}` },
                ], repoCtx ?? null);
                agents[i] = { ...agents[i], status: "done", output: out };
                emitSwarm("working");
                return out;
              } catch (e) {
                const msg = `(hata: ${(e as Error).message})`;
                agents[i] = { ...agents[i], status: "error", output: msg };
                emitSwarm("working");
                return msg;
              }
            }));
            emitSwarm("done");
            const combined = tasks.map((t, i) => `### ${t.title || "Alt görev"}\n${results[i]}`).join("\n\n");
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: `${tasks.length} alt-ajan tamamlandı` } })}\n\n`));
            resultById.set(tc.id, combined);
            return;
          }
          /* generate_image: doğal dilden ("bana X görseli yap") tetiklenen görsel
             üretimi. Faz 6 (kullanıcı kararı): bu TEK araç repo bağlı OLMASA da
             çalışır. ÖNCELİK: istemci bir BYOK görsel sağlayıcısı çözdüyse
             (Ayarlar → Model → Görsel üretimi tercihi, bkz. body.imageModel)
             önce ONU dene — kullanıcının aktif sohbet modeli neyse görsel
             üretiminin sessizce hep Pollinations'a düşmesi kafa karıştırıcıydı
             ("Model X seçili ama Pollinations kullanılıyor" raporu). BYOK
             yoksa/başarısız olursa anahtarsız Pollinations tabanına düş — aynı,
             kanıtlanmış URL kurucusu (/gorsel komutuyla BİREBİR aynı pipeline). */
          if (tc.name === "generate_image") {
            const prompt = String(args.prompt ?? "").trim();
            const fail = (m: string) => {
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: m } })}\n\n`));
              resultById.set(tc.id, m);
            };
            if (!prompt) { fail("Hata: prompt gerekli"); return; }
            const DIMENSIONS: Record<string, { width: number; height: number }> = {
              square: { width: 1024, height: 1024 },
              landscape: { width: 1280, height: 768 },
              portrait: { width: 768, height: 1280 },
            };
            const dims = DIMENSIONS[String(args.aspect_ratio ?? "square")] ?? DIMENSIONS.square;
            /* Görselin KENDİSİ (URL ya da data-URL). Eskiden burada hazır bir
               `![...](...)` markdown'ı tutuluyordu ve o markdown ARAÇ SONUCU
               olarak modele geri veriliyordu — aşağıdaki nota bak. */
            let imageUrl: string | null = null;
            /* Hangi sağlayıcının ürettiği araç kartında GÖRÜNÜR olsun —
               "Model X seçili ama Pollinations kullanılıyor" şüphesi ancak
               böyle kesin cevap bulur. */
            let usedLabel = "";
            /* BYOK adayları: istemci tam zinciri yolladıysa hepsi sırayla
               denenir (Ayarlar → Görsel üretimi → "Yedek zinciri"), yoksa tek
               aday (eski davranış). */
            const imgCandidates = body.imageModels?.length
              ? body.imageModels
              : (body.imageModel?.provider && body.imageModel?.apiKey ? [body.imageModel] : []);
            for (const cand of imgCandidates) {
              if (!cand?.provider || !cand?.apiKey) continue;
              try {
                const byokRes = await fetch(`${ownOrigin}/api/image`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    provider: cand.provider,
                    apiKey: cand.apiKey,
                    prompt,
                    size: `${dims.width}x${dims.height}`,
                    /* Kullanıcının Ayarlar'da seçtiği görsel modeli (varsa) —
                       /api/image bunu katalog karşısında doğrular. */
                    model: cand.model,
                  }),
                  signal: AbortSignal.timeout(70_000),
                });
                const byokData = await byokRes.json().catch(() => ({})) as { image?: string; error?: string };
                if (byokRes.ok && byokData.image) {
                  imageUrl = byokData.image;
                  usedLabel = cand.provider;
                  break;
                }
              } catch { /* bu aday olmadı → sıradakini dene */ }
            }
            if (!imageUrl) {
              /* Anahtarsız Pollinations tabanı — ama artık DOĞRULANARAK.
                 ÖNCEDEN yalnızca bir URL METNİ kuruluyordu (pollinationsImageUrl
                 hiç ağa çıkmaz): araç 255 ms'de "Görsel üretildi" diyor, model
                 "işte görselin" yazıyor, gerçek üretim ise tarayıcı <img>'i
                 yüklerken başlıyordu. Pollinations yavaş/dolu olduğunda
                 kullanıcı uzun uzun bekleyip KIRIK bir görsel görüyordu —
                 üstelik hem araç hem model başarı bildirmiş oluyordu.
                 Artık görsel BURADA çekilir ve veri-URL'i olarak gömülür:
                 kullanıcının gördüğü şey, doğrulanmış olan şeydir. */
              try {
                const url = pollinationsImageUrl(prompt, { ...dims, seed: stableSeed(prompt) });
                const pRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
                const ctype = (pRes.headers.get("content-type") ?? "").split(";")[0];
                if (pRes.ok && ctype.startsWith("image/")) {
                  const buf = Buffer.from(await pRes.arrayBuffer());
                  /* Çok büyük çıktıyı mesaj geçmişine gömmek depolamayı şişirir;
                     sınırın üstündeyse URL'e düşülür — o hâlde bile ucun AYAKTA
                     olduğunu doğrulamış oluruz. */
                  imageUrl = buf.byteLength <= 4_000_000
                    ? `data:${ctype};base64,${buf.toString("base64")}`
                    : url;
                  usedLabel = "pollinations (ücretsiz taban)";
                }
              } catch { /* aşağıda dürüst hata bildirilir */ }
            }
            if (!imageUrl) {
              /* G1 — dürüstlük: üretemediysek "üretildi" DEMEYİZ. Model bu
                 sonucu görüp kullanıcıya doğru olanı söyler. */
              fail(
                "Görsel üretilemedi: görsel sağlayıcılarının hiçbiri (anahtarsız taban dahil) " +
                "yanıt vermedi. Kullanıcıya görseli ÜRETEMEDİĞİNİ açıkça söyle, başarılı gibi " +
                "anlatma; Ayarlar → Model → Görsel üretimi'nden bir sağlayıcı eklemesini ya da " +
                "birazdan tekrar denemesini öner.",
              );
              return;
            }
            /* KRİTİK (kullanıcı hata raporu, Tem 2026 — ekran görüntüsü):
               görsel ARTIK modele GERİ VERİLMİYOR. Eskiden araç sonucu hazır
               bir `![...](url)` markdown'ıydı ve sistem promptu modele "bunu
               yanıtına göm" diyordu. Kısa bir Pollinations URL'iyle bu
               çalışıyordu; ama hem BYOK sağlayıcılar hem de (artık doğrulanmış
               indirme yapan) Pollinations yolu bir DATA-URL döndürüyor —
               yüz binlerce token'lık base64. Model onu token token kopyalamaya
               çalışıp yarıda kesiyor ve sohbete ham
               "![...](data:image/jpeg;base64,/9j/4QPARX…" çöpü dökülüyordu;
               üstelik bağlam penceresi de tükeniyordu.
               Artık görsel AYRI bir olayla doğrudan istemciye gider ve son
               asistan mesajının `images[]` alanına iliştirilir (MessageBubble'ın
               GeneratedImage önizlemesi — "/gorsel" komutunun ZATEN kullandığı
               aynı yol); modele yalnız kısa, düz metin bir onay döner. */
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({
              image_event: { id: tc.id, url: imageUrl, prompt, provider: usedLabel },
            })}\n\n`));
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: `Görsel üretildi${usedLabel ? ` · ${usedLabel}` : ""}` } })}\n\n`));
            resultById.set(
              tc.id,
              /* Metnin KENDİSİ de örnek içermemeli: modele "![...]" ya da
                 "base64" gibi bir kalıp göstermek onu kopyalamaya davet eder. */
              `Görsel başarıyla üretildi ve kullanıcıya GÖSTERİLDİ (istek: "${prompt.slice(0, 120)}").` +
              " Görsel arayüzde zaten görünüyor; yanıtında görsel etiketi, bağlantı ya da ham veri" +
              " TEKRARLAMA. Yalnızca bir-iki cümleyle kısaca tanıt.",
            );
            return;
          }
          /* deep_research: doğal dilden ("şu konuyu derinlemesine araştır")
             tetiklenen çok-kaynaklı araştırma — Faz 1'de çıkarılan SAF
             pipeline'ı (researchPipeline.ts) burada da kullanır; ilerleme
             AYNI swarm_event(kind:"research") şemasıyla yollanır, istemcinin
             ZATEN sahip olduğu "Ajan Ekibi" paneli hiç değişmeden render eder. */
          if (tc.name === "deep_research") {
            const topic = String(args.topic ?? "").trim();
            const fail = (m: string) => {
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: m } })}\n\n`));
              resultById.set(tc.id, m);
            };
            if (!repoCtx) { fail("Hata: repo bağlı değil"); return; }
            if (!topic) { fail("Hata: topic gerekli"); return; }
            const sc = chosen ?? primary;
            const subCfg = { baseUrl: sc.baseUrl, model: sc.model, provider: sc.provider as Provider, headers: buildCandidateHeaders(sc, req) };
            try {
              const report = await runDeepResearch(subCfg, topic, body.systemPrompt || DEFAULT_SYSTEM_PROMPT, {
                onPhase: (phase, agents) => safe.enqueue(encoder.encode(`data: ${JSON.stringify({ swarm_event: { kind: "research", phase, agents } })}\n\n`)),
              });
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: "Araştırma tamamlandı" } })}\n\n`));
              resultById.set(tc.id, report);
              forceNoToolsNextRound = true;
            } catch (e) {
              fail(`Hata: ${(e as Error).message}`);
            }
            return;
          }
          /* Yıkıcı işlemler (silme/yeniden adlandırma): ASLA doğrudan yapılmaz.
             Kullanıcı onayına sunulur; istemci onaylarsa uygular. */
          if (tc.name === "delete_file" || tc.name === "rename_file") {
            const path = String(args.path ?? "");
            const newPath = tc.name === "rename_file" ? String(args.new_path ?? "") : undefined;
            const reason = args.reason ? String(args.reason) : undefined;
            if (!path || (tc.name === "rename_file" && !newPath)) {
              const msg = "Hata: gerekli yol(lar) eksik";
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: msg } })}\n\n`));
              resultById.set(tc.id, msg);
              return;
            }
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ pending_action_event: { id: tc.id, kind: tc.name === "delete_file" ? "delete" : "rename", path, newPath, reason } })}\n\n`));
            const note = tc.name === "delete_file"
              ? `⏸ '${path}' silme önerisi kullanıcı onayına sunuldu. Kullanıcı onaylayana kadar dosya DURUYOR; buna güvenerek devam etme.`
              : `⏸ '${path}' → '${newPath}' yeniden adlandırma önerisi kullanıcı onayına sunuldu.`;
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`));
            resultById.set(tc.id, note);
            return;
          }
          /* check_command / stop_command — arka plandaki komudu sonradan
             okumak/durdurmak (Claude Code'un BashOutput/KillShell karşılığı).
             Yalnız köprü modunda anlamlı: WebContainer/uzak-WS yolunda komut
             zaten istemcide çalışır ve çıktısı ayrı mesajla döner. */
          if (tc.name === "check_command" || tc.name === "stop_command") {
            const taskId = String(args.task_id ?? "").trim();
            const emit = (result: string) => {
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result } })}\n\n`));
              resultById.set(tc.id, result);
            };
            if (!repoCtx || repoCtx.provider !== "local" || !repoCtx.bridgeUrl) {
              emit("Bu araç yalnız çalışma alanı sunucusu (köprü) bağlıyken kullanılabilir.");
              return;
            }
            if (!taskId) { emit("Hata: task_id zorunlu."); return; }
            try {
              if (tc.name === "stop_command") {
                emit(await stopCommandViaBridge(repoCtx, taskId));
                return;
              }
              const r = await checkCommandViaBridge(repoCtx, taskId);
              const out = redactSecrets(r.output || "(çıktı yok)").slice(-8000);
              emit(
                r.status === "running"
                  ? `⏳ Görev ${taskId} hâlâ çalışıyor. Şimdiye kadarki çıktı:\n${out}`
                  : `✅ Görev ${taskId} bitti (durum: ${r.status}${typeof r.exitCode === "number" ? `, exit: ${r.exitCode}` : ""}).\n${out}`,
              );
            } catch (e) {
              emit(`Hata: ${(e as Error).message}`);
            }
            return;
          }
          if (tc.name === "run_command") {
            const command = String(args.command ?? "").trim();
            /* Köprüde gerçek /exec varsa DOĞRUDAN sunucudan çalıştır — telefon/
               tarayıcı arka planda olsa da devam eder (bkz. execCommandViaBridge). */
            if (repoCtx && repoCtx.provider === "local" && repoCtx.bridgeUrl) {
              try {
                const r = await execCommandViaBridge(repoCtx, command);
                /* Token, klon URL'sine gömülü olduğu için `git remote -v` gibi
                   bir komut çıktısında görünebilir — ekrana/geçmişe gitmeden
                   maskele (bkz. redactSecrets, aynı desen mesaj gösteriminde
                   de kullanılıyor). */
                const out = redactSecrets(r.output || "(çıktı yok)").slice(0, 8000);
                const note = r.done
                  ? `$ ${command}\n${out}${typeof r.exitCode === "number" && r.exitCode !== 0 ? `\n[exit: ${r.exitCode}]` : ""}`
                  /* Görev kimliğini MUTLAKA bildir: ajan sonradan check_command
                     ile çıktıyı okuyabilsin, stop_command ile durdurabilsin.
                     Bu olmadan komut başlatılıp körleşiliyordu. */
                  : `⏳ '${command}' sunucuda arka planda çalışmaya DEVAM EDİYOR (telefon kilitlense/kapansa bile durmaz).\n` +
                    `Görev kimliği: ${r.taskId}\n` +
                    `Devamını görmek için check_command("${r.taskId}"), durdurmak için stop_command("${r.taskId}").\n` +
                    `Şimdiye kadarki çıktı:\n${out}`;
                safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`));
                resultById.set(tc.id, note);
              } catch (e) {
                const note = `Hata: köprüde komut çalıştırılamadı — ${(e as Error).message}`;
                safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`));
                resultById.set(tc.id, note);
              }
              return;
            }
            /* Köprü yok (WebContainer/uzak WS terminal): eski yol — istemciye
               olay olarak yolla, çıktı yeni bir mesaj olarak geri gelsin
               (craftai:terminal-output → callApi). Bu turda placeholder döner. */
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ run_command_event: { command } })}\n\n`));
            const note = `⏳ '${command}' komutu terminale gönderildi. Çıktısı ayrı bir mesaj olarak gelecek; ona göre devam et.`;
            safe.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`),
            );
            resultById.set(tc.id, note);
            return;
          }
          /* run_code (L1 — analiz aracı): kod SUNUCUDA çalıştırılmaz (LLM'in
             ürettiği kodu kendi sunucumuzda çalıştırmak env/iç ağ erişimi
             demek olurdu). run_command ile AYNI desen: kodu istemciye olay
             olarak yolla, o tarayıcıda izole çalıştırıp çıktıyı ayrı bir
             mesaj olarak geri beslesin. Bu turda placeholder sonuç döner. */
          if (tc.name === "run_code") {
            const language = String(args.language ?? "").toLowerCase().startsWith("py") ? "python" : "javascript";
            const code = String(args.code ?? "");
            const fail = (m: string) => {
              safe.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: m } })}\n\n`));
              resultById.set(tc.id, m);
            };
            if (!code.trim()) { fail("Hata: code gerekli"); return; }
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ run_code_event: { language, code } })}\n\n`));
            const note = `⏳ ${language} kodu kullanıcının tarayıcısında çalıştırılıyor. Çıktısı ayrı bir mesaj olarak gelecek; ona göre devam et.`;
            safe.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`),
            );
            resultById.set(tc.id, note);
            return;
          }
          /* ask_user: kullanıcıya tıklanabilir soru gönder, döngüyü kır.
             İstemci anketi gösterir; kullanıcı yanıtlar, yanıt yeni bir mesaj
             olarak gelir ve ajan oradan devam eder. */
          if (tc.name === "ask_user") {
            const questions = args.questions;
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ ask_user_event: { questions } })}\n\n`));
            const note = "⏳ Kullanıcıya soru(lar) soruldu — yanıt geldiğinde devam edilecek.";
            safe.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: note } })}\n\n`),
            );
            resultById.set(tc.id, note);
            askUserCalled = true;
            return;
          }
          /* update_plan: ağ/repo işi yok — planı istemciye ayrı olay olarak yolla. */
          if (tc.name === "update_plan") {
            const plan = String(args.plan ?? "");
            safe.enqueue(encoder.encode(`data: ${JSON.stringify({ plan_event: { plan } })}\n\n`));
            safe.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: "Plan güncellendi" } })}\n\n`),
            );
            resultById.set(tc.id, "Plan güncellendi.");
            return;
          }
          /* Checkpoint: yazma öncesi eski içeriği yakala (geri al için).
             getFileRaw readCache'i ısıtır → str_replace tekrar çekmez.
             Dosya yoksa ve write_file ile OLUŞTURULUYORSA previous: null
             gönderilir → istemcide geri al = dosyayı sil. */
          let prevContent: string | null | undefined;
          if ((tc.name === "write_file" || tc.name === "str_replace") && repoCtx && typeof args.path === "string") {
            /* Savunma derinliği: getFileRaw sertleştirildi ama yine de bir
               fırlatma (ağ/parse) BÜTÜN stream'i çökertmemeli — checkpoint
               yoksa geri-al kaybolur, üretim değil; yut ve devam et. */
            try {
              const old = await getFileRaw(repoCtx, args.path, readCache);
              if (old.ok) prevContent = old.content;
              else if (tc.name === "write_file") prevContent = null;
            } catch {
              if (tc.name === "write_file") prevContent = null;
            }
          }
          /* Yazma araçları → toplu commit buffer'ına ekle; diğerleri anında çalış. */
          const result = await executeTool(
            tc.name, args, repoCtx, activeMcpServers, readCache,
            MUTATING.has(tc.name) ? roundWrites : undefined,
            ownOrigin,
          );
          if (prevContent !== undefined && result.startsWith("✅") && typeof args.path === "string") {
            safe.enqueue(
              encoder.encode(`data: ${JSON.stringify({ checkpoint_event: { path: args.path, previous: prevContent } })}\n\n`),
            );
          }
          safe.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: result.slice(0, 400) + (result.length > 400 ? "…" : "") } })}\n\n`),
          );
          resultById.set(tc.id, result);
        };
        await Promise.all(toolCalls.filter((tc) => !MUTATING.has(tc.name)).map(runOne));
        for (const tc of toolCalls.filter((tc) => MUTATING.has(tc.name))) await runOne(tc);

        /* Toplu commit: turun tüm yazımlarını tek Git commit olarak kaydet. */
        if (roundWrites.size > 0 && repoCtx) {
          /* Commit mesajını tool argümanlarından topla; yoksa otomatik üret. */
          const commitMsg = toolCalls
            .filter((tc) => MUTATING.has(tc.name))
            .map((tc) => { try { return (JSON.parse(tc.arguments || "{}") as { commit_message?: string }).commit_message; } catch { return ""; } })
            .find((m) => m && m.trim())
            || (() => {
              const paths = [...roundWrites.keys()];
              return paths.length === 1
                ? `chore: update ${paths[0]}`
                : `chore: update ${paths.length} files (${paths.map((p) => p.split("/").pop()).join(", ")})`;
            })();
          const batchResult = await flushAtomicCommit(repoCtx, roundWrites, commitMsg);
          safe.enqueue(encoder.encode(`data: ${JSON.stringify({ batch_commit_event: { count: roundWrites.size, result: batchResult } })}\n\n`));
          /* Tool sonuçlarını gerçek commit bilgisiyle güncelle (AI sonraki turda görsün). */
          if (batchResult.startsWith("✅")) {
            for (const tc of toolCalls.filter((tc) => MUTATING.has(tc.name))) {
              const prev = resultById.get(tc.id) ?? "";
              if (prev.startsWith("✅")) {
                resultById.set(tc.id, prev.replace(" (toplu commit bekleniyor)", "") + ` → ${batchResult}`);
              }
            }
          }
        }
        for (const tc of toolCalls) {
          convo.push({ role: "tool", tool_call_id: tc.id, content: resultById.get(tc.id) ?? "" });
        }
        /* ask_user çağrıldıysa kullanıcı yanıtını bekle — döngüyü kır. */
        if (askUserCalled) break;
      }
      safe.enqueue(encoder.encode(`data: [DONE]\n\n`));
      try { controller.close(); } catch { /* istemci zaten gitmiş olabilir */ }

      /* Dayanıklılık: istemci akış bitmeden bağlantıyı kapattıysa (clientGone),
         nihai yanıtı sunucu kendi yazar + push bildirimi gönderir. Bağlantı
         hiç kopmadıysa istemcinin kendi persistCurrent()'ı zaten aynı işi
         (daha zengin meta veriyle) yapacağından burada HİÇBİR ŞEY yapılmaz —
         iki taraflı yazma/çakışma riski böylece tamamen ortadan kalkar. */
      if (durableChatId && durableSupabase && durableUser && clientGone && fullContent.trim()) {
        const chatId = durableChatId;
        const supabase = durableSupabase;
        const userId = durableUser.id;
        const content = fullContent.trim();
        const finishReason = lastFinishReason;
        after(async () => {
          try {
            const { data: row } = await supabase
              .from("chats")
              .select("messages, title")
              .eq("id", chatId)
              .eq("user_id", userId)
              .maybeSingle();
            if (!row) return;
            const messages = Array.isArray(row.messages) ? row.messages : [];
            const last = messages[messages.length - 1] as { role?: string; content?: string } | undefined;
            /* İstemci geri döndüyse ve zaten aynı yanıtı yazdıysa tekrar ekleme. */
            if (last?.role === "assistant" && last?.content === content) return;
            const assistantMsg = { role: "assistant", content, ...(finishReason ? { finishReason } : {}) };
            await supabase
              .from("chats")
              .update({ messages: [...messages, assistantMsg], updated_at: new Date().toISOString() })
              .eq("id", chatId);
            await sendPushToUser(supabase, userId, {
              title: row.title || "Yanıt hazır",
              body: content.slice(0, 120),
              url: "/app",
            });
          } catch { /* en kötü ihtimalle bu yanıt kaybolur — akış zaten kesikti */ }
        });
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
