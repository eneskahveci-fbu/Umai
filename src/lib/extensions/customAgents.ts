// ---------------------------------------------------------------------------
// Custom Agents — Extension slash komutları & kullanıcı-tanımlı agent altyapısı.
// /compact başta olmak üzere Claude Code'tan esinlenen agent'lar burada tanımlanır.
// Kullanıcı tanımlı agent'lar localStorage'dan okunur ve merge edilir.
// ---------------------------------------------------------------------------

import type { Agent } from "@/lib/agents";

/* ── Sabit (built-in) extension agent'ları ──────────────────────────────── */
const BUILTIN_EXTENSION_AGENTS: Agent[] = [
  // ── /compact ──────────────────────────────────────────────────────────
  {
    id: "compact",
    command: "/compact",
    label: "Sohbeti Sıkıştır",
    icon: "🗜️",
    description:
      "Sohbet geçmişini LLM'e özetletir, bağlam penceresini boşaltır. " +
      "Claude Code'daki /compact gibi — uzun sohbetlerde hafızayı tazeler.",
    placeholder: "Sohbet geçmişi sıkıştırılıyor…",
    systemPrompt:
      "Sen bir sohbet özetleyicisin. Aşağıdaki konuşmayı; alınan kararları, " +
      "üzerinde çalışılan konuyu, yapılan değişiklikleri ve çözülmemiş sorunları " +
      "koruyarak, en fazla 200 kelimeyle özetle. SADECE özeti yaz, başka şey yazma.",
  },

  // ── /todos ────────────────────────────────────────────────────────────
  {
    id: "todos",
    command: "/todos",
    label: "Görev Listesi Çıkar",
    icon: "📋",
    description:
      "Sohbet geçmişinden tamamlanmamış görevleri, TODO'ları ve sonraki adımları çıkarır.",
    placeholder: "Görevler analiz ediliyor…",
    systemPrompt:
      "Sen bir proje yöneticisisin. Sohbet geçmişini tara; tamamlanmamış işleri, " +
      "TODO'ları, ertelenen kararları ve sonraki adımları madde madde listele. " +
      "Her maddeye öncelik (🔴/🟡/🟢) ver. SADECE listeyi yaz, başka şey yazma.",
  },

  // ── /security ─────────────────────────────────────────────────────────
  {
    id: "security",
    command: "/security",
    label: "Güvenlik Denetimi",
    icon: "🛡️",
    description:
      "Verilen kodu veya repodaki dosyayı güvenlik açıklarına karşı tarar.",
    placeholder: "Güvenlik denetimi için kod/dosya paylaş…",
    systemPrompt:
      "Sen bir uygulama güvenliği uzmanısın. Verilen kodu şu açılardan tara:\n\n" +
      "1) OWASP Top 10 (injection, XSS, auth sorunları, hassas veri sızıntısı)\n" +
      "2) Bağımlılık güvenliği (bilinen CVE'ler)\n" +
      "3) Gizli bilgi ifşası (hardcoded token, API key)\n" +
      "4) Yetkilendirme ve yetki yükseltme riskleri\n\n" +
      "Her bulguyu risk seviyesiyle (🔴🟡🟢) ve düzeltme önerisiyle listele. Türkçe yanıt ver.",
  },

  // ── /commit ───────────────────────────────────────────────────────────
  {
    id: "commit",
    command: "/commit",
    label: "Commit Mesajı",
    icon: "📝",
    description:
      "Bekleyen/son değişikliklerden Conventional Commits formatında commit mesajı üretir.",
    placeholder: "Değişiklikleri paylaş veya repo bağlıyken dal/commit söyle…",
    systemPrompt:
      "Sen bir sürüm kontrol uzmanısın. Değişikliklerden net bir commit mesajı üret. " +
      "Repo bağlıysa git_diff ile farkı incele (örn. main...HEAD). " +
      "Conventional Commits kullan: tip(scope): kısa özet (≤72 karakter), boş satır, " +
      "ardından NE ve NEDEN'i açıklayan madde madde gövde. " +
      "Tipler: feat, fix, refactor, perf, docs, test, chore, style, build, ci. " +
      "SADECE commit mesajını kod bloğu içinde ver, fazladan açıklama yapma.",
  },

  // ── /pr ───────────────────────────────────────────────────────────────
  {
    id: "pr",
    command: "/pr",
    label: "PR Açıklaması",
    icon: "🔀",
    description:
      "Bir dal/değişiklik kümesi için profesyonel PR/MR açıklaması yazar.",
    placeholder: "PR'ı tanımla veya repo bağlıyken kaynak/hedef dalı söyle…",
    systemPrompt:
      "Sen kıdemli bir geliştiricisin ve bir PR/MR açıklaması yazıyorsun. " +
      "Repo bağlıysa git_diff ve git_log ile değişiklikleri ve commit'leri incele. " +
      "Şu yapıda Markdown üret:\n\n" +
      "## Özet\nNe değişti ve neden (2-3 cümle).\n\n" +
      "## Değişiklikler\nMadde madde önemli değişiklikler.\n\n" +
      "## Test\nNasıl test edildi / edilmeli.\n\n" +
      "## Notlar\nGözden geçirenin dikkat etmesi gerekenler, riskler, takip işleri. " +
      "Kısa, net ve teknik ol. Türkçe yaz.",
  },

  // ── /optimize ─────────────────────────────────────────────────────────
  {
    id: "optimize",
    command: "/optimize",
    label: "Performans Optimize",
    icon: "🚀",
    description:
      "Kodu performans darboğazları için analiz eder, optimizasyon önerileri sunar.",
    placeholder: "Optimize edilecek kodu paylaş…",
    systemPrompt:
      "Sen bir performans mühendisisin. Verilen kodu şu açılardan analiz et:\n\n" +
      "1) Zaman karmaşıklığı (Big O) ve olası O(n²) tuzakları\n" +
      "2) Gereksiz bellek tahsisi (allocation)\n" +
      "3) N+1 sorgu gibi veritabanı darboğazları\n" +
      "4) Önbelleklenebilir (cacheable) işlemler\n" +
      "5) Bundle boyutu etkisi (ağaç sallama fırsatları)\n\n" +
      "Her öneride öncesi/sonrası kod ve tahmini kazanımı göster. Türkçe yanıt ver.",
  },
];

/* ── localStorage'dan kullanıcı tanımlı agent'ları okuma ────────────────── */
function loadUserAgents(): Agent[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("craft_user_agents");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a: unknown) =>
        a &&
        typeof a === "object" &&
        typeof (a as Agent).id === "string" &&
        typeof (a as Agent).command === "string" &&
        (a as Agent).command.startsWith("/"),
    );
  } catch {
    return [];
  }
}

/* ── Birleştirilmiş export ──────────────────────────────────────────────── */
export const CUSTOM_AGENTS: Agent[] = [
  ...BUILTIN_EXTENSION_AGENTS,
  ...loadUserAgents(),
];

/* ── Yardımcı: kullanıcı agent'ı kaydetme (bileşenlerden çağrılır) ──────── */
export function saveUserAgents(agents: Agent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("craft_user_agents", JSON.stringify(agents));
}

/* ── Yardımcı: kullanıcı agent'larını okuma (bileşenlerden çağrılır) ────── */
export function getUserAgents(): Agent[] {
  return loadUserAgents();
}
