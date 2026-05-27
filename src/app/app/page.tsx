"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { CoderView } from "@/components/CoderView";
import { SettingsModal } from "@/components/SettingsModal";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ArtifactPanel } from "@/components/ArtifactPanel";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

export default function AppPage() {
  const view = useStore((s) => s.view);
  const artifact = useStore((s) => s.artifact);
  const setUser = useStore((s) => s.setUser);
  const loadChats = useStore((s) => s.loadChats);

  useEffect(() => {
    const sb = createClient();
    if (!sb) { loadChats(null); return; }
    sb.auth.getUser().then(({ data }) => {
      const u = data.user;
      setUser(u?.id ?? null, u?.email ?? null);
      loadChats(u?.id ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u?.id ?? null, u?.email ?? null);
      loadChats(u?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [setUser, loadChats]);

  useEffect(() => {
    const theme = useStore.getState().config.theme;
    document.documentElement.classList.toggle("light", theme === "light");
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "n") { e.preventDefault(); useStore.getState().newChat(e.shiftKey); }
      if (mod && e.key === ",") { e.preventDefault(); useStore.getState().setSettingsOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          {view === "chat" ? <ChatView /> : <CoderView />}
        </main>
        {artifact && <ArtifactPanel />}
        <SettingsModal />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
