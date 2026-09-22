/* WebContainer taşıyıcısı — tarayıcı içi Node.js + jsh. Yerel klasör mount
   edildiyse onu, yoksa bağlı repoyu, o da yoksa boş sandbox'ı yükler. */
import { getUnsupportedReason, getWebContainer, isSupported, mountDefaults, mountFiles, needsApiKey } from "@/lib/webcontainer";
import { fetchAllFiles } from "@/lib/github";
import { fetchAllGitLabFiles, resolveRepoProvider } from "@/lib/gitlab";
import { useStore } from "@/lib/store";
import { dirHandleToTree, getMountedHandle, getMountedName } from "@/lib/localfs";
import { OUTPUT_BUFFER_MAX, appendCapped } from "./core";
import { attachRunBridge } from "./runBridge";
import type { TerminalView } from "./view";
import type { TransportCallbacks } from "./wsTransport";
import type { TreeNode } from "@/lib/types";

export type RepoFileLoader = () => Promise<{ path: string; content: string }[]>;

/** Terminal kurulmadan önce çağrılır: destek/anahtar eksikse sebebi döner. */
export function webContainerBlocker(apiKey: string): "needs-key" | { error: string } | null {
  if (!isSupported()) return { error: getUnsupportedReason() ?? "Tarayıcı desteklemiyor." };
  if (needsApiKey() && !apiKey.trim()) return "needs-key";
  return null;
}

export async function connectWebContainer(
  view: TerminalView,
  apiKey: string,
  cb: TransportCallbacks,
  loadRepoFiles?: RepoFileLoader,
): Promise<() => void> {
  const { term } = view;
  const wc = await getWebContainer(apiKey);

  const handle = getMountedHandle();
  if (handle) {
    const { tree, fileCount, truncated, skipped } = await dirHandleToTree(handle);
    await wc.mount(tree);
    term.writeln(`\x1b[1;32m✓ Mount: \x1b[36m${getMountedName()}\x1b[0m (${fileCount} dosya${truncated ? ", \x1b[33mkesildi\x1b[0m" : ""})`);
    if (skipped.length > 0) term.writeln(`\x1b[33m⚠ Atlandı (>5MB): ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? ` ve ${skipped.length - 3} daha` : ""}\x1b[0m`);
  } else if (loadRepoFiles) {
    term.writeln("\x1b[2mBağlı repo yükleniyor…\x1b[0m");
    try {
      const files = await loadRepoFiles();
      if (files.length) {
        await mountFiles(wc, files);
        term.writeln(`\x1b[1;32m✓ Repo mount edildi: \x1b[36m${files.length} dosya\x1b[0m — gerçek kod tabanı hazır`);
      } else {
        await mountDefaults(wc);
      }
    } catch {
      await mountDefaults(wc);
      term.writeln("\x1b[33m⚠ Repo yüklenemedi, boş sandbox açıldı.\x1b[0m");
    }
  } else {
    await mountDefaults(wc);
  }
  term.writeln("\x1b[1;35m▲ UMAI sandbox\x1b[0m — Node.js + busybox-shell hazır");
  term.writeln("\x1b[2mDeneyin: \x1b[36mnpm install\x1b[2m, \x1b[36mnpm run dev\x1b[2m, \x1b[36mnpm test\x1b[2m, \x1b[36mls\x1b[0m\n");

  const proc = await wc.spawn("jsh", { terminal: { cols: term.cols, rows: term.rows } });
  const writer = proc.input.getWriter();
  const inputSub = term.onData((d) => { void writer.write(d); });

  let outputBuffer = "";
  proc.output.pipeTo(new WritableStream({
    write: (chunk) => {
      term.write(chunk);
      outputBuffer = appendCapped(outputBuffer, chunk, OUTPUT_BUFFER_MAX);
    },
  })).catch(() => {});

  view.onResize((cols, rows) => {
    try { proc.resize({ cols, rows }); } catch { /* henüz hazır değil */ }
  });
  const detachBridge = attachRunBridge({
    send: (data) => { void writer.write(data); return true; },
    buffer: () => outputBuffer,
  });
  cb.onReady();

  return () => {
    detachBridge();
    inputSub.dispose();
    try { writer.releaseLock(); } catch { /* yoksay */ }
    try { proc.kill(); } catch { /* yoksay */ }
  };
}

/** Bağlı repoyu (GitHub/GitLab) WebContainer'a getirmek için dosyaları çeker. */
export const loadConnectedRepoFiles: RepoFileLoader = async () => {
  const store = useStore.getState();
  const r = store.repo;
  if (!r || !store.tree) return [];
  const treeItems = treeBlobs(store.tree);
  const activeRepo = store.config.activeRepo || "";
  if (resolveRepoProvider(r, activeRepo) === "gitlab") {
    return await fetchAllGitLabFiles(r.owner, r.repo, r.branch, treeItems, await store.tokenForRepo(activeRepo, "gitlab"));
  }
  return await fetchAllFiles(r.owner, r.repo, r.branch, treeItems, await store.tokenForRepo(activeRepo, "github"));
};

/** Repo ağacını düz blob listesine çevirir (mount için). */
function treeBlobs(node: TreeNode): { path: string; type: string }[] {
  const items: { path: string; type: string }[] = [];
  for (const f of node.files) items.push({ path: f.path, type: "blob" });
  for (const child of Object.values(node.dirs)) items.push(...treeBlobs(child));
  return items;
}
