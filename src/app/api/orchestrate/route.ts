import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";
import { buildContextSections, type SkillLike } from "@/lib/prompt";
import type { RepoReadCtx } from "@/lib/repoRead";
import { runReadOnlyAgent } from "@/lib/subagent";
import type { ChatMessage, MemoryItem, Provider, ResponseStyle } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────────────────────
   Çoklu-ajan orkestrasyonu (Claude Code tarzı).

   Akış:  Planlayıcı  →  Paralel işçi ajanlar (Promise.all)  →  Birleştirici
   - Eklenen HANGİ model seçiliyse onunla çalışır (modelden bağımsız).
   - Hiçbir model EĞİTİLMEZ; bu sadece iş bölümü + paralel yürütmedir.
   - İstemciye OpenAI-uyumlu SSE (`choices[].delta.content`) döner, böylece
     mevcut sohbet akış-ayrıştırıcısı değişmeden çalışır.
   ────────────────────────────────────────────────────────────────────────── */

interface OrchestrateRequest {
  messages: ChatMessage[];
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  systemPrompt?: string;
  effort?: "low" | "medium" | "high" | "max";
  style?: ResponseStyle;
  memories?: MemoryItem[];
  skills?: SkillLike[];
  searchContext?: string;
  repoCtx?: RepoReadCtx;
  /* İstemci /api/chat ile aynı gövdeyi yollar; orkestrasyonda işçiler zaten
     salt-okunurdur (yazma aracı yok) ama tutarlılık için kontrat eksiksiz. */
  requireWriteApproval?: boolean;
  planApprovalMode?: boolean;
  planApproved?: boolean;
  blockNetworkTools?: boolean;
}

const MAX_AGENTS = 4;

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

/* Sağlayıcıya göre header — /api/chat ile birebir aynı mantık. */
function buildHeaders(provider: Provider, apiKey: string, req: Request): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "anthropic") {
    h["anthropic-version"] = "2023-06-01";
    h["x-api-key"] = apiKey;
  } else if (apiKey) {
    h["Authorization"] = `Bearer ${apiKey}`;
  }
  if (provider === "openrouter") {
    h["HTTP-Referer"] = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai-web.vercel.app";
    h["X-Title"] = "Craft.Coder";
  }
  return h;
}

type Cfg = {
  baseUrl: string; model: string; provider: Provider;
  headers: Record<string, string>;
  effort?: "low" | "medium" | "high" | "max";
};

/* Efor → swarm çağrılarında da max_tokens + reasoning uygula (chat route ile aynı ölçek). */
const EFFORT_TOKENS = { low: 4096, medium: 8192, high: 16384, max: 32768 } as const;
function applyEffort(body: Record<string, unknown>, cfg: Cfg) {
  if (!cfg.effort) return;
  body.max_tokens = EFFORT_TOKENS[cfg.effort];
  if (cfg.provider === "openrouter") {
    body.reasoning = { effort: cfg.effort === "max" ? "high" : cfg.effort };
  }
}

/* Tek, akışsız (non-streaming) model çağrısı → düz metin döndürür. */
async function callModel(
  cfg: Cfg,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
): Promise<string> {
  const body: Record<string, unknown> = { model: cfg.model, messages, stream: false };
  if (cfg.provider === "pollinations") body.referrer = "craft-coder";
  applyEffort(body, cfg);
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST", headers: cfg.headers, body: JSON.stringify(body), signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Model hatası ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}


/* Akışlı model çağrısı → her delta'yı `send` ile istemciye yolla. */
async function streamModel(
  cfg: Cfg,
  messages: { role: string; content: string }[],
  send: (content: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const body: Record<string, unknown> = { model: cfg.model, messages, stream: true };
  if (cfg.provider === "pollinations") body.referrer = "craft-coder";
  applyEffort(body, cfg);
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST", headers: cfg.headers, body: JSON.stringify(body), signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    send(`\n\n**Birleştirme hatası ${res.status}:** ${detail.slice(0, 200)}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const c = json.choices?.[0]?.delta?.content;
        if (c) send(c);
      } catch { /* parçalı JSON — atla */ }
    }
  }
}

