import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* Sağlayıcıdan CANLI kota/bakiye çeker (mümkün olanlar). API anahtarı yalnızca
   bu istekte kullanılır, saklanmaz. Desteklenmeyen sağlayıcılar için
   { supported: false } döner; istemci o zaman statik limitleri gösterir. */

interface UsageResult {
  supported: boolean;
  /** Para birimi bakiyesi (ücretli): kalan kredi. */
  creditRemaining?: number;
  creditUsed?: number;
  currency?: string;
  /** Token/istek limiti (ücretsiz katman): toplam ve kalan. */
  limit?: number;
  used?: number;
  remaining?: number;
  isFreeTier?: boolean;
  /** Limitin sıfırlanma zamanı (ISO) veya açıklama. */
  resetText?: string;
  label?: string;
  note?: string;
}

export async function POST(req: NextRequest) {
  const __rl = rateLimit(req, "usage", 30, 60_000);
  if (__rl) return __rl;
  let provider: string, baseUrl: string, apiKey: string;
  try {
    const body = await req.json();
    provider = String(body.provider ?? "");
    baseUrl = String(body.baseUrl ?? "").replace(/\/$/, "");
    apiKey = String(body.apiKey ?? "");
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  if (!apiKey) return NextResponse.json({ supported: false, note: "Anahtar yok" } satisfies UsageResult);

  try {
    /* ── OpenRouter: en zengin kota verisi ── */
    if (provider === "openrouter") {
      const res = await fetch(`${baseUrl || "https://openrouter.ai/api/v1"}/auth/key`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return NextResponse.json({ supported: false, note: `OpenRouter ${res.status}` } satisfies UsageResult);
      const data = (await res.json()) as {
        data?: { label?: string; usage?: number; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean };
      };
      const d = data.data ?? {};
      const result: UsageResult = {
        supported: true,
        label: d.label,
        creditUsed: typeof d.usage === "number" ? d.usage : undefined,
        creditRemaining: typeof d.limit_remaining === "number" ? d.limit_remaining : undefined,
        currency: "USD",
        isFreeTier: d.is_free_tier,
        note: d.limit == null ? "Limitsiz (kullandıkça öde)" : undefined,
      };
      return NextResponse.json(result);
    }

    /* ── DeepSeek: hesap bakiyesi ── */
    if (provider === "deepseek") {
      const res = await fetch(`${baseUrl ? baseUrl.replace(/\/v1$/, "") : "https://api.deepseek.com"}/user/balance`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return NextResponse.json({ supported: false, note: `DeepSeek ${res.status}` } satisfies UsageResult);
      const data = (await res.json()) as {
        is_available?: boolean;
        balance_infos?: { currency?: string; total_balance?: string }[];
      };
      const info = data.balance_infos?.[0];
      const result: UsageResult = {
        supported: true,
        creditRemaining: info?.total_balance ? parseFloat(info.total_balance) : undefined,
        currency: info?.currency ?? "USD",
        note: data.is_available ? undefined : "Bakiye tükendi veya hesap pasif",
      };
      return NextResponse.json(result);
    }

    /* ── Diğer sağlayıcılar: canlı kota uçları yok ── */
    return NextResponse.json({ supported: false } satisfies UsageResult);
  } catch (e) {
    return NextResponse.json({ supported: false, note: `Hata: ${(e as Error).message}` } satisfies UsageResult);
  }
}
