"use client";

import { useStore } from "@/lib/store";
import { useSurfaceNav, setSurfaceOpenItem } from "@/lib/surfaceNav";
import { buildStudioProjectFromArtifact, withStudioProject } from "@/lib/studioHandoff";
import { ArtifactCanvas } from "./ArtifactCanvas";

/* Sohbetin Artifact paneli — global store'daki aktif artifact yuvasına bağlı.
   Sürüm geçmişi de STORE'da tutulur (L4): panel iki ayrı ağaç konumunda
   render edildiği ve dış sarmalayıcı `key={effectiveActive}` taşıdığı için
   (bkz. RightPanel.tsx) bölünmüş↔tek görünüm ya da sekme değişiminde bu
   bileşen remount oluyor; geçmiş yerel useState'te tutulduğunda SESSİZCE
   sıfırlanıyordu. Görüntüleme/dışa-aktarma ArtifactCanvas'ta (Tasarım
   Stüdyosu ile paylaşılan). */
export function ArtifactPanel() {
  const artifact = useStore((s) => s.artifact);
  const setArtifact = useStore((s) => s.setArtifact);
  const versions = useStore((s) => s.artifactVersions);
  const vIndex = useStore((s) => s.artifactVersionIndex);
  const setVIndex = useStore((s) => s.setArtifactVersionIndex);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);
  const { go } = useSurfaceNav();

  if (!artifact) return null;
  const shown = versions[vIndex] ?? artifact;

  return (
    <ArtifactCanvas
      artifact={shown}
      versionIndex={vIndex}
      versionTotal={versions.length}
      onPrevVersion={() => setVIndex(vIndex - 1)}
      onNextVersion={() => setVIndex(vIndex + 1)}
      onClose={() => setArtifact(null)}
      onOpenInStudio={() => {
        /* N1 — sohbetten Stüdyo'ya devir: artifact bir StudioProject'e çevrilip
           kaydedilir, sonra ⌘K/ProjectModal'ın kullandığı AYNI köprüyle
           (setSurfaceOpenItem → DesignStudio'nun consumeSurfaceOpenItem
           effect'i) o projeyle açılır. GÖRÜNTÜLENEN sürüm taşınır (kullanıcı
           eski bir sürüme dönmüşse onu devretmek beklenen davranış). */
        const project = buildStudioProjectFromArtifact(shown);
        saveConfig({ ...config, studioProjects: withStudioProject(config.studioProjects, project) });
        setSurfaceOpenItem("studio", project.id);
        go("studio");
        addToast("Stüdyo'da açıldı — buradan düzenlemeye devam edebilirsin.", "success");
      }}
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
