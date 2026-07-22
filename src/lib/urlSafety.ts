/* SSRF koruması — sunucu tarafında kullanıcı-kontrollü URL getirilmeden önce
   kullanılır (web sayfası okuma, MCP sunucu çağrısı vb.).

   Amaç: Vercel/host sunucusunun iç ağa, loopback'e veya bulut metadata
   uç noktasına (169.254.169.254) yönlendirilmesini engellemek. DNS rebinding'i
   tam engellemez (bunun için çözümleme gerekir) ama yaygın saldırı yüzeyini
   (literal iç IP'ler, localhost, özel aralıklar) kapatır. */

/** Dört sekizli (0-255) → özel/dahili aralık kontrolü (kanonik biçim). */
function octetsArePrivate(o: number[]): boolean {
  const [a, b] = o;
  if (a === 0 || a === 127) return true;              // 0.0.0.0/8, loopback
  if (a === 10) return true;                          // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16/12
  if (a === 192 && b === 168) return true;            // 192.168/16
  if (a === 169 && b === 254) return true;            // link-local + metadata
  if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT 100.64/10
  return false;
}

/** IPv4'ün TÜM meşru gösterimlerini kanonik dört-sekizliye çözer; IPv4 değilse null.
 *  WHATWG URL host ayrıştırıcısı bu biçimleri OLDUĞU GİBİ bırakır ama Node/OS
 *  DNS çözümleyicisi (getaddrinfo/inet_aton) hepsini aynı adrese çözer:
 *    2130706433 (decimal), 0x7f000001 (hex), 0177.0.0.1 (octal), 127.1 (kısa).
 *  Yalnız dotted-decimal'i kontrol etmek bu kodlamalarla loopback/metadata'ya
 *  SSRF bypass'ına açık kapı bırakıyordu — hepsini normalize edip kontrol et. */
function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length === 0 || parts.length > 4) return null;
  /* Her parça decimal/hex(0x)/octal(0…) olabilir (inet_aton semantiği). */
  const nums: number[] = [];
  for (const p of parts) {
    if (p === "") return null;
    let n: number;
    if (/^0[xX][0-9a-fA-F]+$/.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10);
    else return null; // sayısal olmayan parça → IPv4 değil (alan adı)
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }
  /* inet_aton: son parça kalan tüm baytları doldurur (a, a.b, a.b.c, a.b.c.d). */
  const octets = new Array<number>(4).fill(0);
  const n = nums.length;
  for (let i = 0; i < n - 1; i++) {
    if (nums[i]! > 255) return null;
    octets[i] = nums[i]!;
  }
  const last = nums[n - 1]!;
  const maxLast = Math.pow(256, 4 - (n - 1)) - 1;
  if (last > maxLast) return null;
  /* Son değeri kalan sekizlilere böl (big-endian). */
  for (let i = 3; i >= n - 1; i--) {
    octets[i] = Math.floor(last / Math.pow(256, 3 - i)) % 256;
  }
  return octets;
}

/** IPv4 literalini (her kodlamada) özel/dahili aralıkta mı diye kontrol eder. */
function isPrivateIPv4(host: string): boolean {
  const octets = parseIPv4(host);
  if (!octets) return false; // IPv4 değil (alan adı) → burada karar verme
  return octetsArePrivate(octets);
}

/** Kullanıcı URL'ini yönlendirmeleri TEK TEK doğrulayarak getirir.
    `fetch` varsayılanı yönlendirmeleri körlemesine izler — public bir adres
    302 ile iç ağa/metadata'ya (169.254.169.254) sıçrayabilir. Burada her hop
    isSafeRemoteUrl'den geçer; güvensiz hop'ta veya hop limitinde hata atılır. */
export async function safeFetch(
  rawUrl: string,
  init?: RequestInit,
  opts?: { maxHops?: number; fetchImpl?: typeof fetch },
): Promise<Response> {
  const doFetch = opts?.fetchImpl ?? fetch;
  const maxHops = opts?.maxHops ?? 4;
  let url = rawUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    if (!isSafeRemoteUrl(url)) throw new Error("Güvensiz adres (iç ağ/loopback yönlendirmesi engellendi).");
    const res = await doFetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      url = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("Çok fazla yönlendirme.");
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
