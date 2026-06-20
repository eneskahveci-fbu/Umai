"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "craftai_install_dismissed";

/* PWA "Uygulamayı yükle" istemi. Tarayıcı beforeinstallprompt verince küçük bir
   banner gösterir. Zaten kuruluysa (standalone) veya kullanıcı reddettiyse görünmez.
   Tamamen opt-in; hiçbir mevcut davranışı etkilemez. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    /* Zaten kuruluysa gösterme. */
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) return;
    try { if (localStorage.getItem(DISMISS_KEY) === "1") return; } catch { /* yok say */ }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show || !evt) return null;

  const install = async () => {
    await evt.prompt();
    await evt.userChoice.catch(() => null);
    setShow(false);
  };
  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* yok say */ }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border border-line bg-surface shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-w-[92vw]">
      <Download size={16} className="text-brand shrink-0" />
      <span className="text-sm text-ink">Craft Coder&apos;ı uygulama olarak yükle</span>
      <button
        onClick={install}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand text-[#111110] hover:bg-branddim transition-colors shrink-0"
      >
        Yükle
      </button>
      <button onClick={dismiss} aria-label="Kapat" className="text-muted/60 hover:text-ink shrink-0">
        <X size={15} />
      </button>
    </div>
  );
}
