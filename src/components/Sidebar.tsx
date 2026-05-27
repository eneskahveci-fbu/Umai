"use client";

import {
  Code2,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  VenetianMask,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthButton } from "./AuthButton";

export function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  const history = chats
    .filter((c) => !c.incognito)
    .sort((a, b) => b.created_at - a.created_at);

  return (
    <aside
      className={`fixed md:static z-40 h-full w-[280px] shrink-0 flex flex-col bg-surface border-r border-line transition-transform ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Üst: marka + sekmeler */}
      <div className="p-4 border-b border-line">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <span className="w-7 h-7 rounded-lg brand-gradient grid place-items-center text-white text-sm">
              ◆
            </span>
            craft<span className="brand-text">.ai</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-muted p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <TabButton
            active={view === "chat"}
            onClick={() => setView("chat")}
            icon={<MessageSquare size={15} />}
            label="Sohbet"
          />
          <TabButton
            active={view === "coder"}
            onClick={() => setView("coder")}
            icon={<Code2 size={15} />}
            label="Coder"
          />
        </div>
      </div>

      {/* Eylemler */}
      <div className="p-3 flex flex-col gap-2 border-b border-line">
        <button
          onClick={() => newChat(false)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand hover:bg-branddim text-white font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> Yeni Sohbet
        </button>
        <button
          onClick={() => newChat(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line hover:border-purple/60 text-sm text-muted hover:text-ink transition-colors"
        >
          <VenetianMask size={16} /> Gizli Sohbet
        </button>
      </div>

      {/* Geçmiş */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-2">
          Geçmiş Sohbetler
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted px-2 leading-relaxed">
            Henüz kayıtlı sohbet yok. &quot;Yeni Sohbet&quot; ile başla.
          </p>
        ) : (
          history.map((c) => (
            <div
              key={c.id}
              onClick={() => selectChat(c.id)}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer mb-0.5 text-sm ${
                currentId === c.id ? "bg-bgsoft" : "hover:bg-bgsoft/60"
              }`}
            >
              <MessageSquare size={14} className="shrink-0 text-muted" />
              <span className="flex-1 truncate">{c.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(c.id);
                }}
                className="opacity-0 group-hover:opacity-70 hover:!opacity-100 text-muted hover:text-red"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Alt: ayarlar + giriş + dev */}
      <div className="p-3 border-t border-line flex flex-col gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm"
        >
          <Settings size={15} /> Ayarlar
        </button>
        <AuthButton />
        <DevCredit />
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
        active
          ? "bg-brand/12 text-brand border-branddim"
          : "border-line text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function DevCredit() {
  return (
    <div className="text-center text-[11px] text-muted leading-relaxed pt-1">
      Geliştirici ·{" "}
      <span className="text-ink font-semibold">Enes Kahveci</span>
      <br />
      <a
        href="mailto:eneskahveci.bs@gmail.com"
        className="hover:text-brand"
      >
        eneskahveci.bs@gmail.com
      </a>
    </div>
  );
}
