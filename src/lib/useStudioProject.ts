"use client";

import { useStore } from "./store";
import type { Config, StudioProjectBase } from "./types";

type StudioListKey = "craftDocs" | "craftForms" | "craftNotebooks" | "craftMaps";

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

  return { saved, save, saveAll, remove };
}
