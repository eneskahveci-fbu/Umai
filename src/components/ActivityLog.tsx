"use client";

import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  FileEdit,
  Loader2,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";

type Entry =
  | { kind: "tool"; name: string; status: "pending" | "done" | "error"; detail?: string }
  | { kind: "command"; command: string; status: "running" | "done" | "error" }
  | { kind: "write"; path: string; created: boolean };

/* Denetim günlüğü: aktif sohbette ajanın yaptığı işlemleri (araç çağrıları,
   terminal komutları, dosya değişiklikleri) salt-okunur, kronolojik gösterir.
   Mevcut mesaj verisinden türetilir — yeni veri toplamaz, güvenli ve additive. */
export function ActivityLog() {
  const open = useStore((s) => s.activityOpen);
  const setOpen = useStore((s) => s.setActivityOpen);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);

  const chat = chats.find((c) => c.id === currentId) ?? null;

  const turns = useMemo(() => {
    if (!chat) return [] as { index: number; entries: Entry[] }[];
    const out: { index: number; entries: Entry[] }[] = [];
    chat.messages.forEach((m, i) => {
      if (m.role !== "assistant") return;
      const entries: Entry[] = [];
      for (const t of m.toolCalls ?? []) {
        let detail: string | undefined;
        try {
          const args = JSON.parse(t.arguments || "{}");
          detail = args.path || args.command || args.pattern || args.query || undefined;
        } catch { /* yok say */ }
        entries.push({ kind: "tool", name: t.name, status: t.status, detail });
      }
      for (const c of m.commands ?? []) {
        entries.push({ kind: "command", command: c.command, status: c.status });
      }
      for (const cp of m.checkpoints ?? []) {
        entries.push({ kind: "write", path: cp.path, created: cp.previous === null });
      }
      if (entries.length > 0) out.push({ index: i, entries });
    });
    return out;
  }, [chat]);

  if (!open) return null;

  const total = turns.reduce((a, t) => a + t.entries.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-line/60">
          <Activity size={16} className="text-brand" />
          <h3 className="font-bold text-sm flex-1">Etkinlik Günlüğü</h3>
          <span className="text-[11px] text-muted/60 tabular-nums">{total} işlem</span>
          <button onClick={() => setOpen(false)} className="text-muted hover:text-ink p-1" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {turns.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Activity size={22} className="mx-auto mb-2 text-muted/20" />
              <p className="text-[12px] text-muted/50 leading-relaxed">
                Bu sohbette henüz ajan işlemi yok.<br />
                Yapay zekâ dosya okuyup/yazdığında veya komut çalıştırdığında burada görünür.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.index}>
                <div className="text-[10px] uppercase tracking-widest text-muted/40 font-bold mb-1.5">
                  Tur #{Math.ceil((turn.index + 1) / 2)}
                </div>
                <div className="space-y-1">
                  {turn.entries.map((e, j) => (
                    <ActivityRow key={j} entry={e} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: Entry }) {
  const status = "status" in entry ? entry.status : "done";
  const statusIcon =
    status === "error" ? <AlertTriangle size={12} className="text-red shrink-0" />
    : status === "pending" || status === "running" ? <Loader2 size={12} className="text-muted/60 shrink-0 animate-spin" />
    : <Check size={12} className="text-green/80 shrink-0" />;

  let icon: React.ReactNode;
  let label: string;
  let detail: string | undefined;
  if (entry.kind === "tool") {
    icon = <Wrench size={13} className="text-brand/70 shrink-0" />;
    label = entry.name;
    detail = entry.detail;
  } else if (entry.kind === "command") {
    icon = <Terminal size={13} className="text-brand/70 shrink-0" />;
    label = "komut";
    detail = entry.command;
  } else {
    icon = <FileEdit size={13} className="text-yellow/80 shrink-0" />;
    label = entry.created ? "oluşturuldu" : "değiştirildi";
    detail = entry.path;
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bgsoft/60 border border-line/40 text-[12px]">
      {icon}
      <span className="font-medium shrink-0">{label}</span>
      {detail && <span className="font-mono text-[11px] text-muted/70 truncate flex-1">{detail}</span>}
      {!detail && <span className="flex-1" />}
      {statusIcon}
    </div>
  );
}
