"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_AGENTS, type Agent } from "@/lib/agents";
import { getUserAgents } from "@/lib/extensions/customAgents";

interface Props {
  query: string;
  onSelect: (agent: Agent) => void;
  onClose: () => void;
}

export function SlashMenu({ query, onSelect, onClose }: Props) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  /* Kullanıcının kendi tanımladığı slash komutları da menüde görünsün
     (aynı komutta kullanıcınınki yerleşiği ezer). */
  const merged = (() => {
    const seen = new Set<string>();
    const out: Agent[] = [];
    for (const a of [...getUserAgents(), ...ALL_AGENTS]) {
      if (seen.has(a.command)) continue;
      seen.add(a.command);
      out.push(a);
    }
    return out;
  })();

  const q = query.toLowerCase();
  const filtered = merged.filter(
    (a) => a.command.toLowerCase().includes(q) || a.label.toLowerCase().includes(q),
  );

  /* Reset highlight when the query changes — adjusted during render. */
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActive(0);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(filtered[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [filtered, active, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-3 right-3 max-h-72 overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 z-40 animate-fade-in"
    >
      <div className="px-3 py-2 border-b border-line/40 text-[10px] uppercase tracking-widest text-muted/60 font-bold">
        Subagentlar
      </div>
      {filtered.map((a, i) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          onMouseEnter={() => setActive(i)}
          className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
            i === active ? "bg-brand/10" : "hover:bg-bgsoft/60"
          }`}
        >
          <span className="text-lg shrink-0 mt-0.5">{a.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className={`text-xs font-mono font-bold ${i === active ? "text-brand" : "text-ink"}`}>
                {a.command}
              </code>
              <span className="text-xs text-muted">{a.label}</span>
            </div>
            <p className="text-[11px] text-muted/60 mt-0.5 leading-snug">{a.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
