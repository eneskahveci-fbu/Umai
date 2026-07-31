/* URL'den skill içe aktarma — tek yol. İçerik SSRF+rate-limit korumalı
   /api/fetch-text proxy'sinden çekilir (CORS'a takılmaz), başlık içerikten
   türetilir, mevcut addSkill ile eklenir. Chat kesişimi ("skill indir <url>")
   ve SkillImport paneli aynı yardımcıyı kullanır. */
import { useStore } from "./store";
import { parseSkillMd, looksLikeSkillMd } from "./odFormat";

/** Başlığı içerikten türetir: ilk markdown başlığı > ilk anlamlı satır >
    URL dosya adı. 60 karaktere kırpılır. Saf — birim testli. */
export function deriveSkillTitle(text: string, url: string): string {
  const heading = text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 2 && !l.startsWith("```"));
  const fromUrl = url.split("/").pop()?.replace(/\.(md|txt|markdown)$/i, "").replace(/[-_]+/g, " ").trim();
  const raw = heading || firstLine || fromUrl || "İçe aktarılan skill";
  return raw.replace(/^#+\s*/, "").slice(0, 60).trim();
}

/** Ham metinden eklenmeye hazır bir skill kaydı üretir. SAF — birim testli.
 *
 *  Open Design SKILL.md formatı: frontmatter'daki ad/açıklama kullanılır,
 *  gövde (workflow) skill içeriği olur — OD kayıt defterleri doğrudan uyumlu.
 *
 *  `importSkillFromUrl`ın içindeydi; sohbetten ve sunucu dosyalarından da
 *  aynı dönüşüm gerektiği için tek kaynağa çıkarıldı (Ö4/Ö10). `origin`
 *  başlık türetmede ve fileName'de kullanılır (URL, dosya yolu ya da
 *  "sohbet" gibi bir etiket olabilir). */
export function skillFromText(
  text: string,
  origin: string,
  extraTags: string[] = [],
): { title: string; content: string; tags: string[]; enabled: true; source: "file"; fileName: string } {
  const od = looksLikeSkillMd(text) ? parseSkillMd(text) : null;
  const title = od?.name ?? deriveSkillTitle(text, origin);
  const content = od ? (od.description ? `${od.description}\n\n${od.body}` : od.body) : text;
  return {
    title,
    content,
    tags: [...(od ? ["içe-aktarılan", "open-design"] : ["içe-aktarılan"]), ...extraTags],
    enabled: true,
    source: "file",
    fileName: origin,
  };
}

