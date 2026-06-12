// src/lib/prompt.ts — Sistem promptu oluşturma

import type { PromptContext, Skill, ResponseStyle } from "./types";
import { RESPONSE_STYLE_PROMPTS, PLATFORM_KNOWLEDGE } from "./constants";

function buildSkillsSection(skills: Skill[]): string {
  if (!skills.length) return "";

  const manual = skills.filter((s) => s.enabled && s.type === "manual");
  const file = skills.filter((s) => s.enabled && s.type === "file");

  const parts: string[] = [];

  if (manual.length > 0) {
    parts.push("[Eğitim seti — manuel skill'ler]:");
    for (const s of manual) {
      parts.push(`--- ${s.title} ---`);
      parts.push(s.content);
    }
  }

  if (file.length > 0) {
    parts.push("[Referans dosyalar — örnek olarak kullan]:");
    for (const s of file) {
      parts.push(`--- ${s.title} ---`);
      parts.push(s.content);
    }
  }

  return parts.join("\n");
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const parts: string[] = [];

  // Ana direktif
  parts.push(
    `Sen Craft.Coder, deneyimli bir yazılım geliştirme asistanısın. Kod yazabilir, açıklayabilir, hata ayıklayabilir, mimari önerebilirsin. Kullanıcı sana GitHub deposundan dosya içeriği gösterebilir; bunları dikkate al. Adım adım düşün. Cevapların Türkçe ve markdown formatında olsun; kod bloklarını dilini belirterek yaz. Bir dosya içeriği yazarken code-fence'i \`dil:dosya/yolu\` biçiminde başlat (örn. \` \`\`ts:src/utils/helper.ts \` \`\`), böylece editörde otomatik açılabilsin.`,
  );

  // Platform bilgisi
  if (ctx.platformKnowledge) {
    parts.push(ctx.platformKnowledge);
  } else {
    parts.push(PLATFORM_KNOWLEDGE);
  }

  // Skill'ler
  const skillsSection = buildSkillsSection(ctx.skills);
  if (skillsSection) {
    parts.push(skillsSection);
  }

  // Proje bağlamı
  if (ctx.projectContext) {
    parts.push("[Proje bağlamı — SOUL.md]:");
    parts.push(ctx.projectContext);
  }

  // Bellek
  if (ctx.memory) {
    parts.push(`[Kullanıcı belleği — sohbetler arası hatırlanan notlar]:\n${ctx.memory}`);
  }

  // Yanıt stili
  const stylePrompt = RESPONSE_STYLE_PROMPTS[ctx.responseStyle];
  if (stylePrompt) {
    parts.push(stylePrompt);
  }

  // Sistem prompt override
  if (ctx.systemPrompt) {
    parts.push(ctx.systemPrompt);
  }

  return parts.join("\n\n");
}

// Tool-use talimatlarını prompt'a ekle
export function buildToolUsePrompt(): string {
  return `Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun.

[Düşünme: YÜKSEK] Adım adım analiz et. Sorunu içselleştir, olası yaklaşımları kıyasla, edge case'leri düşün, ardından gerekçeli çözümü ver.`;
}
