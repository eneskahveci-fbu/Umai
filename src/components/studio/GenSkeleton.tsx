"use client";

/* Stüdyo "oluşturuluyor…" durumları için paylaşılan shimmer iskelet —
   sohbetteki AI görsel üretiminin (GeneratedImage) kullandığı aynı
   `.shimmer` dilini kullanır; düz "animate-pulse" yazıdan daha somut bir
   yükleniyor hissi verir. */
export function GenSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2 w-full max-w-md mx-auto" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded-full shimmer" style={{ width: `${70 - i * 14}%` }} />
      ))}
    </div>
  );
}
