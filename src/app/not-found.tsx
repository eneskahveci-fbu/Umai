import Link from "next/link";
import { Compass, Home, MessageSquare } from "lucide-react";

export const metadata = {
  title: "Sayfa bulunamadı — Craft",
  description: "Aradığın sayfa burada değil.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-8 bg-bg text-ink">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand/10 grid place-items-center"
          aria-hidden="true"
        >
          <Compass size={32} className="text-brand" />
        </div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted mb-2">
          404
        </p>
        <h1 className="text-2xl font-extrabold mb-2 tracking-tight">
          Sayfa bulunamadı
        </h1>
        <p className="text-muted text-sm mb-7 leading-relaxed">
          Aradığın sayfa taşınmış ya da hiç var olmamış olabilir. Aşağıdaki
          bağlantılardan birini deneyebilirsin.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-branddim text-[#111110] font-semibold text-sm transition-colors"
          >
            <Home size={15} aria-hidden="true" />
            Ana sayfa
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line hover:border-brand/50 font-semibold text-sm transition-colors"
          >
            <MessageSquare size={15} aria-hidden="true" />
            Uygulamayı aç
          </Link>
        </div>
      </div>
    </div>
  );
}
