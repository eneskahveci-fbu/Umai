"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { CoderView } from "@/components/CoderView";
import { MobileTabBar, useKeyboardOpen } from "@/components/MobileTabBar";
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
import { BackgroundJobs } from "@/components/BackgroundJobs";
import { useStore } from "@/lib/store";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { registerServiceWorker, watchConnection } from "@/lib/sw-register";
import { captureReferralCode, recordReferralIfPending } from "@/lib/referral";

/* Ağır modaller/stüdyolar ana bundle'a girmez (kod bölme) ve İLK açılışa kadar
   mount edilmez → /app açılışı hafifler. Bir kez açıldıktan sonra mount kalır,
   içteki state (taslak tasarım, sohbet vs.) kapatınca kaybolmaz. */
const SettingsModal = dynamic(() => import("@/components/SettingsModal").then((m) => m.SettingsModal), { ssr: false });
const SkillsPanel = dynamic(() => import("@/components/SkillsPanel").then((m) => m.SkillsPanel), { ssr: false });
const LibraryModal = dynamic(() => import("@/components/LibraryModal").then((m) => m.LibraryModal), { ssr: false });
const ExtensionStoreModal = dynamic(() => import("@/components/ExtensionStoreModal").then((m) => m.ExtensionStoreModal), { ssr: false });

/* "Hiç açıldı mı?" mandalı — render sırasında durum ayarlama (önceki-değer deseni). */
function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever || open;
}

export default function AppPage() {
  /* S7 — animasyon yoğunluğu. Tema/yazı boyutu tek seferlik bir effect'te
     uygulanıyor (değişince yeniden yükleme gerekiyor); animasyon ayarının
     etkisi ANINDA görülmeli, bu yüzden reaktif olarak seçilir. */
  const animations = useStore((s) => s.config.animations);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setUser = useStore((s) => s.setUser);
  const loadChats = useStore((s) => s.loadChats);
  const syncConfig = useStore((s) => s.syncConfig);
  const everSettings = useEverOpened(useStore((s) => s.settingsOpen));
  const everSkills = useEverOpened(useStore((s) => s.skillsOpen));
  const everLibrary = useEverOpened(useStore((s) => s.libraryOpen));
  const everExtensionStore = useEverOpened(useStore((s) => s.extensionStoreOpen));
  const kbOpen = useKeyboardOpen();
  const router = useRouter();
  /* Önce dene, sonra kaydol (prompt.md Hamle 2): Supabase yapılandırılmış
     olsa bile oturumsuz kullanıcı /app'i misafir olarak açabilir — sohbet
     eder, kod yazar (anahtarsız ücretsiz sağlayıcı zinciriyle). Kalıcı bulut
     senkronu/Git bağlama gibi hesap gerektiren işler zaten kullanıcı id'sine
     bakıyor (aşağıdaki efektler) ve misafirde sessizce atlanıyor; giriş daveti
     AuthButton üzerinden istendiğinde yapılır, zorla değil. */
  const [authState, setAuthState] = useState<"checking" | "in" | "out">(
    supabaseConfigured ? "checking" : "in",
  );

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(false);
    registerServiceWorker();
    /* Depodaki şifreli API anahtarlarını çöz + eski düz metni migrate et
       (mümkün olan en erken; kullanıcı bir istek başlatmadan önce tamamlanır). */
    void useStore.getState().rehydrateSecrets();
    /* Referral linki doğrudan /app?ref=...'e düşerse de yakala (bkz. lib/referral.ts). */
    captureReferralCode();
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
      if (u?.id) { void syncConfig(u.id); recordReferralIfPending(u.id); }
      setAuthState(u ? "in" : "out");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u?.id ?? null, u?.email ?? null);
      loadChats(u?.id ?? null);
      void useStore.getState().loadPlan(u?.id ?? null);
      if (u?.id) { void syncConfig(u.id); recordReferralIfPending(u.id); }
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
      return s.settingsOpen || s.skillsOpen || s.libraryOpen;
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
    document.documentElement.setAttribute("data-anim", animations ?? "full");
  }, [animations]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      /* Ctrl/Cmd+Shift+N = gizli sohbet — CommandPalette ve Ayarlar'ın kısayol
         listesinde zaten reklamı yapılıyordu ama hiçbir yerde dinlenmiyordu. */
      if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); useStore.getState().newChat(e.shiftKey); }
      if (mod && e.key === ",") { e.preventDefault(); useStore.getState().setSettingsOpen(true); }
      /* Ctrl/Cmd+K: CommandPalette.tsx kendi global dinleyicisinde ele alır
         (Ctrl/Cmd+P ile birlikte, tek kaynak) — burada da tutmak iki dinleyicinin
         aynı tuşta yarışıp paleti aynı anda açıp kapatmasına yol açıyordu. */
      if (mod && e.key === "b") { e.preventDefault(); useStore.getState().setSidebarOpen(!useStore.getState().sidebarOpen); }
      if (mod && e.key === "/") { e.preventDefault(); useStore.getState().setShortcutsOpen(!useStore.getState().shortcutsOpen); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (authState === "checking") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>;
  }

  return (
    <ErrorBoundary>
      {/* Mobil alt gezinme: klavye açıkken bar gizlenir + alt boşluk sıfırlanır. */}
      <div
        className="flex h-screen overflow-hidden bg-bg"
        style={{ "--surface-pb": kbOpen ? "0px" : "calc(52px + env(safe-area-inset-bottom))" } as React.CSSProperties}
      >
        {/* Erişilebilirlik: klavyeyle ilk Tab'da görünen "içeriğe atla" bağlantısı. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand focus:text-[#111110] focus:font-semibold focus:text-sm focus:shadow-lg"
        >
          İçeriğe atla
        </a>
        <Sidebar />

        <main
          id="main-content"
          tabIndex={-1}
          className={`flex-1 min-w-0 flex flex-col transition-[margin] duration-300 ease-in-out pb-[var(--surface-pb,0px)] sm:pb-0 ${
            sidebarOpen ? "md:ml-64" : "md:ml-14"
          }`}
        >
          <CoderView />
        </main>
        <MobileTabBar />

        {everSettings && <SettingsModal />}
        {everLibrary && <LibraryModal />}
        <CommandPalette />
        <KeyboardShortcuts />
        {everSkills && <SkillsPanel />}
        {everExtensionStore && <ExtensionStoreModal />}
        <ProjectModal />
        <ActivityLog />
        <DiffModal />
        <ToastContainer />
        <OfflineBanner />
        <OnboardingTour />
        <InstallPrompt />
        <BackgroundJobs />
      </div>
    </ErrorBoundary>
  );
}

