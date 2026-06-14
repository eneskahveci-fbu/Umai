/* SSRF koruması — sunucu tarafında kullanıcı-kontrollü URL getirilmeden önce
   kullanılır (web sayfası okuma, MCP sunucu çağrısı vb.).

   Amaç: Vercel/host sunucusunun iç ağa, loopback'e veya bulut metadata
   uç noktasına (169.254.169.254) yönlendirilmesini engellemek. DNS rebinding'i
   tam engellemez (bunun için çözümleme gerekir) ama yaygın saldırı yüzeyini
   (literal iç IP'ler, localhost, özel aralıklar) kapatır. */

/** IPv4 literalini özel/dahili aralıkta mı diye kontrol eder. */
function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return true; // geçersiz → reddet
  const [a, b] = o;
  if (a === 0 || a === 127) return true;              // 0.0.0.0/8, loopback
  if (a === 10) return true;                          // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16/12
  if (a === 192 && b === 168) return true;            // 192.168/16
  if (a === 169 && b === 254) return true;            // link-local + metadata
  if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT 100.64/10
  return false;
}

/** Kullanıcı URL'i sunucudan güvenle getirilebilir mi? */
export function isSafeRemoteUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  let host = u.hostname.toLowerCase();
  // IPv6 köşeli parantezleri temizle
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".local") || host.endsWith(".internal")) return false;
  // IPv6 loopback / ULA (fc00::/7) / link-local (fe80::/10)
  if (host === "::1" || host === "::") return false;
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return false;
  if (/^fe[89ab][0-9a-f]:/i.test(host)) return false;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1 / ::ffff:a00:1) — neredeyse hiçbir zaman
  // meşru bir dış adres değildir; tümünü reddet (WHATWG URL hex'e normalize eder).
  if (host.includes("::ffff:")) return false;
  if (isPrivateIPv4(host)) return false;
  return true;
}
