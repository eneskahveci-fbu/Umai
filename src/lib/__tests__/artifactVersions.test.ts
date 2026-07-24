import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store";
import type { Artifact } from "../types";

/* L4 — sohbet artifact'ının sürüm geçmişi. Önceden ArtifactPanel'in YEREL
   useState'indeydi; panel iki ayrı ağaç konumunda render edildiği ve dış
   sarmalayıcı key taşıdığı için (RightPanel.tsx) görünüm/sekme değişiminde
   remount olup geçmiş SESSİZCE sıfırlanıyordu. Store'a taşındı. */

function art(content: string, title = "T"): Artifact {
  return { type: "html", content, title };
}

describe("artifact sürüm geçmişi (store)", () => {
  beforeEach(() => {
    useStore.getState().setArtifact(null);
  });

  it("art arda gelen FARKLI içerikler yeni sürüm olarak birikir", () => {
    const s = useStore.getState();
    s.setArtifact(art("<p>v1</p>"));
    s.setArtifact(art("<p>v2</p>"));
    s.setArtifact(art("<p>v3</p>"));
    const st = useStore.getState();
    expect(st.artifactVersions).toHaveLength(3);
    expect(st.artifactVersionIndex).toBe(2); // her zaman en son sürümde
    expect(st.artifactVersions[0].content).toBe("<p>v1</p>");
  });

  it("AYNI içerik tekrar gelirse yeni sürüm açılmaz (yeniden render geçmişi şişirmesin)", () => {
    const s = useStore.getState();
    s.setArtifact(art("<p>aynı</p>"));
    s.setArtifact(art("<p>aynı</p>"));
    s.setArtifact(art("<p>aynı</p>"));
    expect(useStore.getState().artifactVersions).toHaveLength(1);
  });

  it("null verilince geçmiş tamamen temizlenir", () => {
    const s = useStore.getState();
    s.setArtifact(art("<p>v1</p>"));
    s.setArtifact(art("<p>v2</p>"));
    s.setArtifact(null);
    const st = useStore.getState();
    expect(st.artifact).toBeNull();
    expect(st.artifactVersions).toEqual([]);
    expect(st.artifactVersionIndex).toBe(0);
  });

  it("geçmiş 20 sürümle sınırlıdır, en eskiler düşer (bellek şişmesin)", () => {
    const s = useStore.getState();
    for (let i = 1; i <= 25; i++) s.setArtifact(art(`<p>v${i}</p>`));
    const st = useStore.getState();
    expect(st.artifactVersions).toHaveLength(20);
    expect(st.artifactVersions[0].content).toBe("<p>v6</p>");
    expect(st.artifactVersions.at(-1)!.content).toBe("<p>v25</p>");
    expect(st.artifactVersionIndex).toBe(19);
  });

  it("setArtifactVersionIndex sınırların dışına taşmaz", () => {
    const s = useStore.getState();
    s.setArtifact(art("<p>v1</p>"));
    s.setArtifact(art("<p>v2</p>"));
    useStore.getState().setArtifactVersionIndex(-5);
    expect(useStore.getState().artifactVersionIndex).toBe(0);
    useStore.getState().setArtifactVersionIndex(99);
    expect(useStore.getState().artifactVersionIndex).toBe(1);
  });

  it("eski bir sürüme gidip YENİ sürüm gelince otomatik en sona atlanır", () => {
    const s = useStore.getState();
    s.setArtifact(art("<p>v1</p>"));
    s.setArtifact(art("<p>v2</p>"));
    useStore.getState().setArtifactVersionIndex(0); // geriye git
    expect(useStore.getState().artifactVersionIndex).toBe(0);
    useStore.getState().setArtifact(art("<p>v3</p>"));
    expect(useStore.getState().artifactVersionIndex).toBe(2);
  });

  it("sohbet değişince geçmiş sıfırlanır (A'nın sürümleri B'de görünmez)", () => {
    const s = useStore.getState();
    s.newChat();
    const firstId = useStore.getState().currentId!;
    s.setArtifact(art("<p>v1</p>"));
    s.setArtifact(art("<p>v2</p>"));
    expect(useStore.getState().artifactVersions).toHaveLength(2);

    useStore.getState().newChat();
    expect(useStore.getState().artifactVersions).toEqual([]);

    useStore.getState().setArtifact(art("<p>b1</p>"));
    useStore.getState().selectChat(firstId);
    expect(useStore.getState().artifactVersions).toEqual([]);
  });
});
