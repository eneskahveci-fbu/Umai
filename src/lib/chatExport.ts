/* Sohbetin Markdown'a dökümü (O1).

   Önceden bu mantık store.ts'te exportChat ve copyChatMarkdown içinde İKİ KEZ
   kopyalanmıştı ve çok sadeydi: yalnız `**Kullanıcı:** + ham metin`. İki gerçek
   kusuru vardı:
     1. Atıflar (ChatMessage.sources) tamamen DÜŞÜYORDU — web aramalı bir
        yanıtın kaynakları dışa aktarımda kayboluyordu.
     2. Arayüzde gizlenen köprü mesajları ("**Terminal çıktısı**", "**Kod
        çıktısı**" — bkz. MessageBubble) user rolünde tutulduğu için dışa
        aktarımda "Kullanıcı" turu gibi görünüyordu; kullanıcının yazmadığı
        metin ona atfediliyordu.

   NOT (bilinçli eksik): mesaj başına HANGİ MODELİN yanıt verdiği hiçbir yerde
   kaydedilmiyor (ChatMessage'da böyle bir alan yok), bu yüzden "kullanılan
   model" satırı uydurulmadı. Gerçekten kayıtlı olan iki sinyal — çalıştırılan
   ajan (agentId) ve Fusion taslak modelleri (fusionModels) — varsa yazılır.

   Saf fonksiyon (now parametreyle enjekte edilir) → birim testli. */

import type { Chat, ChatMessage } from "./types";

/** Arayüzde gizlenen, ajana bağlam olarak beslenen köprü mesajları. */
const BRIDGE_PREFIXES = ["**Terminal çıktısı**", "**Kod çıktısı**"];

function isBridgeMessage(m: ChatMessage): boolean {
  return m.role === "user" && BRIDGE_PREFIXES.some((p) => m.content.startsWith(p));
}

/** Yerelden bağımsız, deterministik tarih (DD.MM.YYYY HH:mm) — testlerin
    çalıştığı makinenin saat dilimi/ICU verisine bağlı kalmasın diye
    toLocaleString KULLANILMAZ. */
export function formatStamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatCount(n: number): string {
  return n.toLocaleString("tr-TR");
}

export interface ChatToMarkdownOptions {
  /** Dışa aktarma anı — testlerde sabitlenebilsin diye enjekte edilir. */
  now?: number;
  /** Ajan id'sini okunur etikete çevirir (çağıran ALL_AGENTS'ı verir; bu modül
      agents.ts'e bağımlı olmasın diye dışarıdan alınır). */
  agentLabel?: (id: string) => string | undefined;
}

export function chatToMarkdown(chat: Chat, opts: ChatToMarkdownOptions = {}): string {
  const now = opts.now ?? Date.now();
  const out: string[] = [];

  out.push(`# ${chat.title || "Sohbet"}`, "");

  /* ── Başlık meta ── */
  const meta: string[] = [];
  if (chat.created_at) meta.push(`- **Oluşturma:** ${formatStamp(chat.created_at)}`);
  meta.push(`- **Dışa aktarma:** ${formatStamp(now)}`);
  if (chat.tags?.length) meta.push(`- **Etiketler:** ${chat.tags.join(", ")}`);
  const tin = chat.totalInTokens ?? 0;
  const tout = chat.totalOutTokens ?? 0;
  if (tin || tout) meta.push(`- **Token:** ${formatCount(tin)} girdi · ${formatCount(tout)} çıktı`);
  meta.push(`- **Mesaj:** ${chat.messages.filter((m) => !isBridgeMessage(m)).length}`);
  out.push(...meta, "", "---", "");

  /* ── Turlar ── */
  for (const m of chat.messages) {
    if (!m.content.trim()) continue; // akış sırasında kalan boş balon

    if (isBridgeMessage(m)) {
      /* Kullanıcının yazdığı bir mesaj DEĞİL — araç çıktısı olarak etiketle. */
      out.push("### Araç çıktısı", "", m.content, "", "---", "");
      continue;
    }

    if (m.role === "user") {
      out.push("## Kullanıcı", "", m.content, "", "---", "");
      continue;
    }

    /* Asistan: varsa ajan ve Fusion bilgisini başlığa iliştir. */
    const badges: string[] = [];
    const agent = m.agentId ? opts.agentLabel?.(m.agentId) : undefined;
    if (agent) badges.push(agent);
    if (m.fusionModels?.length) badges.push(`Fusion: ${m.fusionModels.join(", ")}`);
    out.push(`## Asistan${badges.length ? ` · ${badges.join(" · ")}` : ""}`, "", m.content, "");

    /* Atıflar — önceden tamamen kayboluyordu. */
    if (m.sources?.length) {
      out.push("**Kaynaklar**", "");
      m.sources.forEach((s, i) => out.push(`${i + 1}. [${s.title || s.url}](${s.url})`));
      out.push("");
    }
    out.push("---", "");
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
