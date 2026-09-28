"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isStudioPathEnabled } from "@/lib/features";

/* Rafa kaldırılan Stüdyo yüzeylerine (bkz. lib/features.ts) doğrudan/eski
   bağlantıyla gelen kullanıcıyı sohbete yönlendirir; içeriği hiç çizmez. */
export function StudioGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/studio";
  const router = useRouter();
  const enabled = isStudioPathEnabled(pathname);
  useEffect(() => {
    if (!enabled) router.replace("/app");
  }, [enabled, router]);
  return enabled ? children : null;
}
