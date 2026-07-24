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

/** K1 — Etkin skill sayısı `max`'ı aşarsa, mesaj metniyle anahtar-kelime
    örtüşmesine göre en alakalı olanları seçer (basit ama GERÇEK bir tetikleme/
    seçim mantığı — önceden CoderView.tsx'in ana sohbet yolunda vardı ama
    genChat.ts'in Stüdyo motorları (Doküman/Anket/Defter/Sunum) kendi
    `.slice(0, 5)`'iyle dizideki İLK 5'i alaka gözetmeden alıyordu; artık
    TEK kaynak, her yerde tutarlı). ≤max ise hepsi döner (küçük listede
    seçim maliyeti yok). Saf fonksiyon → testli. */
export function selectRelevantSkills<T extends { title: string; content: string; tags?: string[] }>(
  all: T[], queryText: string, max = 5,
): T[] {
  if (all.length <= max) return all;
  const queryWords = new Set((queryText || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  if (queryWords.size === 0) return all.slice(0, max);
  const scored = all.map((s) => {
    const haystack = (s.title + " " + s.content + " " + (s.tags ?? []).join(" ")).toLowerCase().split(/\W+/);
    const hits = haystack.filter((w) => queryWords.has(w)).length;
    return { skill: s, hits };
  });
  return scored.sort((a, b) => b.hits - a.hits).slice(0, max).map((x) => x.skill);
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
