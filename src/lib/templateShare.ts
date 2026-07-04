/* Şablon paylaşımı — Canva'nın "şablonu bağlantıyla paylaş" fikrinin sıfır
   maliyetli craft yorumu: sunum/doküman/anket JSON dosyası olarak dışa
   aktarılır, başka bir craft kullanıcısı içe aktarıp üzerine çalışır.
   Sunucu yok; doğrulama içe aktarma anında normalize* ile yapılır. */
import type { CraftDoc, CraftForm, SlideDeck } from "./types";
import { normalizeDeck } from "./slides";
import { normalizeDoc } from "./docs";
import { normalizeForm } from "./forms";

export type CraftTemplate =
  | { kind: "deck"; data: SlideDeck }
  | { kind: "doc"; data: CraftDoc }
  | { kind: "form"; data: CraftForm };

const KIND_NAMES: Record<CraftTemplate["kind"], string> = {
  deck: "sunum", doc: "dokuman", form: "anket",
};

/** Şablonu .json dosyası olarak indirir (paylaşım birimi). */
export function templateToJson(t: CraftTemplate): string {
  return JSON.stringify({ craftTemplate: 1, kind: t.kind, data: t.data }, null, 2);
}

export function templateFileName(t: CraftTemplate, title: string): string {
  const safe = (title || "").replace(/[^\wğüşöçıİĞÜŞÖÇ -]/g, "").trim() || KIND_NAMES[t.kind];
  return `craft-${KIND_NAMES[t.kind]}-${safe}.json`;
}

/** İçe aktarılan JSON'u doğrular; kimlikler/zamanlar yeniden üretilir
    (çakışma olmasın). Geçersizse Error fırlatır. */
export function parseTemplate(jsonText: string): CraftTemplate {
  let raw: unknown;
  try { raw = JSON.parse(jsonText); } catch { throw new Error("Geçersiz JSON dosyası."); }
  const r = raw as { craftTemplate?: unknown; kind?: unknown; data?: unknown };
  if (r.craftTemplate !== 1 || !r.kind || !r.data) throw new Error("Bu bir craft şablon dosyası değil.");
  switch (r.kind) {
    case "deck": {
      const d = normalizeDeck(r.data);
      if (!d) throw new Error("Sunum şablonu çözümlenemedi.");
      const themeId = (r.data as { themeId?: string }).themeId;
      if (themeId) d.themeId = themeId;
      const brief = (r.data as { brief?: string }).brief;
      if (brief) d.brief = brief;
      return { kind: "deck", data: d };
    }
    case "doc": {
      const d = normalizeDoc(r.data);
      if (!d) throw new Error("Doküman şablonu çözümlenemedi.");
      return { kind: "doc", data: d };
    }
    case "form": {
      const f = normalizeForm(r.data);
      if (!f) throw new Error("Anket şablonu çözümlenemedi.");
      return { kind: "form", data: f };
    }
    default:
      throw new Error(`Bilinmeyen şablon türü: ${String(r.kind)}`);
  }
}

/** Tarayıcıda dosya indirme yardımcıları (yalnız istemci). */
export function downloadTemplate(t: CraftTemplate, title: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([templateToJson(t)], { type: "application/json;charset=utf-8" }));
  a.download = templateFileName(t, title);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Gizli file input ile şablon seçtirip çözümler (iptalde sessiz). */
export function pickTemplateFile(onLoad: (t: CraftTemplate) => void, onError: (msg: string) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { onLoad(parseTemplate(String(reader.result ?? ""))); }
      catch (e) { onError(e instanceof Error ? e.message : "Şablon okunamadı."); }
    };
    reader.readAsText(file);
  };
  input.click();
}
