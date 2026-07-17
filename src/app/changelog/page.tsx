import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CHANGELOG_ENTRIES, type ChangelogTag } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Değişiklikler — UMAI",
  description: "UMAI'ye eklenen yeni özellikler, iyileştirmeler ve düzeltmelerin kronolojik günlüğü.",
};

const TAG_LABEL: Record<ChangelogTag, string> = {
  yeni: "Yeni",
  iyilestirme: "İyileştirme",
  duzeltme: "Düzeltme",
  degisiklik: "Değişiklik",
};

const TAG_CLASS: Record<ChangelogTag, string> = {
  yeni: "bg-brand/12 border-brand/25 text-brand",
  iyilestirme: "bg-blue/12 border-blue/25 text-blue",
  duzeltme: "bg-yellow/12 border-yellow/25 text-yellow",
  degisiklik: "bg-purple/12 border-purple/25 text-purple",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ChangelogPage() {
  const byYear = new Map<string, typeof CHANGELOG_ENTRIES>();
  for (const entry of CHANGELOG_ENTRIES) {
    const year = entry.date.slice(0, 4);
    const list = byYear.get(year) ?? [];
    list.push(entry);
    byYear.set(year, list);
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/85 border-b border-line/40">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors">
            <ArrowLeft size={15} /> UMAI
          </Link>
          <Link
            href="/app"
            className="bg-brand hover:bg-branddim text-[#111110] font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            Uygulamayı Aç
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 w-full flex-1">
        <div className="mb-14 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full mb-4">
            <Sparkles size={12} /> Değişiklik günlüğü
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Yenilikler</h1>
          <p className="text-muted mt-4 max-w-lg mx-auto leading-relaxed">
            UMAI&apos;ye eklenen özellikler ve iyileştirmeler — en yeniden en eskiye.
          </p>
        </div>

        <div className="space-y-14">
          {[...byYear.entries()].map(([year, entries]) => (
            <div key={year}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted/50 mb-5">{year}</h2>
              <ol className="relative border-l border-line pl-6 space-y-8">
                {entries.map((entry) => (
                  <li key={entry.title} className="relative">
                    <span className="absolute -left-[29px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-bg" />
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted/70 tabular-nums">{formatDate(entry.date)}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${TAG_CLASS[entry.tag]}`}>
                        {TAG_LABEL[entry.tag]}
                      </span>
                    </div>
                    <h3 className="font-bold text-[15px] mb-1">{entry.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{entry.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-line text-center">
          <p className="text-sm text-muted">
            Bir sorun mu buldun veya öneri mi var?{" "}
            <Link href="/help" className="text-brand hover:underline">Yardım Merkezi</Link>&apos;ne bak ya da{" "}
            <a href="mailto:eneskahveci.bs@gmail.com" className="text-brand hover:underline">bize yaz</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
