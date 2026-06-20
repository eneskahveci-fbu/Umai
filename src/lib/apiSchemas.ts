/* Zod tabanlı API girdi doğrulama. Mevcut validate.ts (repo yazma route'ları)
   ile çakışmaz; bu helper LLM-proxy route'ları (baseUrl/model/apiKey/messages)
   için kullanılır. Şemalar PERMISSIVE (.passthrough) — geçerli istekleri AYNEN
   geçirir, yalnızca biçimsel olarak bozuk/aşırı büyük/SSRF-şüpheli girdiyi reddeder. */
import { z } from "zod";
import { isSafeRemoteUrl } from "./urlSafety";

/* baseUrl: ör. https://api.groq.com/openai/v1 — http(s) zorunlu (SSRF azaltma).
   Canlıda (production) ek olarak iç ağ/loopback/bulut-metadata (169.254.169.254)
   adreslerini reddeder; yerelde (npm run dev) localhost LLM uçları (Ollama/LM
   Studio) meşru olduğundan yalnız production'da kısıtlanır. */
export const baseUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((s) => /^https?:\/\//i.test(s), "baseUrl http(s) olmalı")
  .refine(
    (s) => process.env.NODE_ENV !== "production" || isSafeRemoteUrl(s),
    "baseUrl iç ağ/loopback adresine işaret edemez",
  );

export const messageSchema = z
  .object({ role: z.string().max(32), content: z.unknown() })
  .passthrough();

/* LLM-proxy gövdesi için ortak permissive şema. Bilinmeyen alanlar korunur. */
export const llmProxySchema = z
  .object({
    baseUrl: baseUrlSchema.optional(),
    model: z.string().max(256).optional(),
    apiKey: z.string().max(8192).optional(),
    provider: z.string().max(64).optional(),
    messages: z.array(messageSchema).max(4000).optional(),
  })
  .passthrough();

/* PR/MR inceleme gövdesi. */
export const prReviewSchema = z
  .object({
    provider: z.enum(["github", "gitlab"]),
    owner: z.string().min(1).max(200),
    repo: z.string().min(1).max(200),
    prNumber: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
    token: z.string().max(8192).optional(),
  })
  .passthrough();

/* Gövdeyi güvenle ayrıştırıp doğrular. Hata → hazır 400 Response döner. */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: Response.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "doğrulama hatası";
    return { ok: false, res: Response.json({ error: `Geçersiz istek: ${msg}` }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}
