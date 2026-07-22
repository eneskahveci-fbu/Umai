import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "./BrandMark";

/* Pazarlama/statik sayfaların (/, /pricing, /help, /changelog, /privacy,
   /terms, /cookies) ORTAK üst çubuğu. Önceden her sayfa kendi header'ını
   elle yazmıştı — yükseklik (h-16 vs h-14), saydamlık (.glass vs
   backdrop-blur-md vs backdrop-blur), logo (SVG vs Unicode "◇" vs hiç) ve
   CTA metni ("Başla" vs "Uygulamayı Aç" vs yok) sayfadan sayfaya farklıydı.
   Artık TEK kabuk: sol taraf (logo+wordmark, her zaman `/`'e gider) sabit;
   sağ taraf `right` prop'uyla sayfaya özgü kalır (ör. hukuki sayfalarda
   "Uygulamayı Aç" yerine diğer hukuki belgelere çapraz bağlantılar — bu
   kasıtlı bir içerik farkı, kaldırılmadı). `maxWidthClass` sayfanın kendi
   içerik genişliğiyle hizalanabilsin diye ayarlanabilir. */
export function MarketingHeader({
  maxWidthClass = "max-w-5xl",
  right,
}: {
  maxWidthClass?: string;
  right?: React.ReactNode;
}) {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/85 border-b border-line/40">
      <div className={`${maxWidthClass} mx-auto px-5 sm:px-6 h-16 flex items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight text-ink shrink-0">
          <BrandMark size={26} />
          UMAI
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">{right}</div>
      </div>
    </nav>
  );
}

/** Tüm pazarlama sayfalarındaki ORTAK "uygulamaya git" eylemi — tek yerde
    tanımlı metin/stil sayesinde artık her sayfada birebir aynı. */
export function OpenAppCta() {
  return (
    <Link
      href="/app"
      className="flex items-center gap-1.5 bg-brand hover:bg-branddim text-[#111110] font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm shadow-brand/20"
    >
      Uygulamayı Aç <ArrowRight size={15} />
    </Link>
  );
}
