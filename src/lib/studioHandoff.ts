/* Sohbet → Tasarım Stüdyosu devri (N1).

   Sohbette üretilen bir artifact, Stüdyo'nun zengin editöründe (tema seçici,
   sürüm geçmişi, Fusion, tekil slayt düzenleme, PDF dışa aktarma) devam
   ettirilebilsin diye bir StudioProject'e çevrilir. Bağlantı şimdiye kadar
   TEK YÖNLÜYDÜ: Stüdyo, sohbetin ArtifactCanvas'ını yeniden kullanıyordu ama
   sohbetten Stüdyo'ya geçiş yoktu.

   Taşıma, ⌘K'nın ve ProjectModal'ın kullandığı AYNI köprüden geçer
   (setSurfaceOpenItem → DesignStudio'nun consumeSurfaceOpenItem effect'i),
   yeni bir mekanizma icat edilmez. */

import type { Artifact, StudioProject } from "./types";

/** Artifact'tan Stüdyo projesi kurar. Saf fonksiyon → birim testli.

    `versions: [content]` DOLU olmalı: DesignStudio'nun openSavedProject'i
    `setVersionIndex(versions.length - 1)` yapıyor; boş dizide bu -1 olur ve
    sürüm göstergesi bozulur. Aynı şekilde `html` dolu olmalı, çünkü mobil
    görünüm `p.html ? "canvas" : "chat"` ile seçiliyor — boş html, kullanıcıyı
    tasarım yerine sohbet sekmesine düşürürdü. */
export function buildStudioProjectFromArtifact(artifact: Artifact, brief = ""): StudioProject {
  const now = Date.now();
  return {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: artifact.title?.trim() || "Sohbetten gelen tasarım",
    brief: brief.trim(),
    html: artifact.content,
    artifactType: artifact.type,
    ...(artifact.language ? { artifactLanguage: artifact.language } : {}),
    designSystemId: "",
    skillId: null,
    directionId: null,
    versions: [artifact.content],
    createdAt: now,
    updatedAt: now,
  };
}

/** Kayıtlı proje listesine ekler ve 40'lık üst sınırı korur (DesignStudio'nun
    kendi kaydetme mantığıyla AYNI sınır — iki yer ayrışmasın). */
export function withStudioProject(existing: StudioProject[] | undefined, project: StudioProject): StudioProject[] {
  return [project, ...(existing ?? []).filter((p) => p.id !== project.id)].slice(0, 40);
}
