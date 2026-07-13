"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Artifact } from "@/lib/types";
import { ArtifactCanvas } from "./ArtifactCanvas";

/* Sohbetin Artifact paneli — global store'daki TEK aktif artifact yuvasına
   bağlı. Sürüm geçmişi burada (son 5, çağırana özel semantik) türetilir;
   görüntüleme/dışa-aktarma ArtifactCanvas'ta (Tasarım Stüdyosu ile paylaşılan). */
export function ArtifactPanel() {
  const artifact = useStore((s) => s.artifact);
  const setArtifact = useStore((s) => s.setArtifact);

  /* Sürüm geçmişi — aynı panel güncellendikçe son 5 sürümü tut, ‹ › ile gezin.
     Render-anı türetme (effect yok): içerik değişince geçmişe ekle, son sürümü göster. */
  const [versions, setVersions] = useState<Artifact[]>([]);
  const [vIndexRaw, setVIndex] = useState(999);
  const [prevKey, setPrevKey] = useState("");
  const curKey = artifact ? `${artifact.type}|${artifact.content}` : "";
  if (curKey !== prevKey) {
    setPrevKey(curKey);
    if (!artifact) { setVersions([]); }
    else {
      setVersions((prev) => {
        const top = prev[prev.length - 1];
        if (top && top.content === artifact.content && top.type === artifact.type) return prev;
        return [...prev, artifact].slice(-5);
      });
      setVIndex(999); // yeni sürüm gelince en sona git
    }
  }

  if (!artifact) return null;
  const vIndex = Math.min(vIndexRaw, Math.max(0, versions.length - 1));
  const shown = versions[vIndex] ?? artifact;

  return (
    <ArtifactCanvas
      artifact={shown}
      versionIndex={vIndex}
      versionTotal={versions.length}
      onPrevVersion={() => setVIndex((i) => Math.max(0, i - 1))}
      onNextVersion={() => setVIndex((i) => Math.min(versions.length - 1, i + 1))}
      onClose={() => setArtifact(null)}
      onAnnotate={(descriptor) => {
        /* İşaretlenen öğeyi ana composer'a taşı — CoderView'ın zaten dinlediği
           prefill olayı (odaklama dahil) gerisini halleder. */
        window.dispatchEvent(new CustomEvent("craftai:composer-prefill", {
          detail: { text: `Önizlemedeki şu öğeyi değiştir: ${descriptor} — ` },
        }));
      }}
    />
  );
}