/** URL'den skill indirir ve ekler. Hata fırlatır — çağıran dostane gösterir. */
export async function importSkillFromUrl(url: string): Promise<{ title: string; chars: number }> {
  const res = await fetch(`/api/fetch-text?url=${encodeURIComponent(url)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.text !== "string" || !data.text.trim()) {
    throw new Error(data.error || `İçerik alınamadı (HTTP ${res.status})`);
  }
  const skill = skillFromText((data.text as string).slice(0, 50_000), url);
  useStore.getState().addSkill(skill);
  return { title: skill.title, chars: skill.content.length };
}

/* ── Sohbetten skill kaydetme niyeti (Ö4) ──────────────────────────────────
   Önceki regex URL'nin TÜM mesaj olmasını şart koşuyordu
   (`^skill indir <url>$`), yani "şunu skill olarak indir: https://…" ya da
   "bunu skill olarak kaydet" gibi doğal ifadeler LLM'e gidiyor ve hiçbir şey
   kaydedilmiyordu. Ayrıştırma SAF tutuldu → birim testli. */

export type SkillIntent =
  /** URL'den indir (cümlenin herhangi bir yerinde olabilir). */
  | { kind: "import"; url: string }
  /** Sohbetteki SON asistan yanıtını skill olarak kaydet. */
  | { kind: "saveLast" };

const SKILL_WORD = String.raw`skill|beceri`;
/* KAYDETME fiilleri — Türkçe ekler için \p{L}* toleranslı.

   "oluştur" BİLEREK YOK: o bir ÜRETİM fiili, kaydetme fiili değil. Listede
   olduğu sürece "bana bir skill oluştur, bunu sık kullanacağım" cümlesi
   (skill ✓ + oluştur ✓ + "bunu" ✓) `saveLast` olarak yorumlanıyor, mesaj
   LLM'e hiç gitmiyor ve kullanıcının istediği skill üretilmek yerine önceki
   asistan yanıtı kaydediliyordu. autoStudioSkill/autoImageGen de "oluştur"u
   üretim sinyali sayıyor — bu liste artık onlarla tutarlı. */
const SAVE_VERB = String.raw`indir\p{L}*|y[üu]kle\p{L}*|ekle\p{L}*|kaydet\p{L}*`;

/* Soru kalıpları. "yukarıdaki skill'i nasıl yüklerim?" cümlesi tüm kelime
   koşullarını sağlıyor ama bir KOMUT değil, bir SORU — cevaplanması gerekir.
   Soruyu sessizce bir kayıt işlemine çevirmek en kötü yanlış-pozitif. */
const QUESTION_RE = new RegExp(
  String.raw`\?\s*$|(?<!\p{L})(?:nas[ıi]l|nerede|nereden|neden|niçin|ni[çc]in|hangi|ne zaman|mi|m[ıi]|mu|m[üu])(?!\p{L})`,
  "iu",
);

/** İşaret zamiri / "son yanıt" göndermesi — neyin kaydedileceğini söyler. */
const TARGET_RE = /(?<!\p{L})(bunu|şunu|sunu|yukar[ıi]daki(?:ni)?|[üu]stteki(?:ni)?|son (?:yan[ıi]t|cevap|mesaj)\p{L}*|cevab[ıi]|yan[ıi]t[ıi])(?!\p{L})/iu;

/** Mesajdan skill niyeti çıkarır; yoksa null (mesaj normal akışa gider).
 *
 *  Tasarım ilkesi: ŞÜPHEDE KAL, normal akışa bırak. Yanlış-negatifin bedeli
 *  kullanıcının komutu tekrar yazması; yanlış-pozitifin bedeli isteğinin hiç
 *  cevaplanmaması ve yerine alakasız bir şeyin kaydedilmesi. */
export function parseSkillIntent(text: string): SkillIntent | null {
  const t = (text || "").trim();
  if (!t) return null;
  /* Skill sözcüğü GEÇMİYORSA hiç uğraşma — "şu dosyayı indir" gibi normal
     istekleri kaçırmamak için kapı dar tutuluyor. */
  if (!new RegExp(String.raw`(?<!\p{L})(?:${SKILL_WORD})(?!\p{L})`, "iu").test(t)) return null;
  if (!new RegExp(String.raw`(?<!\p{L})(?:${SAVE_VERB})(?!\p{L})`, "iu").test(t)) return null;

  /* Mesaj çok uzunsa bu bir komut değil, muhtemelen skill İÇERİĞİNİN kendisi
     ya da uzun bir soru — yanlışlıkla yakalamayalım. */
  if (t.length > 300) return null;

  /* Soru → komut değil. URL'li hâli de dahil: "bu skill'i nereden indirebilirim
     https://…" bir bilgi sorusudur, indirme emri değil. */
  if (QUESTION_RE.test(t)) return null;

  const url = t.match(/https?:\/\/\S+/)?.[0];
  if (url) return { kind: "import", url: url.replace(/[.,;:)\]}"']+$/, "") };

  /* URL yok → "bunu/şunu/yukarıdakini skill olarak kaydet". Hedef göndermesi
     ŞART: yalnız "skill ekle" neyi kaydedeceğimizi söylemiyor. */
  if (TARGET_RE.test(t)) return { kind: "saveLast" };
  return null;
}
