import type { ChatMessage } from "./types";

/* "Ajan İzi" veri katmanı: sohbet mesajlarından salt-okunur bir iz çıkarır.
   Saf fonksiyonlar — React'ten bağımsız, test edilebilir. Yeni veri toplamaz;
   yalnızca zaten kaydedilmiş tool call / komut / checkpoint kayıtlarını
   kronolojik ve filtrelenebilir bir forma sokar. */

export type TraceKind = "tool" | "command" | "write";
export type TraceStatus = "pending" | "done" | "error";
export type TraceFilter = "all" | TraceKind;

export interface TraceEntry {
  id: string;
  kind: TraceKind;
  /** Kısa etiket: araç adı, "komut", "oluşturuldu" / "değiştirildi". */
  label: string;
  /** Tek satırlık konu: yol, komut, sorgu… */
  detail?: string;
  status: TraceStatus;
  startedAt?: number;
  endedAt?: number;
  /** Genişletildiğinde gösterilen ham girdi (araç argümanları). */
  input?: string;
  /** Genişletildiğinde gösterilen ham çıktı (araç sonucu / komut çıktısı). */
  output?: string;
}

export interface TraceTurn {
  /** Mesaj dizisindeki index. */
  index: number;
  /** 1'den başlayan asistan turu numarası. */
  number: number;
  entries: TraceEntry[];
}

export interface TraceStats {
  tools: number;
  commands: number;
  writes: number;
  errors: number;
  total: number;
  /** Ölçülebilen adımların toplam süresi (ms). */
  durationMs: number;
}

const STATUS_MAP: Record<string, TraceStatus> = {
  pending: "pending",
  running: "pending",
  done: "done",
  error: "error",
};

/** Tool argümanlarından tek satırlık özet çıkarır. */
export function summarizeArgs(argsJson: string | undefined): string | undefined {
  if (!argsJson) return undefined;
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    const candidate =
      args.path ?? args.file ?? args.new_path ?? args.command ?? args.pattern ??
      args.query ?? args.url ?? args.branch ?? args.title;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (Array.isArray(args.tasks)) return `${args.tasks.length} alt görev`;
    return undefined;
  } catch {
    /* JSON değilse ham metnin ilk satırını göster. */
    const first = argsJson.split("\n")[0]?.trim();
    return first ? first.slice(0, 120) : undefined;
  }
}

/** Argümanları okunur biçimde (2 boşluk girintili) döndürür. */
export function prettyJson(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Süreyi kısa ve okunur biçime çevirir. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds > 0 ? `${minutes}d ${seconds}s` : `${minutes}d`;
}

export function entryDuration(entry: TraceEntry): number | undefined {
  if (entry.startedAt == null || entry.endedAt == null) return undefined;
  const diff = entry.endedAt - entry.startedAt;
  return diff >= 0 ? diff : undefined;
}

/** Mesajlardan tur tur iz çıkarır. Boş turlar atlanır. */
export function buildTrace(messages: ChatMessage[]): TraceTurn[] {
  const turns: TraceTurn[] = [];
  let turnNumber = 0;

  messages.forEach((message, index) => {
    if (message.role !== "assistant") return;
    turnNumber += 1;

    const entries: TraceEntry[] = [];

    (message.toolCalls ?? []).forEach((call, i) => {
      entries.push({
        id: `tool-${index}-${call.id || i}`,
        kind: "tool",
        label: call.name,
        detail: summarizeArgs(call.arguments),
        status: STATUS_MAP[call.status] ?? "done",
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        input: prettyJson(call.arguments),
        output: call.result,
      });
    });

    (message.commands ?? []).forEach((command, i) => {
      entries.push({
        id: `cmd-${index}-${i}`,
        kind: "command",
        label: command.kind === "code" ? "kod çalıştırıldı" : "komut",
        detail: command.command,
        status: STATUS_MAP[command.status] ?? "done",
        output: command.output,
      });
    });

    (message.checkpoints ?? []).forEach((checkpoint, i) => {
      entries.push({
        id: `write-${index}-${i}`,
        kind: "write",
        label: checkpoint.previous === null ? "oluşturuldu" : "değiştirildi",
        detail: checkpoint.path,
        status: "done",
      });
    });

    if (entries.length > 0) {
      turns.push({ index, number: turnNumber, entries });
    }
  });

  return turns;
}

export function traceStats(turns: TraceTurn[]): TraceStats {
  const stats: TraceStats = {
    tools: 0,
    commands: 0,
    writes: 0,
    errors: 0,
    total: 0,
    durationMs: 0,
  };
  for (const turn of turns) {
    for (const entry of turn.entries) {
      stats.total += 1;
      if (entry.kind === "tool") stats.tools += 1;
      else if (entry.kind === "command") stats.commands += 1;
      else stats.writes += 1;
      if (entry.status === "error") stats.errors += 1;
      stats.durationMs += entryDuration(entry) ?? 0;
    }
  }
  return stats;
}

/** Filtre + arama uygular; boşalan turları düşürür. */
export function filterTrace(
  turns: TraceTurn[],
  filter: TraceFilter,
  query = "",
): TraceTurn[] {
  const needle = query.trim().toLowerCase();
  if (filter === "all" && !needle) return turns;

  return turns
    .map((turn) => ({
      ...turn,
      entries: turn.entries.filter((entry) => {
        if (filter !== "all" && entry.kind !== filter) return false;
        if (!needle) return true;
        return [entry.label, entry.detail, entry.input, entry.output]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle));
      }),
    }))
    .filter((turn) => turn.entries.length > 0);
}

export const KIND_LABEL: Record<TraceKind, string> = {
  tool: "Araç",
  command: "Komut",
  write: "Dosya",
};

export const STATUS_LABEL: Record<TraceStatus, string> = {
  pending: "Sürüyor",
  done: "Bitti",
  error: "Hata",
};
