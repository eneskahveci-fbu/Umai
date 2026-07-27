/* Stüdyo üretiminden artifact çıkarma (kullanıcı hata raporu, Tem 2026).

   Şikayet: "Bana cv şablonu yap" ve "Bana odyssey hakkında slayt yap"
   isteklerinin İKİSİ de "Hata: Üretim ayrıştırılamadı — brief'i biraz daha
   açık yaz." veriyordu. Mesaj hem YANLIŞ yönlendiriyordu (brief gayet açıktı)
   hem de gerçek nedeni gizliyordu.

   Kök nedenler (ikisi de bu modülde ele alınıyor):

   1) KAPANMAMIŞ kod bloğu. parseBlocks'un deseni kapanış ``` çitini ZORUNLU
      tutuyor (FENCE_RE). Model token sınırına takılıp çıktıyı yarıda keserse
      (uzun bir CV/sunum HTML'inde çok olası) kapanış çiti hiç gelmez → sıfır
      blok. Sonrasındaki `/<[a-z]/` yedeği yalnız HTML'i kurtarıyordu; markdown
      ya da mermaid yarıda kesilince hiçbir şey kurtarılamıyordu.

   2) BOŞ yanıt. Sağlayıcı 200 dönüp hiç içerik yollamazsa `full` boş kalır;
      "brief'i açık yaz" demek tamamen yanıltıcı olur — brief'in bununla ilgisi
      yoktur, model/sağlayıcı yanıt vermemiştir.

   Saf fonksiyonlar → birim testli. */

export interface ExtractedBlock { lang: string; code: string; truncated: boolean }

/** Kapanış çiti OLAN bloklar (parseBlocks ile aynı sözleşme). */
const CLOSED_FENCE_RE = /```([a-zA-Z0-9_+#-]*)(?::[^\n]*)?\n([\s\S]*?)```/g;
/** Açılmış ama KAPANMAMIŞ son blok — çıktı yarıda kesilmişse buraya düşer. */
const OPEN_FENCE_RE = /```([a-zA-Z0-9_+#-]*)(?::[^\n]*)?\n([\s\S]*)$/;

/**
 * Metindeki kod bloklarını çıkarır. Kapanmamış son blok da (truncated: true)
 * döndürülür — yarıda kesilmiş bir çıktı, HİÇ çıktıdan iyidir.
 */
export function extractBlocks(text: string): ExtractedBlock[] {
  const out: ExtractedBlock[] = [];
  CLOSED_FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let lastEnd = 0;
  while ((m = CLOSED_FENCE_RE.exec(text))) {
    out.push({ lang: (m[1] || "").toLowerCase(), code: m[2], truncated: false });
    lastEnd = CLOSED_FENCE_RE.lastIndex;
  }
  /* Kapanmış blokların ARDINDAN açık bir çit kaldıysa onu da al. */
  const tail = text.slice(lastEnd);
  const open = OPEN_FENCE_RE.exec(tail);
  if (open && open[2].trim()) {
    out.push({ lang: (open[1] || "").toLowerCase(), code: open[2], truncated: true });
  }
  return out;
}

/** Artifact'a çevrilmeye en uygun bloğu seçer (görsel türler öncelikli). */
const PREFERRED = ["html", "htm", "jsx", "tsx", "react", "js", "javascript", "svg"];

export function pickBlock(blocks: ExtractedBlock[]): ExtractedBlock | undefined {
  return blocks.find((b) => PREFERRED.includes(b.lang)) ?? blocks[0];
}

export type FailureKind = "empty" | "prose";

/**
 * Çıkarma başarısız olduğunda NEDENİ sınıflandırır — çağıran doğru mesajı
 * gösterebilsin diye. "prose": model konuştu ama kod bloğu vermedi.
 */
export function classifyFailure(text: string): FailureKind {
  return text.trim() ? "prose" : "empty";
}

/** Kullanıcıya gösterilecek dürüst hata metni. `sample`, modelin gerçekte ne
    döndürdüğünü gösterir — eski mesaj bunu tamamen gizliyordu. */
export function failureMessage(kind: FailureKind, text: string): string {
  if (kind === "empty") {
    return "Model boş yanıt döndürdü — üretim yapılamadı. Başka bir model dene "
      + "(composer'daki model seçici) ya da tekrar gönder.";
  }
  const sample = text.trim().replace(/\s+/g, " ").slice(0, 160);
  return `Model kod bloğu yerine düz metin döndürdü, çıktı oluşturulamadı. `
    + `Modelin yanıtı: "${sample}${text.trim().length > 160 ? "…" : ""}"`;
}

/** Yeniden deneme turunda sistem promptuna eklenen katı biçim hatırlatması. */
export const STRICT_FORMAT_REMINDER =
  "\n\n[BİÇİM — ZORUNLU] Önceki denemende kod bloğu yoktu. Bu sefer AÇIKLAMA YAZMA. "
  + "Yanıtın ```html (veya ```markdown / ```mermaid / ```python gibi uygun bir dil etiketi) ile BAŞLASIN "
  + "ve ``` ile KAPANSIN. Kod bloğunun dışına tek kelime bile yazma.";
