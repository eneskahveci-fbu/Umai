"use client";

import { useRef } from "react";
import { Blocks, X } from "lucide-react";
import { useModalA11y } from "@/lib/useModalA11y";
import { useStore } from "@/lib/store";
import { McpGallery } from "@/components/McpGallery";

/* Eklenti Mağazası — Sidebar → Eklentiler butonunun açtığı hafif modal.
   Tam Ayarlar penceresini AÇMAZ (kullanıcı kararı: "ayarlardaki mcp ye bağlı
   olsun ama açmasın") — yalnız McpGallery'yi (config.mcpServers üzerinde
   çalışan TEK gerçek kaynak) burada da render eder. Ayarlar → Eklentiler
   sekmesi (ExtensionsSettings.tsx) AYNI bileşeni kullanır; iki yüzey aynı
   veriyi okur/yazar, aralarında senkron sorunu olmaz. */
export function ExtensionStoreModal() {
  const open = useStore((s) => s.extensionStoreOpen);
  const setOpen = useStore((s) => s.setExtensionStoreOpen);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, open, () => setOpen(false));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm grid place-items-center px-3 sm:px-4 animate-modal-bg"
      onClick={() => setOpen(false)}
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Eklenti Mağazası"
        className="w-full max-w-2xl h-[82dvh] max-h-[calc(100dvh-1.5rem)] overflow-hidden bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center">
              <Blocks size={14} className="text-brand" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Eklenti Mağazası</h2>
              <p className="text-[11px] text-muted/50 leading-tight">Ayarlar → Eklentiler ile aynı bağlantıları paylaşır</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
            aria-label="Kapat"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
          <McpGallery />
        </div>
      </div>
    </div>
  );
}
