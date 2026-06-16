"use client";

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

/* Landing page'de terminal kurulum komutu (Mac & Linux) — tek tık kopyala. */
const CMD = "curl -fsSL https://craft-coder.vercel.app/install.sh | sh";

export function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* yok say */ }
  };

  return (
    <div className="mt-6 w-full max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-muted/70 mb-2 justify-center">
        <Terminal size={13} className="text-brand" />
        <span>Terminalden tek komutla (Mac &amp; Linux)</span>
      </div>
      <button
        onClick={copy}
        title="Kopyala"
        className="group w-full flex items-center gap-3 bg-surface border border-line hover:border-brand/50 rounded-xl px-4 py-3 font-mono text-sm text-left transition-colors"
      >
        <span className="text-brand/70 select-none">$</span>
        <code className="flex-1 truncate text-ink">{CMD}</code>
        {copied ? (
          <Check size={15} className="text-green shrink-0" />
        ) : (
          <Copy size={15} className="text-muted/50 group-hover:text-brand shrink-0 transition-colors" />
        )}
      </button>
      <p className="text-[11px] text-muted/50 mt-2 text-center">
        Ardından <code className="text-brand/80">craft-coder</code> yazıp çalıştır. (Veya{" "}
        <code className="text-brand/80">npm i -g craft-coder</code>)
      </p>
    </div>
  );
}
