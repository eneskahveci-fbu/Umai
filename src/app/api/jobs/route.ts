import { after } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeRemoteUrl } from "@/lib/urlSafety";
import { createClient } from "@/lib/supabase/server";
import { buildHeaders, type LlmCfg } from "@/lib/llmCall";
import { runSwarmToCompletion } from "@/lib/swarmPipeline";
import { JOB_SYSTEM, deriveJobTitle } from "@/lib/jobs";
import type { Provider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Vercel: fonksiyon, yanıt döndükten sonra da (after) bu süreye kadar çalışır —
   görev tarayıcı kapansa bile sunucuda tamamlanır. */
export const maxDuration = 300;

/* Arka plan görevleri — SUNUCU-taraflı yürütme (Claude'un arka plan görevleri
   gibi): POST işi başlatır ve HEMEN döner; asıl LLM çağrısı `after()` içinde
   yanıttan SONRA sürer, sonuç Supabase'e yazılır. Kullanıcı tarayıcıyı kapatsa
   da iş biter; geri dönünce GET ile senkronlanır.
   - API anahtarı yalnızca bu isteğin belleğinde yaşar; hiçbir yere YAZILMAZ.
   - Supabase yapılandırılmamışsa / giriş yoksa / tablo yoksa { server:false }
     döner → istemci eski yerel (sekme açıkken) moduna düşer. Kırılma yok. */

interface JobRequest {
  jobId?: string;
  goal?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  fallbacks?: { provider?: Provider; baseUrl?: string; model?: string; apiKey?: string }[];
}

const KEYLESS = new Set<string>(["pollinations", "ollama"]);

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(req: Request) {
  const __rl = rateLimit(req, "jobs", 10, 60_000);
  if (__rl) return __rl;
  if (!checkOrigin(req)) return Response.json({ error: "Geçersiz origin." }, { status: 403 });

  let body: JobRequest;
  try { body = await req.json(); } catch { return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  const goal = (body.goal || "").trim();
  const jobId = (body.jobId || "").trim();
  if (!goal || !jobId) return Response.json({ error: "goal ve jobId gerekli." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return Response.json({ server: false, reason: "supabase-yok" });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ server: false, reason: "giris-yok" });

  /* Aday zinciri (orchestrate/chat ile aynı sözleşme): birincil + ücretsiz
     fallback'ler; her zaman anahtarsız Pollinations tabanı istemciden gelir. */
  const candList: { provider: Provider; baseUrl: string; model: string; apiKey: string }[] = [];
  const push = (p?: Provider, b?: string, m?: string, k?: string) => {
    const cp = (p ?? "custom") as Provider;
    const cb = (b ?? "").replace(/\/$/, "");
    const cm = m ?? "";
    const ck = k ?? "";
    if (!cb || !cm) return;
    if (!KEYLESS.has(cp) && !ck) return;
    if (candList.some((c) => c.provider === cp && c.baseUrl === cb && c.model === cm)) return;
    candList.push({ provider: cp, baseUrl: cb, model: cm, apiKey: ck });
  };
  push(body.provider, body.baseUrl, body.model, body.apiKey);
  for (const f of body.fallbacks ?? []) push(f.provider, f.baseUrl, f.model, f.apiKey);
  if (!candList.length) {
    push("pollinations" as Provider, "https://text.pollinations.ai/openai", "openai", "");
  }
  if (process.env.NODE_ENV === "production") {
    for (const c of candList) {
      if (!isSafeRemoteUrl(c.baseUrl)) {
        return Response.json({ error: "Güvensiz baseUrl." }, { status: 400 });
      }
    }
  }
  const cfgs: LlmCfg[] = candList.map((c) => ({
    baseUrl: c.baseUrl, model: c.model, provider: c.provider,
    headers: buildHeaders(c.provider, c.apiKey, req.headers.get("origin") ?? undefined),
    effort: "high",
  }));

  /* Satırı ŞİMDİ aç (yanıttan önce) — tablo yoksa zarifçe yerel moda düş. */
  const { error: insErr } = await supabase.from("background_jobs").upsert({
    id: jobId, user_id: user.id, goal, title: deriveJobTitle(goal), status: "running",
  });
  if (insErr) return Response.json({ server: false, reason: insErr.message.slice(0, 120) });

  /* Asıl iş: yanıt döndükten sonra sunucuda sürer (tarayıcıdan bağımsız).
     Ajan Ekibi ile aynı motor (planla → bölünmeye değerse paralel uzmanlar →
     birleştir): görev basitse planlayıcı tek görev döndürür, ek gecikme
     yaratmadan tek-ajan yanıtına düşülür. */
  after(async () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 280_000); // maxDuration emniyet payı
    try {
      const result = await runSwarmToCompletion({
        cfgs, baseSys: JOB_SYSTEM, shared: [], userTask: goal, signal: ac.signal,
      });
      if (result.trim()) {
        await supabase.from("background_jobs").update({ status: "done", result: result.trim() }).eq("id", jobId);
      } else {
        await supabase.from("background_jobs").update({
          status: "error", error: "Model boş yanıt döndürdü.",
        }).eq("id", jobId);
      }
    } catch (e) {
      await supabase.from("background_jobs").update({
        status: "error",
        error: (e as Error)?.name === "AbortError" ? "Süre sınırı aşıldı (5 dk)." : ((e as Error).message || "bilinmeyen").slice(0, 300),
      }).eq("id", jobId).then(() => undefined, () => undefined);
    } finally {
      clearTimeout(timer);
    }
  });

  return Response.json({ server: true, jobId });
}

/* Kullanıcının sunucu görevlerini listeler (panel senkronu). */
export async function GET(req: Request) {
  const __rl = rateLimit(req, "jobs-list", 60, 60_000);
  if (__rl) return __rl;
  const supabase = await createClient();
  if (!supabase) return Response.json({ server: false, jobs: [] });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ server: false, jobs: [] });
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id, goal, title, status, result, error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return Response.json({ server: false, jobs: [] });
  return Response.json({ server: true, jobs: data ?? [] });
}

/* Görevi siler (panelden kaldırınca sunucudan da düşer). */
export async function DELETE(req: Request) {
  const __rl = rateLimit(req, "jobs-del", 30, 60_000);
  if (__rl) return __rl;
  if (!checkOrigin(req)) return Response.json({ error: "Geçersiz origin." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return Response.json({ error: "id gerekli." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return Response.json({ ok: true });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: true });
  await supabase.from("background_jobs").delete().eq("id", id);
  return Response.json({ ok: true });
}
