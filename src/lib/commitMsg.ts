/* AI commit mesajı / diff özeti için SAF yardımcılar (LLM çağrısı içermez —
   çağrı, istemcide quickComplete ile yapılır). Birim testlerle doğrulanır. */
import { diffLines } from "diff";

/** Tek dosya için kompakt birleşik diff (+/- satırlar, bağlam yok). */
export function buildUnifiedDiff(path: string, oldText: string, newText: string, maxChars = 8000): string {
  const parts = diffLines(oldText, newText);
  const out: string[] = [`--- ${path}`];
  for (const p of parts) {
    if (!p.added && !p.removed) continue;
    const mark = p.added ? "+" : "-";
    for (const ln of p.value.split("\n")) {
      if (ln === "" && p.value.endsWith("\n")) continue;
      out.push(`${mark} ${ln}`);
      if (out.join("\n").length > maxChars) { out.push("… (kırpıldı)"); return out.join("\n"); }
    }
  }
  if (out.length === 1) out.push("(değişiklik yok)");
  return out.join("\n");
}

export const COMMIT_MSG_SYSTEM =
  "Sen bir git commit mesajı yazarısın. Verilen diff'e bakıp Conventional Commits " +
  "biçiminde TEK bir commit mesajı üret (feat|fix|refactor|docs|style|test|chore). " +
  "İlk satır en çok 72 karakter, emir kipinde, Türkçe. Gerekirse boş satırdan sonra " +
  "1-3 maddelik kısa gövde ekle. SADECE mesajı döndür — açıklama, markdown çiti, tırnak yok.";

export const DIFF_SUMMARY_SYSTEM =
  "Sen bir kod değişikliği özetleyicisisin. Verilen diff'in NE yaptığını Türkçe, " +
  "3-6 kısa maddede özetle (davranış değişikliği, riskli nokta varsa belirt). " +
  "SADECE maddeleri döndür; giriş cümlesi ve markdown başlığı yazma.";

/** LLM yanıtını temizler: kod çiti/tırnak/önek soyulur, ilk satır 72 krk'a kırpılır. */
export function cleanCommitMessage(raw: string): string {
  let s = raw.trim()
    .replace(/^```[\w-]*\n?/, "").replace(/\n?```$/, "")
    .replace(/^(commit message|commit mesajı|mesaj)\s*:\s*/i, "")
    .trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();
  const lines = s.split("\n");
  if (lines[0] && lines[0].length > 72) lines[0] = lines[0].slice(0, 71).trimEnd() + "…";
  return lines.join("\n").trim();
}
