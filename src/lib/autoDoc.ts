/* Otomatik dokümantasyon yardımcıları: CHANGELOG + README prompt üreticileri.
   Saf fonksiyonlar — IO yok, test edilebilir.

   `changelog.ts`'teki CHANGELOG_ENTRIES ile KARIŞTIRILMASIN: o, /changelog
   pazarlama sayfası için elle kürasyonlu, sabit bir dizidir. Bu modül ise
   kullanıcının BAĞLI DEPOSUNDAKİ gerçek commit'lerden konvansiyonel bir
   CHANGELOG bloğu taslağı üretir (DebtPanel'in "Oto-Dok" eylemi). */

export interface CommitInfo {
  hash: string;
  message: string;
  author?: string;
  date?: string;
}

const TYPE_PREFIXES: Record<string, string> = {
  feat: "Yeni Özellikler",
  fix: "Hata Düzeltmeleri",
  perf: "Performans",
  refactor: "Yeniden Düzenleme",
  docs: "Dokümantasyon",
  style: "Stil",
  test: "Testler",
  chore: "Bakım",
  ci: "CI/CD",
  build: "Derleme",
};

/** Commit listesini konvansiyonel CHANGELOG bloğuna dönüştürür. */
export function buildChangelogEntry(commits: CommitInfo[], version = "Sonraki Sürüm", date?: string): string {
  const grouped: Record<string, string[]> = {};
  const uncategorized: string[] = [];

  for (const c of commits) {
    const m = c.message.match(/^(\w+)(?:\(([^)]+)\))?[!:]?\s*:?\s*(.+)/);
    if (m) {
      const type = m[1].toLowerCase();
      const scope = m[2] ? `**${m[2]}**: ` : "";
      const desc = m[3].trim();
      const label = TYPE_PREFIXES[type] ?? "Diğer";
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(`- ${scope}${desc} (\`${c.hash.slice(0, 7)}\`)`);
    } else {
      uncategorized.push(`- ${c.message.trim()} (\`${c.hash.slice(0, 7)}\`)`);
    }
  }

  const today = date ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [`## [${version}] — ${today}`, ""];

  for (const [label, items] of Object.entries(grouped)) {
    lines.push(`### ${label}`, ...items, "");
  }
  if (uncategorized.length) {
    lines.push("### Diğer Değişiklikler", ...uncategorized, "");
  }
  return lines.join("\n");
}

/** README güncelleme için AI prompt'u üretir. */
export function buildReadmePrompt(
  repoName: string,
  existingReadme: string,
  recentChanges: string,
): string {
  return (
    `Sen teknik dokümantasyon uzmanısın. Aşağıdaki bilgileri kullanarak mevcut README.md dosyasını güncelle.\n\n` +
    `**Repo:** ${repoName}\n\n` +
    `**Son Değişiklikler:**\n${recentChanges}\n\n` +
    `**Mevcut README:**\n\`\`\`markdown\n${existingReadme.slice(0, 4000)}${existingReadme.length > 4000 ? "\n…(kırpıldı)" : ""}\n\`\`\`\n\n` +
    `Güncellenmiş README.md dosyasını tam olarak döndür (markdown formatında, ` +
    `gereksiz açıklama veya yorum olmadan). Son değişiklikleri "Son Değişiklikler" veya ` +
    `uygun bir bölüme entegre et; genel yapıyı ve mevcut içeriği koru.`
  );
}
