"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

interface AccordionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/* Tiny accordion section that remembers its open/close state per `id`
   in localStorage. Designed for sidebars / settings panes. */
export function AccordionSection({ id, title, icon, badge, action, defaultOpen = false, children }: AccordionProps) {
  const storageKey = `craftai_acc_${id}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      /* Restoring persisted state on mount must run in an effect (not a lazy
         initializer) to avoid an SSR/client hydration mismatch. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setOpen(raw === "1");
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="border-b border-line/40 last:border-b-0">
      <div className="flex items-stretch group/acc">
        <button
          onClick={toggle}
          className="flex-1 flex items-center gap-2 px-3 py-2 text-left hover:bg-bgsoft/40 transition-colors"
        >
          <ChevronDown
            size={11}
            className={`text-muted/40 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
          {icon && <span className="text-muted/60 shrink-0">{icon}</span>}
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted/60 flex-1 truncate">{title}</span>
          {badge && <span className="text-[10px] text-muted/40 font-mono shrink-0">{badge}</span>}
        </button>
        {action && (
          <div className="flex items-center pr-2 opacity-0 group-hover/acc:opacity-100 transition-opacity">
            {action}
          </div>
        )}
      </div>
      <div
        className={`grid transition-all duration-200 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          {open && <div className="px-2 pb-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}
