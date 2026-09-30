"use client";
import { useState, useCallback, type ReactNode } from "react";
import { X, AlertTriangle, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { analyzeFile, type ComplexityRating, type FileAnalysis } from "@/lib/codeAnalysis";
import type { EditorFile } from "@/lib/editor";

interface Props {
  files: EditorFile[];
  onClose: () => void;
}

const RATING_COLOR: Record<ComplexityRating, string> = {
  iyi: "text-green",
  orta: "text-yellow",
  karmaşık: "text-red",
};

const RATING_ICON: Record<ComplexityRating, ReactNode> = {
  iyi: <CheckCircle2 size={13} className="text-green" />,
  orta: <AlertCircle size={13} className="text-yellow" />,
  karmaşık: <AlertTriangle size={13} className="text-red" />,
};

/* Teknik Borç Takipçisi — şu anda editörde AÇIK dosyaları (repo'nun tamamını
   değil) tarar: repo boyutuna göre yavaşlamaz, kullanıcının ZATEN baktığı
   dosyalar hakkında anında geri bildirim verir. Tamamen istemci-tarafı, saf
   fonksiyonlar (bkz. codeAnalysis.ts) — sunucuya/LLM'e hiçbir şey gitmez. */
export function DebtPanel({ files, onClose }: Props) {
  const [results, setResults] = useState<FileAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const scan = useCallback(() => {
    setLoading(true);
    const analyses: FileAnalysis[] = [];
    for (const f of files) {
      if (!f.content) continue;
      // Sadece kaynak kod dosyaları
      if (!/\.(ts|tsx|js|jsx|py|go|rs|java|cs|cpp|c)$/.test(f.path)) continue;
      analyses.push(analyzeFile(f.path, f.content));
    }
    // Karmaşıklık puanına göre azalan sırala
    analyses.sort((a, b) => b.complexity.score - a.complexity.score);
    setResults(analyses);
    setScanned(true);
    setLoading(false);
  }, [files]);

  const totalMissing = results.reduce((s, r) => s + r.missingJsdocFunctions.length, 0);
  const totalDups = results.reduce((s, r) => s + r.duplicateBlocks.length, 0);
  const complexFiles = results.filter((r) => r.complexity.rating === "karmaşık").length;

  return (
    <div className="w-full h-full flex flex-col bg-surface/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-line/60 shrink-0">
        <span className="text-xs font-bold text-muted/70 uppercase tracking-wide">Teknik Borç</span>
        <button onClick={onClose} className="text-muted/40 hover:text-muted transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Tara butonu */}
      <div className="px-3 py-2 shrink-0 border-b border-line/40">
        <button
          onClick={scan}
          disabled={loading || files.length === 0}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand text-xs font-medium transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Taranıyor…" : "Açık Dosyaları Tara"}
        </button>
        {files.length === 0 && (
          <p className="text-[10px] text-muted/50 mt-1 text-center">
            Önce editörde bir dosya aç
          </p>
        )}
      </div>

      {/* Özet */}
      {scanned && (
        <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-line/40 shrink-0">
          <Stat label="Karmaşık" value={complexFiles} color="text-red" />
          <Stat label="JSDoc Eksik" value={totalMissing} color="text-yellow" />
          <Stat label="Kopya Blok" value={totalDups} color="text-purple" />
        </div>
      )}

      {/* Dosya listesi */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!scanned && !loading && (
          <p className="text-[11px] text-muted/40 text-center px-4 pt-8">
            Açık dosyaları taramak için düğmeye bas.
          </p>
        )}
        {results.map((r) => (
          <div key={r.path} className="px-3 py-2 border-b border-line/20 hover:bg-bgsoft/50 transition-colors">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[11px] text-muted/80 break-all leading-tight flex-1">
                {r.path.split("/").slice(-2).join("/")}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {RATING_ICON[r.complexity.rating]}
                <span className={`text-[10px] font-bold tabular-nums ${RATING_COLOR[r.complexity.rating]}`}>
                  {r.complexity.score}
                </span>
              </div>
            </div>
            {r.missingJsdocFunctions.length > 0 && (
              <p className="text-[10px] text-yellow/80 mt-0.5">
                JSDoc eksik: {r.missingJsdocFunctions.slice(0, 3).join(", ")}
                {r.missingJsdocFunctions.length > 3 && ` +${r.missingJsdocFunctions.length - 3}`}
              </p>
            )}
            {r.duplicateBlocks.length > 0 && (
              <p className="text-[10px] text-purple/80">
                {r.duplicateBlocks.length} kopya blok
              </p>
            )}
          </div>
        ))}
      </div>

      {scanned && results.length === 0 && (
        <p className="text-[11px] text-muted/40 text-center px-4 py-8">
          Açık dosyalar arasında taranabilir kaynak kodu bulunamadı.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-base font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[9px] text-muted/50 uppercase tracking-wide">{label}</span>
    </div>
  );
}