/* Uzman rol rehberi — her işçi ajan rolüne göre farklı sistem talimatı alır. */
const ROLE_GUIDE: Record<string, string> = {
  mimar: "Sen bir YAZILIM MİMARISIN. Tasarım, dosya/modül yapısı, arayüzler, veri akışı ve mimari kararlara odaklan. Somut bir tasarım/plan üret; gerekirse iskelet kod ver.",
  kodlayıcı: "Sen deneyimli bir GELİŞTİRİCİSİN. İstenen işlevi ÇALIŞAN, temiz kodla uygula. Tam kod blokları ver, kenar durumları ele al.",
  test: "Sen bir TEST MÜHENDİSİSİN. Kapsamlı test senaryoları yaz: mutlu yol, kenar durumlar, hata senaryoları. Uygun framework'le (Vitest/pytest vb.) çalışan test kodu ver.",
  inceleyici: "Sen kıdemli bir KOD İNCELEYİCİSİSİN. Bug, güvenlik açığı, performans sorunu ve kod kalitesi açısından titiz incele; her bulguya ciddiyet ve somut düzeltme öner.",
  araştırmacı: "Sen bir ARAŞTIRMACI AJANSIN. Kod tabanını/dış kaynakları keşfedip ilgili gerçekleri topla ve özetle. Bulgularını kanıta (dosya/satır) dayandır.",
  genel: "Sen uzman bir alt-ajansın. Sana verilen alt görevi eksiksiz, uygulanabilir biçimde tamamla.",
};
const VALID_ROLES = Object.keys(ROLE_GUIDE);
const ROLE_ICON: Record<string, string> = {
  mimar: "📐", kodlayıcı: "⌨️", test: "🧪", inceleyici: "🔍", araştırmacı: "🔬", genel: "⚙️",
};

/* Planlayıcı çıktısından JSON görevleri çıkar (kod bloğu/fazla metne dayanıklı). */
function parseTasks(raw: string): { title: string; role: string; instruction: string }[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { tasks?: { title?: string; role?: string; instruction?: string }[] };
    return (obj.tasks ?? [])
      .filter((t) => t && typeof t.instruction === "string" && t.instruction.trim())
      .slice(0, MAX_AGENTS)
      .map((t) => {
        const role = (t.role || "genel").trim().toLowerCase();
        return {
          title: (t.title || "Alt görev").trim(),
          role: VALID_ROLES.includes(role) ? role : "genel",
          instruction: t.instruction!.trim(),
        };
      });
  } catch { return []; }
}

