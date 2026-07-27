"use client";

import { useStore } from "./store";
import { hasUnsavedItem, recentProjects } from "./studioProjectState";
import type { Config, StudioProjectBase } from "./types";

type StudioListKey = "craftDocs" | "craftForms" | "craftNotebooks" | "craftMaps" | "craftDecks";

/** Docs/Forms/Notebook/Slides stüdyolarının ortak kaydet/sil/liste mantığı:
    en-yeni-önce sırayla, en fazla `max` öğe tutulur; var olan bir öğe
    güncelleniyorsa createdAt korunur, updatedAt her zaman şimdiki zaman olur. */
export function useStudioProject<T extends StudioProjectBase>(configKey: StudioListKey, max: number) {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const saved = ((config[configKey] as T[] | undefined) ?? []);

  const save = (item: T, successMsg?: string): T => {
    const prev = saved.find((x) => x.id === item.id);
    const stamped: T = { ...item, createdAt: prev?.createdAt ?? item.createdAt, updatedAt: Date.now() };
    const next = [stamped, ...saved.filter((x) => x.id !== item.id)].slice(0, max);
    saveConfig({ ...config, [configKey]: next } as Config);
    if (successMsg) addToast(successMsg, "success");
    return stamped;
  };

  const saveAll = (next: T[]) => {
    saveConfig({ ...config, [configKey]: next } as Config);
  };

  const remove = (id: string) => {
    saveConfig({ ...config, [configKey]: saved.filter((x) => x.id !== id) } as Config);
  };

  /* X2 — kaydedilmemiş işi koruma. Beş içerik yüzeyinin de "+ Yeni" düğmesi
     mevcut öğeyi ONAYSIZ siliyordu (ör. DocsStudio `setDoc(null)`): kullanıcı
     bir doküman/anket/kroki üretip kaydetmeyi unuttuysa tek tıkla
     kaybediyordu. Kural Tasarım stüdyosundakiyle aynı (hasUnsavedItem), tek
     kaynaktan geliyor. */
  const isUnsaved = (item: T | null | undefined) => hasUnsavedItem(item, saved);

  /** Yıkıcı bir eylemden önce çağır; devam edilebilirse true döner. */
  const confirmDiscard = (item: T | null | undefined, what = "Bu çalışma") =>
    !isUnsaved(item) || confirm(`${what} kaydedilmedi. Devam edilirse kaybolacak. Devam edilsin mi?`);

  /** Galeriye dönerken sessiz kayıt — kullanıcıya "önce kaydet" yükü bindirmez. */
  const saveQuiet = (item: T | null | undefined) => { if (item) save(item); };

  /** X3 — giriş ekranındaki "Son çalışmalar" şeridi için. */
  const recent = (limit = 6) => recentProjects(saved, limit);

  return { saved, save, saveAll, remove, isUnsaved, confirmDiscard, saveQuiet, recent };
}
