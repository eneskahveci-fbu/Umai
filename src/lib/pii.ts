/* Hassas veri tespiti — gönderim öncesi kullanıcıyı uyarmak için. Yalnız gerçekten
   sızması zararlı, prompt'ta nadiren kasıtlı bulunan türler: API anahtarı, kredi
   kartı (Luhn), IBAN. E-posta/telefon gibi sık-meşru veriler bilinçli olarak
   dışarıda — gürültü yapmasın. Saf fonksiyon → birim testlerle doğrulanır. */

function luhn(num: string): boolean {
  let sum = 0; let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = num.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

const KEY_RE = /\b(sk-[A-Za-z0-9]{16,}|sk-ant-[A-Za-z0-9-]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{16,}|csk-[A-Za-z0-9]{16,})\b/;

/* Maskeleme için genel (global) sürüm — KEY_RE tek eşleşme içindir. */
const KEY_RE_G = new RegExp(KEY_RE.source, "g");

/** Metindeki API anahtarı/token'larını maskeler: önek + son 4 karakter kalır.
    Neden: model, kullanıcının yapıştırdığı token'ı yanıtında OLDUĞU GİBİ
    tekrar yazabiliyor (canlı örnek: güvenlik uyarısı verirken token'ın
    tamamını ekrana bastı). Uyarı verip aynı anda sırrı tekrar göstermek onu
    sohbet geçmişine, dışa aktarılan dosyalara ve buluta bir kez daha yayar.
    Yalnızca GÖSTERİM anında uygulanır; saklanan içerik değişmez. */
export function redactSecrets(text: string): string {
  if (!text) return text;
  return text.replace(KEY_RE_G, (match) => {
    /* İLK ayraca kadar olan kısım önektir ("glpat-", "ghp_", "sk-").
       Dikkat: en BÜYÜK indeks alınırsa token'ın ortasındaki ayraca kadar olan
       her şey önek sayılır ve sırrın yarısı ekranda kalır — birim test bunu
       yakaladı. Bu yüzden negatif olmayan indekslerin EN KÜÇÜĞÜ alınır. */
    const idx = [match.indexOf("-"), match.indexOf("_")].filter((i) => i >= 0);
    const sep = idx.length ? Math.min(...idx) : -1;
    const prefix = match.slice(0, sep >= 0 ? sep + 1 : 3);
    return `${prefix}${"*".repeat(8)}${match.slice(-4)}`;
  });
}

export function detectSensitive(text: string): string[] {
  if (!text) return [];
  const hits = new Set<string>();

  if (KEY_RE.test(text)) hits.add("API anahtarı");

  if (/\bTR\d{24}\b/.test(text.replace(/\s+/g, ""))) hits.add("IBAN");

  for (const m of text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
    const digits = m[0].replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) { hits.add("kredi kartı"); break; }
  }

  return [...hits];
}
