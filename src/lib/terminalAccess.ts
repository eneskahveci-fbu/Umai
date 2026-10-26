/* Terminal bağlantı politikası — SAF yardımcılar (DOM'suz, test edilebilir).

   Ürün kararı (Ekim 2026): terminal IDE mantığında KİŞİNİN KENDİ bilgisayarında
   çalışır. Uzak (Oracle/VPS) terminal sunucusu yalnızca admin'e açıktır; admin
   dışı bir kullanıcı ayarlarda uzak adres girse bile bu adres YOK SAYILIR ve
   localhost'a düşülür. Böylece paylaşılan/ortak bir sunucu kazara herkese açık
   bir kabuk haline gelmez.

   `terminalWsUrl` boşsa da varsayılan localhost'tur — eski davranıştaki
   "boşsa WebContainer" yerine kullanıcı kendi makinesine bağlanmayı dener;
   WebContainer yalnız hata ekranındaki açık "Tarayıcıda dene" seçeneğiyle
   devreye girer. */

/** Kullanıcının kendi bilgisayarındaki terminal sunucusunun varsayılan adresi. */
export const LOCAL_TERMINAL_WS = "ws://127.0.0.1:7071";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/** Adres yerel makineyi mi gösteriyor? (localhost / 127.0.0.1 / [::1] / *.localhost)
 *  http(s) de kabul edilir: terminal katmanı bunları ws(s)'e çevirir. */
export function isLoopbackWsUrl(raw?: string | null): boolean {
  const value = (raw ?? "").trim();
  if (!value) return false;
  try {
    const u = new URL(value);
    if (!["ws:", "wss:", "http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/** Etkin terminal adresi: admin uzak sunucu kullanabilir, herkes localhost'a düşer. */
export function resolveTerminalWsUrl(configured: string | null | undefined, isAdmin: boolean): string {
  const value = (configured ?? "").trim();
  if (isAdmin) return value || LOCAL_TERMINAL_WS;
  return isLoopbackWsUrl(value) ? value : LOCAL_TERMINAL_WS;
}

/** Araç çubuğunda gösterilecek kısa etiket. */
export function terminalHostLabel(wsUrl: string): string {
  try {
    return new URL(wsUrl.trim()).host || LOCAL_TERMINAL_WS;
  } catch {
    return LOCAL_TERMINAL_WS;
  }
}
