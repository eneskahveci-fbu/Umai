import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";
import { buildContextSections, type SkillLike } from "@/lib/prompt";
import { READONLY_TOOLS, executeReadTool, type RepoReadCtx } from "@/lib/repoRead";
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
  style?: ResponseStyle;
  memories?: MemoryItem[];
  skills?: SkillLike[];
  searchContext?: string;
  repoCtx?: RepoReadCtx;
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
};

/* Tek, akışsız (non-streaming) model çağrısı → düz metin döndürür. */
async function callModel(
  cfg: Cfg,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
): Promise<string> {
  const body: Record<string, unknown> = { model: cfg.model, messages, stream: false };
  if (cfg.provider === "pollinations") body.referrer = "craft-coder";
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

/* Araçlı (salt-okunur) işçi çağrısı: model repoyu kendi okuyabilir. Bounded
   tool-use döngüsü (en çok MAX_TOOL_ROUNDS tur). repoCtx yoksa düz callModel. */
const MAX_TOOL_ROUNDS = 4;
async function callModelWithReadTools(
  cfg: Cfg,
  messages: { role: string; content: string }[],
  ctx: RepoReadCtx,
  signal: AbortSignal,
): Promise<string> {
  type Msg = { role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string };
  const convo: Msg[] = [...messages];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: convo,
      stream: false,
      tools: READONLY_TOOLS,
      tool_choice: round === MAX_TOOL_ROUNDS - 1 ? "none" : "auto",
    };
    if (cfg.provider === "pollinations") body.referrer = "craft-coder";
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST", headers: cfg.headers, body: JSON.stringify(body), signal,
    });
    if (!res.ok) throw new Error(`Model hatası ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json() as {
      choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    };
    const msg = data.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls ?? [];
    if (toolCalls.length === 0) return msg?.content?.trim() ?? "";
    convo.push({ role: "assistant", content: msg?.content ?? "", tool_calls: toolCalls });
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
      const result = await executeReadTool(tc.function.name, args, ctx);
      convo.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  return "(İşçi ajan tur sınırına ulaştı.)";
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

/* Planlayıcı çıktısından JSON görevleri çıkar (kod bloğu/fazla metne dayanıklı). */
function parseTasks(raw: string): { title: string; instruction: string }[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { tasks?: { title?: string; instruction?: string }[] };
    return (obj.tasks ?? [])
      .filter((t) => t && typeof t.instruction === "string" && t.instruction.trim())
      .slice(0, MAX_AGENTS)
      .map((t) => ({ title: (t.title || "Alt görev").trim(), instruction: t.instruction!.trim() }));
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

  const cfg: Cfg = { baseUrl, model, provider, headers: buildHeaders(provider, apiKey, req) };
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
          `Görev küçükse veya bölmeye değmezse TEK görev döndür. ` +
          `SADECE şu JSON ile yanıt ver, başka hiçbir şey yazma:\n` +
          `{"tasks":[{"title":"kısa başlık","instruction":"o ajana net, bağımsız talimat"}]}`;
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
          `**Plan — ${tasks.length} paralel ajan:**\n` +
          tasks.map((t, i) => `${i + 1}. ${t.title}`).join("\n") +
          `\n\n⚙️ Ajanlar paralel çalışıyor…\n\n`,
        );

        /* ── 2) PARALEL İŞÇİ AJANLAR ── */
        const repoCtx = body.repoCtx;
        const workerSys =
          `Sen uzman bir alt-ajansın. SADECE sana verilen alt göreve odaklan ve onu ` +
          `eksiksiz tamamla; diğer alt görevleri YAPMA. Net, uygulanabilir bir sonuç üret ` +
          `(gerekiyorsa kod blokları kullan). Türkçe yaz.` +
          (repoCtx ? ` Gerekirse read_file/list_files araçlarıyla repoyu kendin incele.` : ``);
        const results = await Promise.all(
          tasks.map(async (t, i) => {
            const wmsgs = [
              { role: "system", content: workerSys },
              ...shared,
              { role: "user", content: `ALT GÖREVİN: ${t.title}\n\n${t.instruction}` },
            ];
            try {
              /* repoCtx varsa işçi salt-okunur araçlarla repoyu kendi gezer
                 (tam alt-ajan paritesi); yoksa düz çağrı. */
              const r = repoCtx
                ? await callModelWithReadTools(cfg, wmsgs, repoCtx, signal)
                : await callModel(cfg, wmsgs, signal);
              send(`✅ Ajan ${i + 1} tamam — ${t.title}\n`);
              return r;
            } catch (e) {
              send(`⚠️ Ajan ${i + 1} hata verdi — ${t.title}\n`);
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
          .map((t, i) => `### ${t.title}\n${results[i]}`)
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
