/* Local folder access via File System Access API (Chromium-only).
   Fully free — uses the browser's native API, no backend needed. */

import type { FileSystemTree, DirectoryNode, FileNode } from "@webcontainer/api";

let mountedHandle: FileSystemDirectoryHandle | null = null;
let mountedName: string | null = null;

export function getMountedHandle(): FileSystemDirectoryHandle | null { return mountedHandle; }
export function getMountedName(): string | null { return mountedName; }
export function setMounted(h: FileSystemDirectoryHandle | null, name: string | null) {
  mountedHandle = h;
  mountedName = name;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("localfs:changed"));
}

export function isLocalFsSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".cache",
  ".turbo", ".vercel", "coverage", ".DS_Store",
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_FILES = 2000;

interface PickedDir {
  handle: FileSystemDirectoryHandle;
  name: string;
}

export async function pickLocalDirectory(): Promise<PickedDir | null> {
  if (!isLocalFsSupported()) throw new Error("Tarayıcı yerel klasör seçimini desteklemiyor (Chrome/Edge gerekli)");
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    return { handle, name: handle.name };
  } catch (e) {
    if ((e as Error).name === "AbortError") return null;
    throw e;
  }
}

async function readEntries(dir: FileSystemDirectoryHandle): Promise<[string, FileSystemHandle][]> {
  const out: [string, FileSystemHandle][] = [];
  /* eslint-disable @typescript-eslint/no-explicit-any */
  for await (const [name, h] of (dir as any).entries()) {
    out.push([name, h]);
  }
  return out;
}

interface ConvertResult {
  tree: FileSystemTree;
  fileCount: number;
  truncated: boolean;
  skipped: string[];
}

export async function dirHandleToTree(dir: FileSystemDirectoryHandle): Promise<ConvertResult> {
  const result: ConvertResult = { tree: {}, fileCount: 0, truncated: false, skipped: [] };
  await fill(dir, result.tree, result, "");
  return result;
}

async function fill(
  dir: FileSystemDirectoryHandle,
  out: FileSystemTree,
  ctx: ConvertResult,
  prefix: string,
): Promise<void> {
  if (ctx.truncated) return;
  const entries = await readEntries(dir);
  for (const [name, h] of entries) {
    if (SKIP_DIRS.has(name)) continue;
    if (ctx.fileCount >= MAX_TOTAL_FILES) { ctx.truncated = true; return; }
    if (h.kind === "directory") {
      const sub: DirectoryNode = { directory: {} };
      out[name] = sub;
      await fill(h as FileSystemDirectoryHandle, sub.directory, ctx, `${prefix}${name}/`);
    } else {
      const file = await (h as FileSystemFileHandle).getFile();
      if (file.size > MAX_FILE_BYTES) {
        ctx.skipped.push(`${prefix}${name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const node: FileNode = { file: { contents: buf } };
      out[name] = node;
      ctx.fileCount++;
    }
  }
}

/* Write a single file back to the picked directory (for AI-edited files). */
export async function writeBackToDir(
  root: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  const filename = parts.pop()!;
  let cur = root;
  for (const p of parts) {
    cur = await cur.getDirectoryHandle(p, { create: true });
  }
  const fh = await cur.getFileHandle(filename, { create: true });
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = await (fh as any).createWritable();
  await w.write(content);
  await w.close();
}
