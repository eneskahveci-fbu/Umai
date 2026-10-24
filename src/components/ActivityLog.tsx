"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  FileEdit,
  FilePlus2,
  Loader2,
  Search,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  KIND_LABEL,
  STATUS_LABEL,
  buildTrace,
  entryDuration,
  filterTrace,
  formatDuration,
  traceStats,
  type TraceEntry,
  type TraceFilter,
} from "@/lib/activityTrace";

const FILTERS: { id: TraceFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "tool", label: "Araçlar" },
  { id: "command", label: "Komut" },
  { id: "write", label: "Dosya" },
];

/* Ajan İzi — aktif sohbette ajanın ne yaptığını adım adım gösteren salt-okunur
   zaman çizelgesi. Veri mevcut mesaj kayıtlarından türetilir (bkz.
   lib/activityTrace.ts); panel yeni bir şey toplamaz, yalnızca görünür kılar. */
export function ActivityLog() {
  const open = useStore((s) => s.activityOpen);
  const setOpen = useStore((s) => s.setActivityOpen);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);

  const [filter, setFilter] = useState<TraceFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = chats.find((c) => c.id === currentId) ?? null;
  const turns = useMemo(() => buildTrace(chat?.messages ?? []), [chat]);
  const stats = useMemo(() => traceStats(turns), [turns]);
  const visible = useMemo(() => filterTrace(turns, filter, query), [turns, filter, query]);
  const visibleCount = visible.reduce((sum, turn) => sum + turn.entries.length, 0);

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const copy = useCallback((entry: TraceEntry) => {
    const text = [entry.input, entry.output].filter(Boolean).join("\n\n");
    if (!text) return;
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(entry.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <aside
        className="trace-drawer relative flex h-full w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-title"
      >
        {/* Başlık */}
        <header className="relative border-b border-line/70 px-5 pt-5 pb-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/[0.07] to-transparent" />
          <div className="relative flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
              <Activity size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="activity-title" className="text-[15px] font-bold tracking-tight">
                Ajan İzi
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Bu sohbette ne oldu, adım adım. Salt okunur kayıt.
              </p>
            </div>
            <button
              ref={closeRef}
              onClick={close}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Özet şerit */}
          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCell label="Adım" value={stats.total} />
            <StatCell label="Araç" value={stats.tools} />
            <StatCell label="Komut" value={stats.commands} />
            <StatCell
              label="Süre"
              value={stats.durationMs > 0 ? formatDuration(stats.durationMs) : "—"}
              tone={stats.durationMs > 0 ? "brand" : "muted"}
            />
          </div>

          {stats.errors > 0 && (
            <p className="relative mt-2 inline-flex items-center gap-1.5 text-[11px] text-red/90">
              <AlertTriangle size={11} /> {stats.errors} adım hata ile bitti
            </p>
          )}
        </header>

        {/* Araç çubuğu */}
        <div className="flex flex-col gap-2.5 border-b border-line/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/60" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="İz içinde ara: dosya, komut, araç…"
                aria-label="İz içinde ara"
                className="h-8 w-full rounded-lg border border-line/70 bg-bgsoft/60 pl-8 pr-7 text-[12px] text-ink placeholder:text-muted/50 focus:border-brand/40 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted/60 hover:text-ink"
                  aria-label="Aramayı temizle"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted/60">
              {visibleCount}/{stats.total}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((item) => {
              const active = filter === item.id;
              const count =
                item.id === "all"
                  ? stats.total
                  : item.id === "tool"
                    ? stats.tools
                    : item.id === "command"
                      ? stats.commands
                      : stats.writes;
              return (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-line/70 bg-transparent text-muted hover:border-line hover:text-ink"
                  }`}
                >
                  {item.label}
                  <span className={`tabular-nums ${active ? "text-brand/70" : "text-muted/50"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zaman çizelgesi */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {visible.length === 0 ? (
            <EmptyState hasAny={turns.length > 0} onReset={() => { setFilter("all"); setQuery(""); }} />
          ) : (
            <div className="space-y-5">
              {visible.map((turn) => (
                <section key={turn.index} aria-label={`Tur ${turn.number}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted/50">
                      Tur {turn.number}
                    </span>
                    <span className="h-px flex-1 bg-line/50" />
                    <span className="text-[10px] tabular-nums text-muted/40">
                      {turn.entries.length} adım
                    </span>
                  </div>
                  <ol className="relative ml-[13px] border-l border-line/60 pl-4">
                    {turn.entries.map((entry) => (
                      <TraceRow
                        key={entry.id}
                        entry={entry}
                        expanded={expanded === entry.id}
                        copied={copied === entry.id}
                        onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                        onCopy={() => copy(entry)}
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Alt bilgi */}
        <footer className="flex items-center justify-between gap-3 border-t border-line/70 px-5 py-2.5 text-[10.5px] text-muted/60">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={11} /> Sohbet kaydından türetilir
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-line/80 bg-bgsoft px-1 py-0.5 font-mono text-[10px] text-muted">Esc</kbd>
            kapat
          </span>
        </footer>
      </aside>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "brand" | "muted";
}) {
  const valueClass =
    tone === "brand" ? "text-brand" : tone === "muted" ? "text-muted" : "text-ink";
  return (
    <div className="rounded-xl border border-line/60 bg-bgsoft/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted/60">{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function TraceRow({
  entry,
  expanded,
  copied,
  onToggle,
  onCopy,
}: {
  entry: TraceEntry;
  expanded: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const duration = entryDuration(entry);
  const hasBody = Boolean(entry.input || entry.output);

  return (
    <li className="relative pb-1.5 last:pb-0">
      {/* Zaman çizelgesi noktası */}
      <span
        className={`absolute -left-[21px] top-[13px] grid h-[9px] w-[9px] place-items-center rounded-full ring-4 ring-surface ${
          entry.status === "error"
            ? "bg-red"
            : entry.status === "pending"
              ? "animate-pulse bg-yellow"
              : "bg-brand/80"
        }`}
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-xl border border-line/50 bg-bgsoft/40 transition-colors hover:border-brand/25 hover:bg-bgsoft/70">
        <button
          onClick={onToggle}
          disabled={!hasBody}
          aria-expanded={hasBody ? expanded : undefined}
          className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
        >
          <span className="mt-0.5 shrink-0">{entryIcon(entry)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[12.5px] font-semibold text-ink">{entry.label}</span>
              <StatusBadge status={entry.status} />
              {duration != null && (
                <span className="font-mono text-[10px] tabular-nums text-muted/60">
                  {formatDuration(duration)}
                </span>
              )}
            </span>
            {entry.detail && (
              <span className="mt-0.5 block truncate font-mono text-[11px] text-muted/75">
                {entry.detail}
              </span>
            )}
          </span>
          {hasBody && (
            <ChevronDown
              size={13}
              className={`mt-1 shrink-0 text-muted/50 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {expanded && hasBody && (
          <div className="space-y-2 border-t border-line/50 px-3 py-2.5">
            {entry.input && <TraceBlock title="Girdi" body={entry.input} />}
            {entry.output && <TraceBlock title="Çıktı" body={entry.output} />}
            <div className="flex justify-end">
              <button
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-line/70 px-2 py-1 text-[10.5px] text-muted transition-colors hover:border-brand/30 hover:text-ink"
              >
                {copied ? <Check size={11} className="text-green" /> : <Clipboard size={11} />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function entryIcon(entry: TraceEntry) {
  if (entry.kind === "command") return <Terminal size={13} className="text-cyan/80" />;
  if (entry.kind === "write") {
    return entry.label === "oluşturuldu" ? (
      <FilePlus2 size={13} className="text-yellow/80" />
    ) : (
      <FileEdit size={13} className="text-yellow/80" />
    );
  }
  return <Wrench size={13} className="text-brand/80" />;
}

function StatusBadge({ status }: { status: TraceEntry["status"] }) {
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-red">
        <AlertTriangle size={8} /> {STATUS_LABEL.error}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-yellow">
        <Loader2 size={8} className="animate-spin" /> {STATUS_LABEL.pending}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-green/90">
      <Check size={8} /> {STATUS_LABEL.done}
    </span>
  );
}

function TraceBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-muted/50">{title}</p>
      <pre className="max-h-48 overflow-auto rounded-lg border border-line/60 bg-codebg/80 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-ink/80 whitespace-pre-wrap break-words">
        {body.length > 4000 ? `${body.slice(0, 4000)}\n… (${body.length - 4000} karakter kısaltıldı)` : body}
      </pre>
    </div>
  );
}

function EmptyState({ hasAny, onReset }: { hasAny: boolean; onReset: () => void }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="relative mb-4 grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 rounded-full border border-brand/15" />
        <span className="absolute inset-2 rounded-full border border-brand/20" />
        <span className="absolute inset-4 rounded-full bg-brand/[0.07]" />
        <Activity size={20} className="relative text-brand/60" />
      </div>
      {hasAny ? (
        <>
          <p className="text-[13px] font-semibold text-ink">Bu filtreye uyan adım yok</p>
          <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-muted/70">
            Aramayı temizleyip tüm adımlara dön.
          </p>
          <button
            onClick={onReset}
            className="mt-4 rounded-lg border border-line/70 px-3 py-1.5 text-[11.5px] text-muted transition-colors hover:border-brand/30 hover:text-ink"
          >
            Filtreleri sıfırla
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] font-semibold text-ink">Henüz iz yok</p>
          <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-muted/70">
            Ajan bir dosya okuduğunda, düzenlediğinde veya komut çalıştırdığında
            her adım burada süresiyle birlikte görünür.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {(["tool", "command", "write"] as const).map((kind) => (
              <span
                key={kind}
                className="rounded-full border border-line/60 px-2 py-0.5 text-[10px] text-muted/60"
              >
                {KIND_LABEL[kind]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
