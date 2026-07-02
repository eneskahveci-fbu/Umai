"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { CoderView } from "@/components/CoderView";
import { CommandPalette } from "@/components/CommandPalette";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { ProjectModal } from "@/components/ProjectModal";
import { ActivityLog } from "@/components/ActivityLog";
import { DiffModal } from "@/components/DiffModal";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OnboardingTour } from "@/components/OnboardingTour";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useStore } from "@/lib/store";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { registerServiceWorker, watchConnection } from "@/lib/sw-register";

/* Ağır modaller/stüdyolar ana bundle'a girmez (kod bölme) ve İLK açılışa kadar
   mount edilmez → /app açılışı hafifler. Bir kez açıldıktan sonra mount kalır,
   içteki state (taslak tasarım, sohbet vs.) kapatınca kaybolmaz. */
const SettingsModal = dynamic(() => import("@/components/SettingsModal").then((m) => m.SettingsModal), { ssr: false });
const ImageStudio = dynamic(() => import("@/components/ImageStudio").then((m) => m.ImageStudio), { ssr: false });
const DesignStudio = dynamic(() => import("@/components/DesignStudio").then((m) => m.DesignStudio), { ssr: false });
const StudioView = dynamic(() => import("@/components/studio/StudioView").then((m) => m.StudioView), { ssr: false });
const SkillsPanel = dynamic(() => import("@/components/SkillsPanel").then((m) => m.SkillsPanel), { ssr: false });
const LibraryModal = dynamic(() => import("@/components/LibraryModal").then((m) => m.LibraryModal), { ssr: false });

/* "Hiç açıldı mı?" mandalı — render sırasında durum ayarlama (önceki-değer deseni). */
function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever || open;
}

export default function AppPage() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setUser = useStore((s) => s.setUser);
  const loadChats = useStore((s) => s.loadChats);
  const syncConfig = useStore((s) => s.syncConfig);
  const everSettings = useEverOpened(useStore((s) => s.settingsOpen));
  const everImage = useEverOpened(useStore((s) => s.imageStudioOpen));
  const everDesign = useEverOpened(useStore((s) => s.designStudioOpen));
  const everStudio = useEverOpened(useStore((s) => s.studioOpen));
  const everSkills = useEverOpened(useStore((s) => s.skillsOpen));
  const everLibrary = useEverOpened(useStore((s) => s.libraryOpen));
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

  /* Remix: /a/<id> sayfasından "Remix Et" ile gelince (?remix=<id>) yayınlanan
     artifact'ı getirip önizleme paneline yükle → kullanıcı ajandan uyarlamasını
     isteyebilir. URL temizlenir (yenilemede tekrar tetiklenmesin). */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const remixId = params.get("remix");
    if (!remixId) return;
    (async () => {
      try {
        const res = await fetch(`/api/publish?id=${encodeURIComponent(remixId)}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.content && ["html", "svg", "mermaid"].includes(data.type)) {
          useStore.getState().setArtifact({ type: data.type, content: data.content, title: data.title || "Remix" });
          useStore.getState().addToast("Artifact yüklendi — ajandan uyarlamasını isteyebilirsin.", "success");
        } else {
          useStore.getState().addToast("Remix edilecek artifact bulunamadı.", "error");
        }
      } catch { useStore.getState().addToast("Remix yüklenemedi.", "error"); }
      finally {
        router.replace("/app");
      }
    })();
  }, [router]);

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

  /* OAuth ile Git bağlama dönüşü: linkIdentity sonrası Supabase bizi
     /app?gitlink=github|gitlab adresine döndürür. Oturumdaki provider_token'ı
     alıp ilgili Git hesabını kullanıcıya özel olarak ekleriz. Token yalnızca
     dönüşten hemen sonra erişilebilir olduğundan burada yakalanır. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const which = params.get("gitlink");
    if (which !== "github" && which !== "gitlab") return;
    const clean = () => window.history.replaceState({}, "", "/app");
    (async () => {
      const sb = createClient();
      if (!sb) { clean(); return; }
      try {
        const { data } = await sb.auth.getSession();
        const token = data.session?.provider_token;
        const addToast = useStore.getState().addToast;
        if (!token) {
          addToast("Git bağlantısı tamamlanamadı: erişim anahtarı alınamadı. Tekrar dene.", "error");
          clean();
          return;
        }
        if (which === "github") {
          const r = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
          });
          if (!r.ok) throw new Error(`GitHub ${r.status}`);
          const u = await r.json();
          useStore.getState().addGithub({ username: u.login ?? "github", token });
          addToast(`GitHub bağlandı: ${u.login} ✓`, "success");
        } else {
          const r = await fetch("https://gitlab.com/api/v4/user", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) throw new Error(`GitLab ${r.status}`);
          const u = await r.json();
          useStore.getState().addGitlab({ username: u.username ?? "gitlab", token });
          addToast(`GitLab bağlandı: ${u.username} ✓`, "success");
        }
        useStore.getState().setSettingsOpen(true);
      } catch (err) {
        useStore.getState().addToast(
          `Git bağlanamadı: ${err instanceof Error ? err.message : "bilinmeyen hata"}`,
          "error",
        );
      } finally {
        clean();
      }
    })();
  }, []);

  /* Geri tuşu: açık bir panel/modal varsa siteden çıkmak yerine ÖNCE onu kapat.
     Panel açılınca geçmişe bir "sentinel" eklenir; geri basınca popstate ile en
     üstteki panel kapatılır. Hiç panel yoksa geri normal çalışır (siteden çıkar). */
  useEffect(() => {
    const anyOpen = () => {
      const s = useStore.getState();
      return s.settingsOpen || s.imageStudioOpen || s.designStudioOpen || s.studioOpen || s.skillsOpen || s.libraryOpen;
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
      else if (s.designStudioOpen) s.setDesignStudioOpen(false);
      else if (s.studioOpen) s.setStudioOpen(false);
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

        {everSettings && <SettingsModal />}
        {everImage && <ImageStudio />}
        {everDesign && <DesignStudio />}
        {everStudio && <StudioView />}
        {everLibrary && <LibraryModal />}
        <CommandPalette />
        <KeyboardShortcuts />
        {everSkills && <SkillsPanel />}
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

