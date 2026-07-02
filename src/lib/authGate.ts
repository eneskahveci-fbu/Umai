"use client";

/* Uygulama yüzeyi rotaları (/studio*) için paylaşılan giriş kapısı + tema
   uygulayıcı. /app kendi (daha kapsamlı) akışını korur; bu kanca yeni
   rotaların aynı kurallarla korunmasını sağlar: Supabase yapılandırılmışsa
   oturumsuz kullanıcı /login'e gider; kullanıcı kimliği store'a yazılır
   (saveConfig'in Supabase senkronu çalışsın diye). */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "./supabase/client";
import { useStore } from "./store";

export function useAuthGate(): "checking" | "in" | "out" {
  const router = useRouter();
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

  useEffect(() => {
    if (state === "out") router.replace("/login");
  }, [state, router]);

  return state;
}

/** Tema/vurgu/font sınıflarını <html>'e uygular (aynı mantık /app'te de var). */
export function useThemeClasses() {
  useEffect(() => {
    const { theme, accentColor, fontScale } = useStore.getState().config;
    const cl = document.documentElement.classList;
    cl.toggle("light", theme === "light");
    cl.remove("accent-amber", "accent-green", "accent-orange");
    cl.add(`accent-${accentColor ?? "amber"}`);
    cl.remove("font-sm", "font-base", "font-lg");
    cl.add(`font-${fontScale ?? "base"}`);
  }, []);
}
