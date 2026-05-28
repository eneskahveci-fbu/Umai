"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { CoderView } from "@/components/CoderView";
import { SettingsModal } from "@/components/SettingsModal";
import { PromptLibrary } from "@/components/PromptLibrary";
import { CommandPalette } from "@/components/CommandPalette";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Onboarding } from "@/components/Onboarding";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

export default function AppPage() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setUser = useStore((s) => s.setUser);
  const loadChats = useStore((s) => s.loadChats);

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(false);
  }, [setSidebarOpen]);

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "n") { e.preventDefault(); useStore.getState().newChat(false); }
      if (mod && e.key === ",") { e.preventDefault(); useStore.getState().setSettingsOpen(true); }
      if (mod && e.key === "k") { e.preventDefault(); useStore.getState().setCommandPaletteOpen(true); }
      if (mod && e.key === "b") { e.preventDefault(); useStore.getState().setSidebarOpen(!useStore.getState().sidebarOpen); }
      if (mod && e.key === "/") { e.preventDefault(); useStore.getState().setShortcutsOpen(!useStore.getState().shortcutsOpen); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-bg/70 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main
          className={`flex-1 min-w-0 flex flex-col transition-[margin] duration-300 ease-in-out ${
            sidebarOpen ? "md:ml-64" : "md:ml-14"
          }`}
        >
          <CoderView />
        </main>

        <SettingsModal />
        <PromptLibrary />
        <CommandPalette />
        <KeyboardShortcuts />
        <Onboarding />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

