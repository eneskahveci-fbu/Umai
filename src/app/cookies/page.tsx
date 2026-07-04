import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Çerez Politikası — Craft",
  description:
    "Craft'nin hangi çerezleri kullandığı ve bunları nasıl yönetebileceğinize dair bilgiler.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <nav className="sticky top-0 z-50 backdrop-blur bg-bg/70 border-b border-line">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-extrabold">
            <span className="w-6 h-6 rounded-md bg-brand/10 border border-brand/25 grid place-items-center text-brand text-xs">
              ◇
            </span>
            craft<span className="brand-text">.ai</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted">
            <Link href="/privacy" className="hover:text-ink">Gizlilik</Link>
            <Link href="/terms" className="hover:text-ink">Kullanım Şartları</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14 flex-1 w-full">
        <div className="mb-8">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Hukuki Belgeler</p>
          <h1 className="text-3xl font-extrabold mb-2">Çerez Politikası</h1>
          <p className="text-sm text-muted">
            Son güncelleme: 27 Mayıs 2026 · Yürürlük tarihi: 27 Mayıs 2026
          </p>
        </div>

        <div>
          <Section title="1. Çerez Nedir?">
            <p>
              Çerezler (cookies), bir web sitesini ziyaret ettiğinizde
              tarayıcınıza yerleştirilen küçük metin dosyalarıdır. Oturum
              bilgilerinizi hatırlamak, tercihlerinizi saklamak ve hizmet
              kalitesini artırmak amacıyla kullanılırlar.
            </p>
            <p className="mt-2">
              Craft, kullanıcı deneyimini bozmayacak şekilde{" "}
              <strong>yalnızca zorunlu çerezler</strong> kullanır. Reklam,
              izleme veya davranışsal analiz çerezleri kullanılmamaktadır.
            </p>
          </Section>

          <Section title="2. Kullandığımız Çerezler">
            <table>
              <thead>
                <tr>
                  <th>Çerez Adı</th>
                  <th>Tür</th>
                  <th>Amaç</th>
                  <th>Süre</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>sb-[ref]-auth-token</code></td>
                  <td>Zorunlu</td>
                  <td>Supabase kimlik doğrulama oturumu</td>
                  <td>Oturum / 1 yıl</td>
                </tr>
                <tr>
                  <td><code>sb-[ref]-auth-token-code-verifier</code></td>
                  <td>Zorunlu</td>
                  <td>OAuth PKCE akışı güvenlik doğrulaması</td>
                  <td>Oturum</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-sm">
              Bu çerezler yalnızca hesabınıza giriş yaptığınızda oluşturulur.
              Giriş yapmadan uygulamayı kullanırsanız çerez oluşturulmaz.
            </p>
          </Section>

          <Section title="3. localStorage ile Saklanan Veriler">
            <p>
              Çerez olmamakla birlikte, Craft tarayıcınızın{" "}
              <strong>localStorage</strong> alanını aşağıdaki veriler için
              kullanır:
            </p>
            <table>
              <thead>
                <tr>
                  <th>Anahtar</th>
                  <th>İçerik</th>
                  <th>Amaç</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>craftai_config</code></td>
                  <td>Model ayarları, tema, API anahtarları, tercihler</td>
                  <td>Kişiselleştirme ve uygulama ayarları</td>
                </tr>
                <tr>
                  <td><code>craftai_chats</code></td>
                  <td>Sohbet geçmişi (giriş yapılmamışsa)</td>
                  <td>Çevrimdışı sohbet kaydı</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-sm">
              localStorage verileri sunucuya gönderilmez ve yalnızca kendi
              tarayıcınızda bulunur. Tarayıcı verilerini temizlediğinizde
              otomatik olarak silinirler.
            </p>
          </Section>

          <Section title="4. Üçüncü Taraf Çerezleri">
            <p>
              Craft herhangi bir üçüncü taraf reklam veya analitik
              çerezi kullanmamaktadır. Yüklenen harici kaynaklar şunlardır:
            </p>
            <ul>
              <li>
                <strong>Google Fonts (Geist ailesi):</strong> Yazı tipi
                yüklemesi için Googleʼın CDN&apos;i kullanılır. Google kendi
                gizlilik politikası kapsamında IP adresinizi işleyebilir.{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                  Google Gizlilik Politikası
                </a>
              </li>
              <li>
                <strong>Mermaid CDN (yalnızca diyagram önizlemesinde):</strong>{" "}
                Diyagram görüntüleme özelliğini kullandığınızda iframe içinde
                jsDelivr CDN üzerinden Mermaid kütüphanesi yüklenir.
              </li>
            </ul>
          </Section>

          <Section title="5. Çerezleri Yönetme">
            <p>
              Tarayıcınızın ayarlarından çerezleri engelleyebilir veya
              silebilirsiniz. Ancak Supabase kimlik doğrulama çerezlerini
              engellerseniz oturum açma özelliği çalışmaz.
            </p>
            <p className="mt-2 font-medium text-ink">Tarayıcı ayarları için:</p>
            <ul>
              <li>
                <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
                  Chrome — Çerez Ayarları
                </a>
              </li>
              <li>
                <a href="https://support.mozilla.org/tr/kb/cerezleri-etkinlestirin-ve-devre-disi-birakin" target="_blank" rel="noopener noreferrer">
                  Firefox — Çerez Ayarları
                </a>
              </li>
              <li>
                <a href="https://support.apple.com/tr-tr/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
                  Safari — Çerez Ayarları
                </a>
              </li>
              <li>
                <a href="https://support.microsoft.com/tr-tr/windows/microsoft-edge-de-cerezleri-silme-63947406" target="_blank" rel="noopener noreferrer">
                  Edge — Çerez Ayarları
                </a>
              </li>
            </ul>
          </Section>

          <Section title="6. localStorage Temizleme">
            <p>
              Tarayıcı geliştirici araçları (F12) → <strong>Uygulama</strong> →
              <strong>Yerel Depolama</strong> bölümünden Craft verilerini
              silebilirsiniz. Bu işlem ayarlarınızı ve giriş yapmadan saklanan
              sohbet geçmişinizi sıfırlar.
            </p>
          </Section>

          <Section title="7. İletişim">
            <p>
              Bu politika hakkında sorularınız için:{" "}
              <a href="mailto:eneskahveci.bs@gmail.com" className="text-brand hover:underline">
                eneskahveci.bs@gmail.com
              </a>
            </p>
          </Section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-4 pb-2 border-b border-line">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted [&_strong]:text-ink [&_a]:text-brand [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-bgsoft [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted [&_th]:border-b [&_th]:border-line [&_th]:pb-2 [&_td]:py-2 [&_td]:border-b [&_td]:border-line/50 [&_td]:text-sm [&_td]:align-top">
        {children}
      </div>
    </section>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
        <Link href="/" className="font-extrabold text-ink hover:text-brand">
          craft<span className="text-brand">.ai</span>
        </Link>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-ink">Gizlilik</Link>
          <Link href="/terms" className="hover:text-ink">Kullanım Şartları</Link>
          <Link href="/cookies" className="hover:text-ink">Çerezler</Link>
        </div>
        <span>© 2026 Enes Kahveci</span>
      </div>
    </footer>
  );
}