export async function POST(req: Request) {
  if (!checkOrigin(req)) return new Response("Geçersiz origin", { status: 403 });

  let body: OrchestrateRequest;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek gövdesi", { status: 400 }); }

  const baseUrl = (body.baseUrl || process.env.LLM_BASE_URL || "https://router.huggingface.co/v1").replace(/\/$/, "");
  const model = body.model || process.env.LLM_MODEL || "";
  const apiKey = body.apiKey || process.env.LLM_API_KEY || "";
  const provider = (body.provider || "hf") as Provider;
  if (!model) return new Response("Model seçilmedi.", { status: 400 });
  if (!apiKey && provider !== "pollinations" && provider !== "ollama") {
    return new Response("API anahtarı yok.", { status: 400 });
  }

  const cfg: Cfg = { baseUrl, model, provider, headers: buildHeaders(provider, apiKey, req), effort: body.effort };
  /* Kullanıcı bağlamı (stil + hafıza + skills + arama) /api/chat ile aynı kaynaktan
     → nihai cevap (birleştirici / tek-ajan) bu kurallara uyar. */
  const baseSys = (body.systemPrompt || DEFAULT_SYSTEM_PROMPT) + buildContextSections({
    style: body.style,
    memories: body.memories,
    skills: body.skills,
    searchContext: body.searchContext,
  });

  /* Paylaşılan bağlam: son birkaç mesaj (dosya içerikleri istemci tarafından
     zaten mesajlara enjekte edilmiş olur). Çok uzamasın diye son 6 mesaj. */
  const history = (body.messages || []).filter((m) => m.role === "user" || m.role === "assistant");
  const shared = history.slice(-6).map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) }));
  const userTask = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const ac = new AbortController();
      const signal = ac.signal;
      req.signal.addEventListener("abort", () => ac.abort(), { once: true });
      const send = (content: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
      const done = () => { controller.enqueue(encoder.encode(`data: [DONE]\n\n`)); controller.close(); };

      try {
        /* ── 1) PLANLAMA ── */
        send("🧠 **Ajan ekibi görevi planlıyor…**\n\n");
        const planSys =
          `Sen bir baş planlayıcı ajansın. Kullanıcının isteğini, PARALEL ve BAĞIMSIZ ` +
          `çalışabilecek (birbirine bağımlı olmayan) en fazla ${MAX_AGENTS} alt göreve böl. ` +
          `Her alt göreve en uygun UZMAN ROLÜ ata. Roller: ` +
          `mimar (tasarım/mimari), kodlayıcı (uygulama), test (test yazımı), ` +
          `inceleyici (bug/güvenlik/performans denetimi), araştırmacı (keşif/analiz), genel. ` +
          `Görev küçükse veya bölmeye değmezse TEK görev döndür. ` +
          `SADECE şu JSON ile yanıt ver, başka hiçbir şey yazma:\n` +
          `{"tasks":[{"title":"kısa başlık","role":"kodlayıcı","instruction":"o ajana net, bağımsız talimat"}]}`;
        const planRaw = await callModel(cfg, [
          { role: "system", content: planSys },
          ...shared,
          { role: "user", content: `İstek:\n${String(userTask).slice(0, 4000)}\n\nBunu paralel alt görevlere böl ve JSON döndür.` },
        ], signal);
        const tasks = parseTasks(planRaw);

        /* ── Tek görev / plan başarısız → doğrudan tek ajanla cevapla ── */
        if (tasks.length <= 1) {
          send("Tek ajan yeterli, doğrudan cevaplıyorum.\n\n---\n\n");
          await streamModel(cfg, [{ role: "system", content: baseSys }, ...shared], send, signal);
          done();
          return;
        }

        send(
          `**Plan — ${tasks.length} uzman ajan:**\n` +
          tasks.map((t, i) => `${i + 1}. ${ROLE_ICON[t.role] ?? "⚙️"} _${t.role}_ — ${t.title}`).join("\n") +
          `\n\n⚙️ Ajanlar paralel çalışıyor…\n\n`,
        );

        /* ── 2) PARALEL UZMAN İŞÇİ AJANLAR ── */
        const repoCtx = body.repoCtx;
        const results = await Promise.all(
          tasks.map(async (t) => {
            /* Rol-özel sistem prompt'u → her ajan kendi uzmanlığıyla çalışır. */
            const workerSys =
              `${ROLE_GUIDE[t.role] ?? ROLE_GUIDE.genel} ` +
              `SADECE sana verilen alt göreve odaklan; diğer alt görevleri YAPMA. ` +
              `Net, uygulanabilir sonuç üret (gerekiyorsa kod blokları). Türkçe yaz.` +
              (repoCtx ? ` Gerekirse read_file/list_files/grep araçlarıyla repoyu kendin incele.` : ``);
            const wmsgs = [
              { role: "system", content: workerSys },
              ...shared,
              { role: "user", content: `ALT GÖREVİN (${t.role}): ${t.title}\n\n${t.instruction}` },
            ];
            try {
              /* repoCtx varsa işçi salt-okunur araçlarla repoyu kendi gezer
                 (tam alt-ajan paritesi); yoksa düz çağrı. */
              const r = repoCtx
                ? await runReadOnlyAgent(cfg, wmsgs, repoCtx, signal)
                : await callModel(cfg, wmsgs, signal);
              send(`✅ ${ROLE_ICON[t.role] ?? "⚙️"} ${t.role} ajanı tamam — ${t.title}\n`);
              return r;
            } catch (e) {
              send(`⚠️ ${t.role} ajanı hata verdi — ${t.title}\n`);
              return `(Bu alt görev tamamlanamadı: ${(e as Error).message})`;
            }
          }),
        );

        /* ── 3) BİRLEŞTİRME (akışlı) ── */
        send(`\n🧩 **Sonuçlar birleştiriliyor…**\n\n---\n\n`);
        const synthSys =
          `Sen baş ajansın. Alt ajanların sonuçlarını TEK, tutarlı ve eksiksiz bir cevapta ` +
          `birleştir: tekrarları temizle, çelişkileri çöz, mantıklı sıraya koy. Kullanıcının ` +
          `orijinal isteğine doğrudan cevap ver. Alt ajanlardan/süreçten bahsetme, yalnızca ` +
          `nihai sonucu sun. Türkçe yaz.\n\n${baseSys}`;
        const combined = tasks
          .map((t, i) => `### ${ROLE_ICON[t.role] ?? "⚙️"} ${t.title} (${t.role})\n${results[i]}`)
          .join("\n\n");
        await streamModel(cfg, [
          { role: "system", content: synthSys },
          ...shared,
          { role: "user", content: `Alt ajanların sonuçları aşağıda. Bunları birleştirip orijinal isteğe nihai cevabı ver:\n\n${combined}` },
        ], send, signal);

        done();
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          send(`\n\n**Orkestrasyon hatası:** ${(e as Error).message}`);
        }
        done();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
