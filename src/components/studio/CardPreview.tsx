"use client";

/* V3 — Kart mini önizlemeleri.

   Kartlar eskiden yalnız ikon + başlık + açıklamaydı; ne üreteceğini
   göstermiyorlardı. Claude Design'ın şablon galerisinde her kartın görsel bir
   karşılığı var. Burada aynı etkiyi SIFIR ek maliyetle elde ediyoruz: her
   önizleme saf CSS kutulardan oluşuyor — resim yok, ağ isteği yok, SVG yok.
   Tema değişkenlerini (--color-brand/line/muted) kullandıkları için açık/koyu
   temada ve vurgu rengi değiştiğinde kendiliğinden uyumlular. */

const bar = "rounded-[2px] bg-muted/25";
const brandBar = "rounded-[2px] bg-brand/45";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <span className="block w-full h-14 rounded-lg border border-line/60 bg-bgsoft/50 overflow-hidden p-1.5">
      <span className="flex flex-col gap-1 h-full w-full">{children}</span>
    </span>
  );
}

/** Landing sayfası: üst çubuk, hero bloğu, üç sütun. */
function DesignPreview() {
  return (
    <Shell>
      <span className="flex items-center gap-1">
        <span className={`${brandBar} h-1 w-3`} />
        <span className={`${bar} h-1 w-1.5 ml-auto`} />
        <span className={`${bar} h-1 w-1.5`} />
      </span>
      <span className={`${brandBar} h-2.5 w-2/3 rounded-sm`} />
      <span className="flex gap-1 mt-auto">
        <span className={`${bar} h-3 flex-1`} />
        <span className={`${bar} h-3 flex-1`} />
        <span className={`${bar} h-3 flex-1`} />
      </span>
    </Shell>
  );
}

/** Kod: girintili satırlar + noktalama. */
function CodePreview() {
  const rows = [
    { w: "w-1/2", brand: true },
    { w: "w-3/4", indent: true },
    { w: "w-2/3", indent: true },
    { w: "w-1/3" },
  ];
  return (
    <Shell>
      {rows.map((r, i) => (
        <span key={i} className={`flex items-center gap-1 ${r.indent ? "pl-2" : ""}`}>
          <span className={`${r.brand ? brandBar : bar} h-1 ${r.w}`} />
        </span>
      ))}
    </Shell>
  );
}

/** Doküman: başlık + paragraf satırları. */
function DocPreview() {
  return (
    <Shell>
      <span className={`${brandBar} h-1.5 w-1/2 rounded-sm`} />
      <span className={`${bar} h-1 w-full`} />
      <span className={`${bar} h-1 w-full`} />
      <span className={`${bar} h-1 w-4/5`} />
      <span className={`${bar} h-1 w-2/3`} />
    </Shell>
  );
}

/** Diyagram: bir düğüm → iki düğüm, bağlantı çizgileriyle. */
function DiagramPreview() {
  return (
    <Shell>
      <span className="flex-1 grid place-items-center">
        <span className="flex flex-col items-center gap-0.5">
          <span className="h-2 w-5 rounded-[3px] border border-brand/50 bg-brand/15" />
          <span className={`${bar} h-1.5 w-px`} />
          <span className="flex items-start gap-2">
            <span className="h-2 w-4 rounded-[3px] border border-line bg-muted/15" />
            <span className="h-2 w-4 rounded-[3px] border border-line bg-muted/15" />
          </span>
        </span>
      </span>
    </Shell>
  );
}

/** Sunum: slayt başlığı + madde satırları + sayfa noktaları. */
function DeckPreview() {
  return (
    <Shell>
      <span className={`${brandBar} h-1.5 w-1/2 rounded-sm`} />
      <span className={`${bar} h-1 w-3/4`} />
      <span className={`${bar} h-1 w-2/3`} />
      <span className="flex items-center gap-0.5 mt-auto justify-center">
        <span className="h-1 w-1 rounded-full bg-brand/60" />
        <span className="h-1 w-1 rounded-full bg-muted/30" />
        <span className="h-1 w-1 rounded-full bg-muted/30" />
      </span>
    </Shell>
  );
}

const PREVIEWS: Record<string, () => React.JSX.Element> = {
  design: DesignPreview,
  code: CodePreview,
  doc: DocPreview,
  diagram: DiagramPreview,
  deck: DeckPreview,
};

export function CardPreview({ kind }: { kind: string }) {
  const P = PREVIEWS[kind];
  return P ? <P /> : null;
}
