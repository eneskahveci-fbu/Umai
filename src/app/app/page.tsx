"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { CoderView } from "@/components/CoderView";
import { SettingsModal } from "@/components/SettingsModal";
import { ImageStudio } from "@/components/ImageStudio";
import { DesignStudio } from "@/components/DesignStudio";
import { LibraryModal } from "@/components/LibraryModal";
import { CommandPalette } from "@/components/CommandPalette";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { SkillsPanel } from "@/components/SkillsPanel";
import { ProjectModal } from "@/components/ProjectModal";
import { ActivityLog } from "@/components/ActivityLog";
import { DiffModal } from "@/components/DiffModal";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OnboardingTour } from "@/components/OnboardingTour";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useStore } from "@/lib/store";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { registerServiceWorker, watchConnection } from "@/lib/sw-register";

export default function AppPage() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setUser = useStore((s) => s.setUser);
  const loadChats = useStore((s) => s.loadChats);
  const syncConfig = useStore((s) => s.syncConfig);
  const router = useRouter();
  /* Giriş zorunlu: Supabase yapılandırılmışsa oturumsuz kullanıcı uygulamayı
     açamaz, login/kayıt ekranına gider. Supabase yoksa (yerel mod) serbest. */
  const [authState, setAuthState] = useState<"checking" | "in" | "out">(
    supabaseConfigured ? "checking" : "in",
  );

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(false);
    registerServiceWorker();
    /* Depodaki şifreli API anahtarlarını çöz + eski düz metni migrate et
       (mümkün olan en erken; kullanıcı bir istek başlatmadan önce tamamlanır). */
    void useStore.getState().rehydrateSecrets();
    return watchConnection();
  }, [setSidebarOpen]);

  /* Sistem teması: autoTheme açıksa OS'i izle ve değiştikçe uygula. */
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const cfg = useStore.getState().config;
      if (!cfg.autoTheme) return;
      const want = mql.matches ? "dark" : "light";
      if (cfg.theme !== want) useStore.getState().saveConfig({ ...cfg, theme: want });
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const sb = createClient();
    if (!sb) { loadChats(null); return; }
    sb.auth.getUser().then(({ data }) => {
      const u = data.user;
      setUser(u?.id ?? null, u?.email ?? null);
      loadChats(u?.id ?? null);
      void useStore.getState().loadPlan(u?.id ?? null);
      if (u?.id) void syncConfig(u.id);
      setAuthState(u ? "in" : "out");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u?.id ?? null, u?.email ?? null);
      loadChats(u?.id ?? null);
      void useStore.getState().loadPlan(u?.id ?? null);
      if (u?.id) void syncConfig(u.id);
      setAuthState(u ? "in" : "out");
    });
    return () => sub.subscription.unsubscribe();
  }, [setUser, loadChats, syncConfig]);

  /* Geri tuşu: açık bir panel/modal varsa siteden çıkmak yerine ÖNCE onu kapat.
     Panel açılınca geçmişe bir "sentinel" eklenir; geri basınca popstate ile en
     üstteki panel kapatılır. Hiç panel yoksa geri normal çalışır (siteden çıkar). */
  useEffect(() => {
    const anyOpen = () => {
      const s = useStore.getState();
      return s.settingsOpen || s.imageStudioOpen || s.skillsOpen || s.libraryOpen;
    };
    let armed = false;
    const unsub = useStore.subscribe(() => {
      if (anyOpen()) { if (!armed) { armed = true; history.pushState({ craftOverlay: true }, ""); } }
      else armed = false;
    });
    const onPop = () => {
      armed = false;
      const s = useStore.getState();
      if (s.settingsOpen) s.setSettingsOpen(false);
      else if (s.imageStudioOpen) s.setImageStudioOpen(false);
      else if (s.skillsOpen) s.setSkillsOpen(false);
      else if (s.libraryOpen) s.setLibraryOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => { unsub(); window.removeEventListener("popstate", onPop); };
  }, []);

  useEffect(() => {
    const { theme, accentColor, fontScale } = useStore.getState().config;
    const cl = document.documentElement.classList;
    cl.toggle("light", theme === "light");
    cl.remove("accent-amber", "accent-green", "accent-orange");
    cl.add(`accent-${accentColor ?? "amber"}`);
    cl.remove("font-sm", "font-base", "font-lg");
    cl.add(`font-${fontScale ?? "base"}`);
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

  /* Oturumsuz → login ekranına yönlendir (giriş zorunlu). */
  useEffect(() => {
    if (authState === "out") router.replace("/login");
  }, [authState, router]);

  if (authState === "checking") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>;
  }
  if (authState === "out") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Giriş ekranına yönlendiriliyor…</div>;
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-bg">
        {/* Erişilebilirlik: klavyeyle ilk Tab'da görünen "içeriğe atla" bağlantısı. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand focus:text-[#111110] focus:font-semibold focus:text-sm focus:shadow-lg"
        >
          İçeriğe atla
        </a>
        <Sidebar />

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-bg/70 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className={`flex-1 min-w-0 flex flex-col transition-[margin] duration-300 ease-in-out ${
            sidebarOpen ? "md:ml-64" : "md:ml-14"
          }`}
        >
          <CoderView />
        </main>

        <SettingsModal />
        <ImageStudio />
        <DesignStudio />
        <LibraryModal />
        <CommandPalette />
        <KeyboardShortcuts />
        <SkillsPanel />
        <ProjectModal />
        <ActivityLog />
        <DiffModal />
        <ToastContainer />
        <OfflineBanner />
        <OnboardingTour />
        <InstallPrompt />
      </div>
    </ErrorBoundary>
  );
}

