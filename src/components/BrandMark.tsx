/* Umai'nin marka işareti — pin yeşili (#5c9478) elmas çerçeve + merkez nokta.
   Önceden bu AYNI geometri en az 3 yerde bağımsız olarak elle kopyalanmıştı
   (landing'in kendi LogoMark'ı, Sidebar'ın SidebarLogo'su, login sayfasının
   inline SVG'si — üçü de ufak farklı koordinatlarla) ve hukuki sayfalar
   (Privacy/Terms/Cookies) SVG yerine düz bir Unicode "◇" karakteri
   kullanıyordu — aynı marka işareti sitede 4 farklı şekilde görünüyordu.
   Artık TEK kaynak: her yer bu bileşeni içe aktarır. Favicon/OG görseli
   için ayrı tutulan `_logo.tsx`'teki `LogoTile` (Satori/next-og kısıtlarına
   uygun, statik boyutlu) buna dokunmadı — o zaten tek başına tutarlıydı. */
export function BrandMark({ size = 28, withTile = false }: { size?: number; withTile?: boolean }) {
  const mark = (
    <svg width={withTile ? size * 0.75 : size} height={withTile ? size * 0.75 : size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M14 4L23 9.5V18.5L14 24L5 18.5V9.5L14 4Z" stroke="#5c9478" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="14" r="2.8" fill="#5c9478" fillOpacity="0.9" />
    </svg>
  );
  if (!withTile) return mark;
  return (
    <span
      className="inline-grid place-items-center rounded-md bg-brand/10 border border-brand/25 shrink-0"
      style={{ width: size, height: size }}
    >
      {mark}
    </span>
  );
}
