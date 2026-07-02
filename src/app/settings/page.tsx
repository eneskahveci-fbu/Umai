"use client";

/* /settings — Ayarlar gerçek rotası: sekme URL'de (?tab=model|hesap|…),
   derin bağlantı + geri/ileri çalışır. /app içindeki hızlı modal da korunur. */
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsModal, SETTINGS_TAB_KEYS, type SettingsTab } from "@/components/SettingsModal";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuthGate, useThemeClasses } from "@/lib/authGate";

function SettingsRoute() {
  const auth = useAuthGate();
  useThemeClasses();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab") as SettingsTab | null;
  const tab: SettingsTab = raw && SETTINGS_TAB_KEYS.includes(raw) ? raw : "hesap";

  if (auth !== "in") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>;
  }
  return (
    <ErrorBoundary>
      <SettingsModal
        routeMode
        initialTab={tab}
        onTabChange={(t) => router.replace(`/settings?tab=${t}`, { scroll: false })}
      />
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>}>
      <SettingsRoute />
    </Suspense>
  );
}
