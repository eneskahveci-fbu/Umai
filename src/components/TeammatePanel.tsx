"use client";
import { useState, useEffect, type ReactNode } from "react";
import {
  X, Plus, Clock, CheckCircle2, AlertCircle, Loader2,
  Trash2, MessageSquare, XCircle,
} from "lucide-react";
import {
  createTask,
  getTaskQueue,
  updateTask,
  cancelTask,
  deleteTask,
  notifyDone,
  type TeammateTask,
  type TeammateTaskType,
} from "@/lib/teammate";
import { hasIndexedDB } from "@/lib/capabilities";

interface Props {
  onClose: () => void;
  /** Görev sonucunu sohbete taşır (composer'a yazar). */
  onAddToChat?: (content: string) => void;
  /** Aktif model ve API anahtarıyla tek-seferlik bir AI çağrısı yapar. */
  onRunTask?: (prompt: string, onChunk: (chunk: string) => void) => Promise<void>;
}

const TASK_TYPE_LABELS: Record<TeammateTaskType, string> = {
  review: "Kod İncelemesi",
  refactor: "Refactor Önerisi",
  document: "Dokümantasyon",
  analyze: "Borç Analizi",
  changelog: "CHANGELOG",
  readme: "README Güncelle",
  custom: "Serbest Görev",
};

const STATUS_ICON: Record<string, ReactNode> = {
  pending: <Clock size={12} className="text-muted/50" />,
  running: <Loader2 size={12} className="text-brand animate-spin" />,
  done: <CheckCircle2 size={12} className="text-green" />,
  error: <AlertCircle size={12} className="text-red" />,
  cancelled: <XCircle size={12} className="text-muted/30" />,
};

/* AI Takım Arkadaşı — arka planda çalışan bir görev kuyruğu. Sekme kapanınca
   IndexedDB'de dondurulur, açılınca kaldığı yerden devam eder (5sn'lik
   yoklama ile senkron kalır — birden çok sekme/pencere aynı kuyruğu görsün
   diye). Görevlerin KENDİSİ (hangi model/sistem promptu) `onRunTask`
   üzerinden çağıran tarafa (CoderView) devredilir — bu panel yalnız kuyruk
   UI'sidir. */
export function TeammatePanel({ onClose, onAddToChat, onRunTask }: Props) {
  const [tasks, setTasks] = useState<TeammateTask[]>([]);
  const [newPrompt, setNewPrompt] = useState("");
  const [newType, setNewType] = useState<TeammateTaskType>("custom");
  const [adding, setAdding] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const q = await getTaskQueue();
      if (active) setTasks(q);
    };
    const id = setInterval(() => void poll(), 5000);
    void poll();
    return () => { active = false; clearInterval(id); };
  }, []);

  async function runTask(task: TeammateTask) {
    if (!onRunTask || runningId) return;
    setRunningId(task.id);
    await updateTask(task.id, { status: "running" });
    setTasks(await getTaskQueue());
    let result = "";
    try {
      await onRunTask(task.prompt, (chunk) => { result += chunk; });
      await updateTask(task.id, { status: "done", result, completedAt: Date.now() });
      await notifyDone(task.label);
    } catch (e) {
      await updateTask(task.id, {
        status: "error",
        error: (e as Error).message,
        completedAt: Date.now(),
      });
    }
    setRunningId(null);
    setTasks(await getTaskQueue());
  }

  async function addTask() {
    if (!newPrompt.trim()) return;
    setAdding(true);
    const label = `${TASK_TYPE_LABELS[newType]}: ${newPrompt.slice(0, 40)}${newPrompt.length > 40 ? "…" : ""}`;
    const task = await createTask(newType, label, newPrompt);
    setNewPrompt("");
    setAdding(false);
    if (task) {
      setTasks(await getTaskQueue());
      // Görev eklenince hemen çalıştır
      if (onRunTask) void runTask(task);
    }
  }

  const gate = hasIndexedDB();

  return (
    <div className="w-full h-full flex flex-col bg-surface/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-line/60 shrink-0">
        <span className="text-xs font-bold text-muted/70 uppercase tracking-wide">AI Takım Arkadaşı</span>
        <button onClick={onClose} className="text-muted/40 hover:text-muted transition-colors">
          <X size={13} />
        </button>
      </div>

      {!gate && (
        <p className="text-[11px] text-muted/50 p-4 text-center">
          IndexedDB bu tarayıcıda kullanılamıyor (gizli sekme?).
        </p>
      )}

      {gate && (
        <>
          {/* Yeni görev formu */}
          <div className="px-3 py-2 border-b border-line/40 shrink-0 space-y-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TeammateTaskType)}
              className="w-full text-xs bg-bgsoft border border-line/40 rounded-lg px-2 py-1.5 text-ink"
            >
              {(Object.entries(TASK_TYPE_LABELS) as [TeammateTaskType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Görevi açıkla… (ör. 'auth.ts dosyasını incele')"
              rows={3}
              className="w-full text-xs bg-bgsoft border border-line/40 rounded-lg px-2 py-1.5 text-ink resize-none placeholder:text-muted/40"
            />
            <button
              onClick={addTask}
              disabled={!newPrompt.trim() || adding}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand text-xs font-medium transition-colors disabled:opacity-40"
            >
              <Plus size={12} />
              {adding ? "Ekleniyor…" : "Görevi Ekle & Başlat"}
            </button>
          </div>

          {/* Görev listesi */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tasks.length === 0 && (
              <p className="text-[11px] text-muted/40 text-center px-4 pt-8">
                Henüz görev yok. Yukarıdan ekle.
              </p>
            )}
            {tasks.map((t) => (
              <div key={t.id} className="px-3 py-2.5 border-b border-line/20 hover:bg-bgsoft/50 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">{STATUS_ICON[t.status]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-ink/90 leading-tight break-words">{t.label}</p>
                    <p className="text-[9px] text-muted/40 mt-0.5">
                      {TASK_TYPE_LABELS[t.type]} · {new Date(t.createdAt).toLocaleTimeString("tr-TR")}
                    </p>
                    {t.result && (
                      <p className="text-[10px] text-muted/70 mt-1 line-clamp-2">{t.result}</p>
                    )}
                    {t.error && (
                      <p className="text-[10px] text-red/80 mt-1">Hata: {t.error}</p>
                    )}
                  </div>
                </div>
                {/* Aksiyonlar */}
                <div className="flex gap-2 mt-1.5 ml-5">
                  {t.status === "done" && t.result && onAddToChat && (
                    <ActionBtn icon={<MessageSquare size={10} />} label="Sohbete ekle" onClick={() => onAddToChat(t.result!)} />
                  )}
                  {t.status === "pending" && onRunTask && (
                    <ActionBtn icon={<Loader2 size={10} />} label="Şimdi çalıştır" onClick={() => void runTask(t)} />
                  )}
                  {t.status === "running" && (
                    <ActionBtn icon={<XCircle size={10} />} label="İptal" onClick={() => void cancelTask(t.id).then(getTaskQueue).then(setTasks)} />
                  )}
                  {(t.status === "done" || t.status === "error" || t.status === "cancelled") && (
                    <ActionBtn icon={<Trash2 size={10} />} label="Sil" onClick={() => void deleteTask(t.id).then(getTaskQueue).then(setTasks)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[10px] text-muted/60 hover:text-brand transition-colors">
      {icon} {label}
    </button>
  );
}
