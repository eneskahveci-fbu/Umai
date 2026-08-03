/* Köprü (Oracle/Hibrit Sunucu) üzerinde bağlı depoyu GERÇEKTEN bulunduran
   yardımcılar. Amaç: kullanıcı bir GitHub/GitLab deposunu token ile bağladığında
   VE bir köprü de aktifse, o depoyu köprünün diskine otomatik klonla/güncelle —
   böylece dosya işlemleri VE komut çalıştırma aynı, gerçek yerden yürür (tıpkı
   Claude Code'un yerel bir klasörde çalışması gibi). Önceden bridgeDir yalnızca
   bir AD'dı; fiziksel olarak o klasörde kod yoksa ajan "depo yok" görüyordu.

   Saf fonksiyonlar — ağa/köprüye dokunmaz, bu yüzden tam test edilebilir.
   Kabuk komutu üreten kısım (buildBridgeSyncCommand) güvenlik açısından
   hassastır: token URL içine gömülür ve `spawn(cmd, {shell:true})` ile
   çalıştırılır (bkz. scripts/terminal-bridge/bridge.mjs) — tek tırnaklama
   (shQuote) olmadan owner/repo/branch/dir içindeki bir kabuk karakteri
   komut enjeksiyonuna yol açardı. */

export type GitSourceProvider = "github" | "gitlab";

export interface GitSource {
  provider: GitSourceProvider;
  token?: string;
}

/** POSIX kabuğu için tek-tırnak kaçışı: `'` → `'\''`. */
export function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** owner/repo için kimlik doğrulamalı HTTPS klon URL'si üretir.
    Token yoksa (genel/public depo) düz URL döner. */
export function buildCloneUrl(source: GitSource, owner: string, repo: string): string {
  const host = source.provider === "gitlab" ? "gitlab.com" : "github.com";
  const path = `${owner}/${repo}.git`;
  if (!source.token) return `https://${host}/${path}`;
  /* GitHub: token doğrudan kullanıcı adı olarak kabul edilir.
     GitLab: PAT için belgelenen biçim `oauth2:<token>@…` (GitLab'ın kendi
     dokümantasyonundaki önerilen kullanım — OAuth token'lara özel değil). */
  const cred = source.provider === "gitlab"
    ? `oauth2:${encodeURIComponent(source.token)}`
    : encodeURIComponent(source.token);
  return `https://${cred}@${host}/${path}`;
}

/** Köprüde `dir` klasörünü bağlı deponun GÜNCEL haliyle eşitleyen kabuk
    komutu. Klasör yoksa klonlar; varsa mevcut kaydı sıfırlar (fetch + hard
    reset) — ajanın bir önceki turda bıraktığı yerel değişiklikler önemli
    değildir, tek doğruluk kaynağı bağlı depo. Token her seferinde yeniden
    yazılır (remote set-url) ki rotasyon/yenileme sorunsuz işlesin. */
export function buildBridgeSyncCommand(opts: {
  source: GitSource;
  owner: string;
  repo: string;
  branch: string;
  dir: string;
}): string {
  const url = buildCloneUrl(opts.source, opts.owner, opts.repo);
  const dir = shQuote(opts.dir);
  const branch = shQuote(opts.branch);
  const remoteRef = shQuote(`origin/${opts.branch}`);
  const qUrl = shQuote(url);
  /* Proje klasörü kullanıcı tarafından "takim/proje" gibi iç içe girilmişse
     `git clone` üst klasör (`takim`) yoksa "could not create leading
     directories" ile başarısız olurdu — önce onu oluştur (zararsız: zaten
     varsa no-op, 2>/dev/null gürültüsüz geçer). */
  return (
    `mkdir -p "$(dirname ${dir})" 2>/dev/null; ` +
    `test -d ${dir}/.git && ` +
    `(cd ${dir} && git remote set-url origin ${qUrl} && git fetch origin ${branch} && git checkout -q ${branch} && git reset --hard ${remoteRef}) ` +
    `|| git clone --branch ${branch} ${qUrl} ${dir}`
  );
}

/* Geliştirme sunucusu gibi KALICI çalışan (kendiliğinden bitmeyen) komutları
   ayırt eder. Kesin değil — sezgiseldir: bunlar için hemen arka plana alınıp
   sonucu beklenmeden bildirilir (çıktı üretmeye devam etseler de turu
   kilitlemesinler). Diğer komutlar önce ön planda denenir, süre dolarsa
   YİNE arka plana düşülür (bkz. execRunCommandViaBridge). */
const LONG_RUNNING_RE =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve|watch)\b|\bnodemon\b|--watch\b|\bnext\s+dev\b|\bvite\b(?!\s+build)/i;

export function isLikelyLongRunning(command: string): boolean {
  return LONG_RUNNING_RE.test(command);
}
