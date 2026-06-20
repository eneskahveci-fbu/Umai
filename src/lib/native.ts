/* Capacitor native köprü yardımcıları. Web'de hepsi sessiz no-op'tur
   (isNative() false). Native (iOS/Android) kabukta gerçek native davranış:
   durum çubuğu teması, donanım geri tuşu, dokunsal geri bildirim, native paylaşım.
   Bu yetenekler uygulamayı "salt web görünümü" olmaktan çıkarır (App Store 4.2). */
import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export async function initNative(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: "#111110" }).catch(() => {});
  } catch { /* yok say */ }
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch { /* yok say */ }
}

/** Dokunsal geri bildirim (buton/aksiyon onayı). Web'de no-op. */
export async function haptic(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* yok say */ }
}

/** Native paylaşım sayfası; native değilse Web Share API'ye düşer. */
export async function nativeShare(title: string, text: string, url?: string): Promise<void> {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url });
      return;
    } catch { /* aşağı düş */ }
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ title, text, url }).catch(() => { /* iptal */ });
  }
}
