"use client";

import { Blocks, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { EXTENSION_PACKS } from "@/lib/extensions/registry";

/* Eklentiler — modüler eklenti sistemi. Her "paket" ilgili araçları gruplar;
   tek anahtarla açılıp kapanır. Açma/kapama, paketin araçlarının izinlerini
   (config.toolPermissions) toplu ayarlar → mevcut altyapı yeniden kullanılır.
   Admin dışı kullanıcılar da yönetebilir (teknik araç tablosu onlardan gizliydi;
   bu sade paket görünümü herkese açık). */
export function ExtensionsSettings() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const perms = config.toolPermissions ?? {};
  const isOn = (provides: string[]) => provides.every((n) => perms[n] !== false);

  const toggle = (provides: string[], on: boolean) => {
    const next: Record<string, boolean> = { ...perms };
    for (const n of provides) {
      if (on) delete next[n]; // varsayılan: izinli
      else next[n] = false;
    }
    saveConfig({ ...config, toolPermissions: next });
  };

  return (
    <section className="space-y-4">
      <div>
        <h4 className="text-sm font-bold flex items-center gap-2"><Blocks size={16} className="text-brand" /> Eklentiler</h4>
        <p className="text-xs text-muted/70 mt-1 leading-relaxed">
          Modüler yetenek paketleri. Her paketi tek anahtarla açıp kapatabilirsin; açık paketlerin araçları ajana sunulur.
        </p>
      </div>

      <div className="space-y-2.5">
        {EXTENSION_PACKS.map((pack) => {
          const on = isOn(pack.provides);
          return (
            <div key={pack.id} className="premium-card rounded-xl p-3.5 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{pack.name}</span>
                  {pack.badge && <span className="text-[10px] font-bold text-brand bg-brand/12 border border-brand/20 px-1.5 py-0.5 rounded">{pack.badge}</span>}
                </div>
                <p className="text-[11px] text-muted/60 mt-0.5 leading-relaxed">{pack.description}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {pack.provides.map((n) => (
                    <span key={n} className="text-[10px] font-mono text-muted/45 bg-bgsoft border border-line/50 px-1.5 py-0.5 rounded">{n}</span>
                  ))}
                </div>
              </div>
              {/* Anahtar */}
              <button
                role="switch"
                aria-checked={on}
                onClick={() => { toggle(pack.provides, !on); addToast(on ? `${pack.name} kapatıldı` : `${pack.name} açıldı`, "info"); }}
                className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${on ? "bg-brand" : "bg-line"}`}
                title={on ? "Kapat" : "Aç"}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white grid place-items-center transition-all ${on ? "left-[22px]" : "left-0.5"}`}>
                  {on && <Check size={12} className="text-brand" />}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted/45 leading-relaxed">
        Not: Eklenti araçları yalnızca bir depo bağlıyken veya Yerel Mod sırasında, ajan çalışırken devreye girer.
      </p>
    </section>
  );
}
