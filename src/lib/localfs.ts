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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("localfs:changed"));
    /* fire-and-forget; failures (e.g. private mode) are silently ignored */
    idbPut(h).catch(() => { /* ignore */ });
  }
}

export function isLocalFsSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/* ----- IndexedDB persistence: keep the picked handle across reloads ----- */
const DB_NAME = "craft-ai-localfs";
const STORE = "handles";
const KEY = "rootDir";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(handle: FileSystemDirectoryHandle | null) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    if (handle) tx.objectStore(STORE).put(handle, KEY);
    else tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function idbGet(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<"granted" | "prompt" | "denied"> {
  const h = handle as any;
  const cur = await h.queryPermission?.({ mode: "readwrite" });
  if (cur === "granted") return "granted";
  return cur === "denied" ? "denied" : "prompt";
}

export async function requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const h = handle as any;
  const r = await h.requestPermission?.({ mode: "readwrite" });
  return r === "granted";
}

/* On app load, try to silently re-mount the last picked folder if permission
   is still granted. Returns true if restored. */
export async function restoreMounted(): Promise<boolean> {
  if (!isLocalFsSupported()) return false;
  try {
    const handle = await idbGet();
    if (!handle) return false;
    const perm = await verifyPermission(handle);
    if (perm !== "granted") return false;
    setMounted(handle, handle.name);
    return true;
  } catch {
    return false;
  }
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
