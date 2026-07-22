"use client";

/* Uygulama yüzeyi rotaları için paylaşılan kimlik durumu + tema uygulayıcı.
   Kullanıcı kimliği store'a yazılır (saveConfig'in Supabase senkronu
   çalışsın diye); Supabase yapılandırılmışsa oturum kontrol edilir. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "./supabase/client";
import { useStore } from "./store";

/** Yalnız kimlik DURUMUNU döner, asla yönlendirmez — "önce dene, sonra
    kaydol" (prompt.md Hamle 2) felsefesinin /app dışındaki yüzeylere de
    (Stüdyo/Ayarlar/Kütüphane) taşınmış hali: misafir kullanıcı bu sayfaları
    da açabilir, yalnız hesap gerektiren işler (bulut senkronu vb.) "out"
    durumunda sessizce atlanır. Yalnızca "checking" render'ı bekletir. */
export function useAuthState(): "checking" | "in" | "out" {
  const [state, setState] = useState<"checking" | "in" | "out">(
    supabaseConfigured ? "checking" : "in",
  );

  useEffect(() => {
    void useStore.getState().rehydrateSecrets();
    const sb = createClient();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      const u = data.user;
      useStore.getState().setUser(u?.id ?? null, u?.email ?? null);
      setState(u ? "in" : "out");
    });
  }, []);

  return state;
}

/** Girişi ZORUNLU kılan yüzeyler için: oturumsuz kullanıcıyı /login'e yönlendirir.
    Misafir-erişimli yüzeyler (Stüdyo/Ayarlar/Kütüphane) artık bunun yerine
    üstteki useAuthState()'i doğrudan kullanır — bkz. /app'teki aynı desen. */
export function useAuthGate(): "checking" | "in" | "out" {
  const router = useRouter();
  const state = useAuthState();

  useEffect(() => {
    if (state === "out") {
      /* Girişten sonra kullanıcıyı geldiği yüzeye geri götür ("akıllı ayrım":
         Yaratmaya başla → /studio, girişsizse login sonrası yine /studio'ya). */
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    }
  }, [state, router]);

  return state;
}

/** Tema/vurgu/font sınıflarını <html>'e uygular (aynı mantık /app'te de var). */
export function useThemeClasses() {
  useEffect(() => {
    const { theme, accentColor, fontScale } = useStore.getState().config;
    const cl = document.documentElement.classList;
    cl.toggle("light", theme === "light");
    cl.remove("accent-amber", "accent-pine", "accent-green", "accent-orange");
    cl.add(`accent-${accentColor ?? "pine"}`);
    cl.remove("font-sm", "font-base", "font-lg");
    cl.add(`font-${fontScale ?? "base"}`);
  }, []);
}
