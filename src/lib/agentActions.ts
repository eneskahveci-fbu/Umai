/* Ajan eylemleri için güvenlik çekirdeği (saf, test edilebilir).
   - Yıkıcı işlemler (silme/yeniden adlandırma) HER ZAMAN kullanıcı onayı ister.
   - Otomatik komut çalıştırma yalnızca allowlist'teki komutlarla.
   Bu modül UI/ağ içermez; yan etkisiz → kolayca unit-test edilir. */

export type PendingAction =
  | { id: string; kind: "delete"; path: string; reason?: string }
  | { id: string; kind: "rename"; path: string; newPath: string; reason?: string };

/** Onay olmadan ASLA doğrudan çalıştırılmayan araçlar. */
export const DESTRUCTIVE_TOOLS = new Set(["delete_file", "rename_file"]);

export function isDestructiveTool(name: string): boolean {
  return DESTRUCTIVE_TOOLS.has(name);
}

function actionKey(a: PendingAction): string {
  return `${a.kind}:${a.path}:${a.kind === "rename" ? a.newPath : ""}`;
}

/** Bekleyen eylemi ekler; aynı (tür+yol) zaten varsa yok sayar (idempotent). */
export function addPendingAction(list: PendingAction[], action: PendingAction): PendingAction[] {
  return list.some((a) => actionKey(a) === actionKey(action)) ? list : [...list, action];
}

/** Bir bekleyen eylemi id ile çıkarır. */
export function removePendingAction(list: PendingAction[], id: string): PendingAction[] {
  return list.filter((a) => a.id !== id);
}

/** Otomatik çalıştırma için varsayılan güvenli komut allowlist'i (önek eşleşmesi). */
export const DEFAULT_COMMAND_ALLOWLIST = [
  "npm test",
  "npm run lint",
  "npm run build",
  "npm run typecheck",
  "pnpm test",
  "pnpm lint",
  "yarn test",
  "npx tsc",
  "npx eslint",
  "npx prettier",
];

/** Komut allowlist'te mi? Birebir veya "önek + boşluk" eşleşmesi.
    Zincirleme/yönlendirme (`;`, `&&`, `|`, `>`, `` ` ``) içeren komutlar reddedilir. */
export function isCommandAllowed(command: string, allowlist: string[]): boolean {
  const cmd = command.trim();
  if (!cmd) return false;
  if (/[;&|`$><\n]/.test(cmd)) return false; // kabuk metakarakterleri → güvensiz
  return allowlist.some((p) => {
    const prefix = p.trim();
    return prefix.length > 0 && (cmd === prefix || cmd.startsWith(prefix + " "));
  });
}

/** Katastrofik komut kalıpları (run_command "kalkanı"). Eşleşen kalıbın etiketi
    döner; yoksa null. Yalnızca açıkça yıkıcı, geri-dönüşü zor komutları yakalar —
    normal geliştirme komutlarını (rm -rf node_modules, ./build vb.) ENGELLEMEZ,
    yanlış-pozitif düşük tutulur. Allowlist'in (oto-çalıştır) tersi: bu, izinli
    olsa bile çalıştırmadan önce son bir güvenlik ağıdır. */
export const DEFAULT_DANGEROUS_COMMANDS: { label: string; re: RegExp }[] = [
  { label: "rm -rf (kök/ev/joker)", re: /\brm\s+-[a-z]*(rf|fr)[a-z]*\s+(--no-preserve-root\s+)?(\/(\s|$)|\/\*|~(\/|\s|$)|\*(\s|$)|\.\s*$)/i },
  { label: "Fork bomb", re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/ },
  { label: "Disk biçimlendir / ham yazma", re: /\b(mkfs(\.\w+)?\s+|dd\b[^\n]*\bof=\/dev\/|>\s*\/dev\/(sd|nvme|hd|disk)\w*)/i },
  { label: "Kök dizinde chmod/chown -R", re: /\b(chmod|chown)\s+-[a-z]*R[a-z]*\s+[^\n]*\s\/(\s|$)/i },
  { label: "Kabuğa indirip çalıştırma (curl/wget | sh)", re: /\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(ba|z|c|k)?sh\b/i },
  { label: "Sistemi kapat / yeniden başlat", re: /\b(shutdown|reboot|poweroff|halt|init\s+[06])\b/i },
];

/** Komut katastrofik bir kalıpla eşleşiyor mu? Eşleşen kalıbın etiketini, yoksa
    null döner. `extra` ile kullanıcı/çağıran ek kalıp geçirebilir. */
export function matchDangerousCommand(
  command: string,
  extra: { label: string; re: RegExp }[] = [],
): string | null {
  const cmd = command.trim();
  if (!cmd) return null;
  for (const p of [...DEFAULT_DANGEROUS_COMMANDS, ...extra]) {
    if (p.re.test(cmd)) return p.label;
  }
  return null;
}

/** Yeniden adlandırma yolunu doğrular (boş/aynı/geçersiz değil). */
export function validateRename(oldPath: string, newPath: string): { ok: true } | { ok: false; error: string } {
  if (!oldPath?.trim() || !newPath?.trim()) return { ok: false, error: "Eski ve yeni yol zorunlu" };
  if (oldPath === newPath) return { ok: false, error: "Yeni yol eskisiyle aynı" };
  if (newPath.includes("..")) return { ok: false, error: "Geçersiz yol (..)" };
  return { ok: true };
}
