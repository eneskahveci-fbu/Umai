"use client";
import { useState } from "react";
import { Sparkles, Plus, Loader2, ChevronDown, Link2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ALL_AGENTS, type Agent } from "@/lib/agents";
import { CATALOG_AGENTS } from "@/lib/agentCatalog";

/** Açık kaynak ajan içe-aktarma: (1) URL'den (GitHub raw, gist…) sistem prompt'u
 *  çekip ajan oluşturur, (2) gömülü kürate katalogdan tek tıkla ekler. Komut
 *  çakışırsa otomatik numaralanır. AgentsTab'ın persist'iyle çalışır → liste anında güncellenir. */
export default function AgentImport({
  userAgents,
  persist,
}: {
  userAgents: Agent[];
  persist: (next: Agent[]) => void;
}) {
  const addToast = useStore((s) => s.addToast);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const exists = (command: string) => [...ALL_AGENTS, ...userAgents].some((a) => a.command === command);

  const addAgent = (a: Agent) => {
    let command = a.command.startsWith("/") ? a.command : `/${a.command}`;
    if (exists(command)) {
      let n = 2;
      while (exists(`${command}-${n}`)) n++;
      command = `${command}-${n}`;
    }
    const agent: Agent = { ...a, command, id: `cat_${command.slice(1)}_${Date.now().toString(36)}` };
    persist([...userAgents, agent]);
    addToast(`${command} eklendi`, "success");
  };

  const importUrl = async () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { addToast("Geçerli bir http(s) URL gir", "error"); return; }
    setLoading(true);
    try {
      // Sunucu proxy → CORS engeli yok (GitHub raw, gist, herhangi public URL).
      const res = await fetch(`/api/fetch-text?url=${encodeURIComponent(u)}`);
      const body = await res.json().catch(() => ({})) as { text?: string; error?: string };
      if (!res.ok || !body.text) throw new Error(body.error || `HTTP ${res.status}`);
      const text = body.text;
      const base =
        decodeURIComponent(u.split("/").pop() || "")
          .replace(/\.[a-z]+$/i, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "ajan";
      addAgent({
        id: "",
        command: `/${base}`,
        label: base,
        icon: "🤖",
        description: "URL'den içe aktarılan ajan",
        systemPrompt: text,
        placeholder: "Mesaj…",
      });
      setUrl("");
    } catch (e) {
      addToast(`Getirilemedi (${(e as Error).message}). GitHub'da dosyanın "Raw" linkini kullan.`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-line/60 bg-bgsoft/30 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold hover:bg-bgsoft/50 transition-colors"
      >
        <Sparkles size={15} className="text-brand" />
        İçe Aktar / Hazır Katalog
        <ChevronDown size={15} className={`ml-auto text-muted/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-line/40 pt-3">
          {/* URL'den içe aktar */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-bgsoft/60 rounded-lg px-2.5">
              <Link2 size={13} className="text-muted/60 shrink-0" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") importUrl(); }}
                placeholder="URL (GitHub raw, gist…) — ajan olarak ekler"
                className="flex-1 min-w-0 bg-transparent py-2 text-xs outline-none placeholder:text-muted/35"
              />
            </div>
            <button
              onClick={importUrl}
              disabled={loading || !url.trim()}
              className="shrink-0 px-3 rounded-lg bg-brand hover:bg-branddim text-white grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="URL'den içe aktar"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </div>

          {/* Hazır katalog */}
          <div className="space-y-1.5">
            {CATALOG_AGENTS.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 bg-bgsoft/40 rounded-lg px-3 py-2">
                <span className="text-base shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-ink truncate">{a.label}</div>
                  <div className="text-[10px] text-muted/60 truncate">{a.description}</div>
                </div>
                <button
                  onClick={() => addAgent(a)}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-md border border-line hover:border-brand/50 text-muted hover:text-ink transition-colors"
                >
                  Ekle
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
