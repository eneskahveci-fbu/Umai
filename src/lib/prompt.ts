import { STYLE_LABELS } from "./constants";
import type { MemoryItem, ResponseStyle } from "./types";

/* Sistem prompt'una eklenen bağlam blokları için TEK kaynak.
   Hem sunucu (/api/chat, /api/orchestrate) hem istemci (Pollinations doğrudan
   çağrısı) aynı fonksiyonu kullanır → biçim ve davranış her yerde tutarlı. */

export interface SkillLike {
  title: string;
  content: string;
  tags?: string[];
  source?: "manual" | "file";
  fileName?: string;
}

export interface ContextSectionsInput {
  style?: ResponseStyle;
  memories?: MemoryItem[];
  skills?: SkillLike[];
  searchContext?: string;
}

/** Stil + hafıza + eğitim seti (skills) + web arama bağlamını tutarlı,
    etiketli bloklar halinde döndürür. Boş girdiler atlanır. */
export function buildContextSections(input: ContextSectionsInput): string {
  let out = "";

  const stylePrompt = STYLE_LABELS[input.style || "normal"]?.prompt;
  if (stylePrompt) out += `\n\n[Stil]: ${stylePrompt}`;

  if (input.memories?.length) {
    out += `\n\n[Kullanıcı hakkında bildiklerin]:\n${input.memories.map((m) => `- ${m.content}`).join("\n")}`;
  }

  if (input.skills?.length) {
    const fileSkills = input.skills.filter((s) => s.source === "file");
    const manualSkills = input.skills.filter((s) => s.source !== "file");
    if (manualSkills.length) {
      out +=
        `\n\n[Eğitim seti — bu kurallara her zaman uy]:\n` +
        manualSkills
          .map((s) => {
            const tags = s.tags?.length ? ` (${s.tags.join(", ")})` : "";
            return `### ${s.title}${tags}\n${s.content}`;
          })
          .join("\n\n");
    }
    if (fileSkills.length) {
      out +=
        `\n\n[Referans dosyalar — örnek olarak kullan]:\n` +
        fileSkills.map((s) => `--- ${s.fileName || s.title} ---\n${s.content}`).join("\n\n");
    }
  }

  if (input.searchContext) {
    out += `\n\n[Web arama sonuçları]:\n${input.searchContext}`;
  }

  return out;
}
