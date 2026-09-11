/* Kişisel stil hafızası — sohbet akışından kullanıcı tercihlerini çıkarır ve
   "kişilik katmanı" olarak sistem prompt'una ekler. Tamamen kural-tabanlı
   (LLM çağrısı yok → maliyet sıfır), saf fonksiyonlar.
   Config flag: config.styleMemoryEnabled (default false, opt-in). */

import type { ChatMessage } from "./types";

// ---- Tercih tespiti --------------------------------------------------------

/** Kullanıcının bir şeyi düzelttirme örüntüsü: "hayır, şöyle yap", "değil, böyle" */
const CORRECTION_RE = /\b(hayır|yanlış|değil|tekrar|olmadı|olmaz|şöyle|değiştir|revize|düzelt)\b/i;

/** Kullanıcının bir şeyi onaylaması: "evet tam", "mükemmel", "süper", "tam bu" */
const APPROVAL_RE = /\b(tam|mükemmel|süper|harika|teşekkür|evet\s*tam|aynen|oldu|bitti|perfect|great|exactly)\b/i;

/** Belirli kod örüntülerini (stilini) tespit eder. */
const CODE_STYLE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bconst\b.+\barrow\b|=>/, label: "arrow function tercih eder" },
  { re: /^\s{2}[^\s]/m, label: "2 boşluk girintisi" },
  { re: /^\t/m, label: "tab girintisi" },
  { re: /interface\s+\w/, label: "TypeScript interface kullanır" },
  { re: /type\s+\w+\s*=/, label: "TypeScript type alias kullanır" },
  { re: /(['"])use (strict|client|server)\1/, label: "strict/client/server direktifi" },
  { re: /\/\*\*[\s\S]*?\*\//, label: "JSDoc kullanır" },
  { re: /\/\/.+/, label: "satır içi yorum yazar" },
  { re: /async\s+function|async\s*\(/, label: "async/await tercih eder" },
  { re: /\bconsole\.log\b/, label: "debug için console.log kullanır" },
  { re: /Türkçe|Turkish|tr[-_]/i, label: "Türkçe değişken/yorum tercih edebilir" },
];

interface ConversationTurn {
  userText: string;
  assistantCode?: string;
  userAccepted: boolean;
}

function extractTurns(messages: ChatMessage[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const u = messages[i];
    const a = messages[i + 1];
    if (u.role !== "user" || a.role !== "assistant") continue;
    const codeMatch = /```[\w]*\n([\s\S]*?)```/.exec(a.content);
    const assistantCode = codeMatch?.[1];
    // Bir sonraki kullanıcı mesajı varsa onay/ret kontrol et
    const nextUser = messages[i + 2];
    const userAccepted = nextUser
      ? APPROVAL_RE.test(nextUser.content) && !CORRECTION_RE.test(nextUser.content)
      : false;
    turns.push({ userText: u.content, assistantCode, userAccepted });
  }
  return turns;
}

/** Sohbetten kural-tabanlı tercih listesi çıkarır. */
export function extractStylePreferences(messages: ChatMessage[]): string[] {
  const prefs = new Set<string>();
  const turns = extractTurns(messages);

  for (const turn of turns) {
    // Kullanıcı düzelttiyse → önceki stili reddetmiş demektir (tersine çıkarım yok)
    if (CORRECTION_RE.test(turn.userText)) continue;
    // Kullanıcı onayladıysa → o asistan cevabının kod stili tercih edilmiş
    if (turn.userAccepted && turn.assistantCode) {
      for (const p of CODE_STYLE_PATTERNS) {
        if (p.re.test(turn.assistantCode)) prefs.add(p.label);
      }
    }
    // Kullanıcı metninde açık tercih sinyalleri
    if (/\b(camelCase)\b/i.test(turn.userText)) prefs.add("camelCase kullanır");
    if (/\b(snake_case)\b/i.test(turn.userText)) prefs.add("snake_case kullanır");
    if (/\bTypeScript\b/i.test(turn.userText)) prefs.add("TypeScript tercih eder");
    if (/\bTailwind\b/i.test(turn.userText)) prefs.add("Tailwind CSS kullanır");
    if (/\b(yarn|pnpm)\b/i.test(turn.userText)) prefs.add(`${(/yarn/i.test(turn.userText) ? "yarn" : "pnpm")} kullanır`);
  }
  return [...prefs];
}

/** Tercih listesinden sistem prompt'una eklenecek kişilik katmanı oluşturur. */
export function buildPersonalityLayer(preferences: string[]): string {
  if (!preferences.length) return "";
  return `[Kullanıcı kod tercihleri — bu sohbetten öğrenildi, uymaya çalış]\n${preferences.map((p) => `• ${p}`).join("\n")}`;
}
