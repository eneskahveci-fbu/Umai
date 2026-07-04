/* Model yanıtındaki YAPISAL muhakeme/düşünme bölümlerini içerikten ayırır.
   Bazı modeller çözümlemeyi ayrı bir `reasoning` alanında yollar (sunucu bunu
   zaten ayırıyor); bazıları ise içerik metnine gömer:
   - <think>…</think>, <thinking>…</thinking>, <reasoning>…</reasoning> etiketleri
   - Harmony kanal işaretçileri: <|channel|>analysis<|message|>…<|channel|>final<|message|>…
   - Artık kontrol token'ları: <|start|>, <|end|>, <|assistant|>, assistantfinal…

   Saf fonksiyon → birim testli. Riskli sezgisel "düz metin muhakeme" kırpması
   YAPMAZ (gerçek yanıtı silme riski); yalnız açık işaretçili blokları ayıklar. */

export interface SplitReasoning {
  /** Kullanıcıya gösterilecek temizlenmiş nihai içerik. */
  content: string;
  /** "Düşünce süreci" paneline eklenecek muhakeme (yoksa boş). */
  thinking: string;
}

const TAG_RE = /<(think|thinking|reasoning)>([\s\S]*?)<\/\1>/gi;

export function splitReasoning(raw: string): SplitReasoning {
  let text = raw ?? "";
  const thinkingParts: string[] = [];

  /* 1) Harmony kanalları: analysis → düşünce, final → içerik. */
  if (/<\|channel\|>/.test(text)) {
    const finalMatches = [...text.matchAll(/<\|channel\|>final<\|message\|>([\s\S]*?)(?=<\|(?:end|return|start|channel)\|>|$)/gi)];
    const analysisMatches = [...text.matchAll(/<\|channel\|>analysis<\|message\|>([\s\S]*?)(?=<\|(?:end|return|start|channel)\|>|$)/gi)];
    for (const m of analysisMatches) if (m[1].trim()) thinkingParts.push(m[1].trim());
    if (finalMatches.length) {
      text = finalMatches.map((m) => m[1]).join("").trim();
    } else {
      /* final kanalı yok ama analysis vardı → tüm işaretçileri temizle. */
      text = text.replace(/<\|channel\|>[a-z]*<\|message\|>/gi, "");
    }
  }

  /* 2) assistantfinal / <|start|>assistant … sözde ayraçları — sonuncudan sonrası
     gerçek cevaptır (bazı modeller "analysis…assistantfinal<cevap>" yazar). */
  const afMatch = text.match(/assistantfinal[\s:]*([\s\S]*)$/i);
  if (afMatch && afMatch[1].trim()) {
    const before = text.slice(0, text.length - afMatch[0].length).trim();
    if (before) thinkingParts.push(before.replace(/<\|[^|]*\|>/g, "").trim());
    text = afMatch[1].trim();
  }

  /* 3) <think>/<thinking>/<reasoning> etiketleri (metnin herhangi bir yerinde). */
  text = text.replace(TAG_RE, (_all, _tag, inner) => {
    if (inner.trim()) thinkingParts.push(inner.trim());
    return "";
  });

  /* 4) Artık harmony kontrol token'larını temizle (varsa). */
  text = text.replace(/<\|[^|]*\|>/g, "").trim();

  return { content: text, thinking: thinkingParts.join("\n\n").trim() };
}
