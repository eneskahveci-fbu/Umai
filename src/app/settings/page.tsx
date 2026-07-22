"use client";

/* /settings — Ayarlar gerçek rotası: sekme URL'de (?tab=model|hesap|…),
   derin bağlantı + geri/ileri çalışır. /app içindeki hızlı modal da korunur. */
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsModal, SETTINGS_TAB_KEYS, type SettingsTab } from "@/components/SettingsModal";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuthState, useThemeClasses } from "@/lib/authGate";

function SettingsRoute() {
  /* Misafir erişimi (prompt.md Hamle 2): AYNI Ayarlar modalı /app içinde
     Ctrl+, ile misafir olarak sorunsuz açılıyordu — ama bu gerçek rotaya
     (Sidebar/mobil alt çubuğun "Ayarlar" düğmesi buraya gelir) useAuthGate
     ile girildiğinde oturumsuz kullanıcı /login'e atılıyordu. Aynı özelliğin
     iki giriş noktası arasında tutarsız erişilebilirliği vardı. */
  const auth = useAuthState();
  useThemeClasses();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab") as SettingsTab | null;
  const tab: SettingsTab = raw && SETTINGS_TAB_KEYS.includes(raw) ? raw : "hesap";

  if (auth === "checking") {
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
