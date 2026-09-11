/* Kalıcı AI Takım Arkadaşı: IndexedDB-tabanlı görev kuyruğu.
   Sayfa kapanınca görevler dondurulur, açılınca devam eder.
   Gate: hasIndexedDB() — SSR-safe. Bu modül yalnız KUYRUĞU yönetir; asıl AI
   çağrısını (hangi model/sistem promptu) çağıran taraf yapar (bkz.
   TeammatePanel.tsx'in onRunTask prop'u) — böylece kuyruk, CoderView'un
   model/fallback/anahtar mantığına bağımlı olmaz. */

import { hasIndexedDB } from "./capabilities";

const DB_NAME = "craftai_teammate";
const DB_VERSION = 1;
const STORE_NAME = "tasks";

export type TeammateTaskType =
  | "review" // Kod incelemesi
  | "refactor" // Yeniden düzenleme önerisi
  | "document" // Dokümantasyon üretimi
  | "analyze" // Teknik borç analizi
  | "changelog" // CHANGELOG oluştur
  | "readme" // README güncelle
  | "custom"; // Serbest görev

export type TeammateTaskStatus = "pending" | "running" | "done" | "error" | "cancelled";

export interface TeammateTask {
  id: string;
  type: TeammateTaskType;
  label: string;
  prompt: string;
  status: TeammateTaskStatus;
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const os = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        os.createIndex("createdAt", "createdAt", { unique: false });
        os.createIndex("status", "status", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Yeni görev oluşturur ve IndexedDB'ye kaydeder. */
export async function createTask(
  type: TeammateTaskType,
  label: string,
  prompt: string,
): Promise<TeammateTask | null> {
  if (!hasIndexedDB()) return null;
  const task: TeammateTask = {
    id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    label,
    prompt,
    status: "pending",
    createdAt: Date.now(),
  };
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(task);
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    db.close();
    return task;
  } catch { return null; }
}

/** Tüm görevleri tarihe göre sıralı (en yeni önce) döndürür. */
export async function getTaskQueue(): Promise<TeammateTask[]> {
  if (!hasIndexedDB()) return [];
  try {
    const db = await openDB();
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME)
      .index("createdAt").getAll();
    const tasks: TeammateTask[] = await new Promise((res, rej) => {
      req.onsuccess = () => res((req.result as TeammateTask[]).reverse());
      req.onerror = () => rej(req.error);
    });
    db.close();
    return tasks;
  } catch { return []; }
}

/** Görev durumunu/alanlarını günceller. */
export async function updateTask(id: string, patch: Partial<TeammateTask>): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const os = tx.objectStore(STORE_NAME);
    const getReq = os.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as TeammateTask | undefined;
      if (existing) os.put({ ...existing, ...patch });
    };
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    db.close();
  } catch { /* sessiz */ }
}

/** Görevi iptal eder. */
export async function cancelTask(id: string): Promise<void> {
  await updateTask(id, { status: "cancelled", completedAt: Date.now() });
}

/** Tamamlanan görevi siler. */
export async function deleteTask(id: string): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    db.close();
  } catch { /* sessiz */ }
}

/** Tamamlanınca tarayıcı bildirimi gönderir (izin zaten verilmişse). */
export async function notifyDone(label: string): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification("Umai: Görev tamamlandı", {
      body: label,
      icon: "/icon-192.png",
    });
  }
}
