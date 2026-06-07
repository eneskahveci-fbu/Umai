import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — Craft.Coder",
  description:
    "Craft.Coder'nin kişisel verilerinizi nasıl işlediğine dair KVKK ve GDPR uyumlu gizlilik politikası.",
};

export default function PrivacyPage() {
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
            <Link href="/terms" className="hover:text-ink">Kullanım Şartları</Link>
            <Link href="/cookies" className="hover:text-ink">Çerez Politikası</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14 flex-1 w-full">
        <div className="mb-8">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Hukuki Belgeler</p>
          <h1 className="text-3xl font-extrabold mb-2">Gizlilik Politikası</h1>
          <p className="text-sm text-muted">
            Son güncelleme: 27 Mayıs 2026 · Yürürlük tarihi: 27 Mayıs 2026
          </p>
        </div>

        <div className="prose-legal">

          <Section title="1. Veri Sorumlusu">
            <p>
              Bu politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve
              AB Genel Veri Koruma Tüzüğü (GDPR) kapsamında <strong>Enes Kahveci</strong>{" "}
              tarafından hazırlanmıştır. Veri sorumlusu sıfatıyla iletişim adresi:
            </p>
            <p className="mt-2">
              <strong>E-posta:</strong>{" "}
              <a href="mailto:eneskahveci.bs@gmail.com" className="text-brand hover:underline">
                eneskahveci.bs@gmail.com
              </a>
            </p>
          </Section>

          <Section title="2. İşlenen Kişisel Veriler">
            <p>
              Craft.Coder farklı işlevler için farklı veriler işler. Aşağıda hangi
              verilerin, hangi amaçla ve hangi hukuki dayanak ile işlendiği
              açıklanmaktadır.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Veri</th>
                  <th>Amaç</th>
                  <th>Hukuki Dayanak</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>E-posta adresi</td>
                  <td>Hesap oluşturma ve kimlik doğrulama (opsiyonel)</td>
                  <td>Açık rıza / Sözleşme ifası</td>
                </tr>
                <tr>
                  <td>Sohbet geçmişi</td>
                  <td>Cihazlar arası senkronizasyon (opsiyonel, yalnızca giriş yapıldığında)</td>
                  <td>Açık rıza / Meşru menfaat</td>
                </tr>
                <tr>
                  <td>AI sohbet mesajları</td>
                  <td>Seçilen AI API'ye iletilerek yanıt alınması</td>
                  <td>Sözleşme ifası / Hizmet sunumu</td>
                </tr>
                <tr>
                  <td>API anahtarları</td>
                  <td>Yalnızca tarayıcı yerel deposunda (localStorage) saklanır; sunucuya gönderilmez</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>IP adresi</td>
                  <td>Hız sınırlama (rate limiting) ve güvenlik; sunucu belleğinde geçici tutulur</td>
                  <td>Meşru menfaat</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-sm text-muted">
              <strong>Gizli Sohbet (İncognito):</strong> Bu modda hiçbir mesaj
              Supabase&apos;e yazılmaz. Veriler yalnızca tarayıcı oturumu süresince
              bellekte kalır ve sekme kapatıldığında silinir.
            </p>
          </Section>

          <Section title="3. Üçüncü Taraf Veri İşleyiciler">
            <p>
              Craft.Coder, hizmet sunumunda aşağıdaki üçüncü taraf sağlayıcıları
              kullanmaktadır. Sohbet mesajlarınız, seçtiğiniz AI sağlayıcısına{" "}
              <strong>Craft.Coder sunucusu üzerinden</strong> iletilir. Bu iletim
              sırasında mesajlar sunucuda <strong>kalıcı olarak saklanmaz</strong>.
            </p>

            <SubTitle>3.1 Supabase (Kimlik Doğrulama ve Veritabanı)</SubTitle>
            <ul>
              <li>Sağlayıcı: Supabase Inc., San Francisco, CA, ABD</li>
              <li>Amaç: Kullanıcı hesabı yönetimi, sohbet geçmişi depolama</li>
              <li>Saklama konumu: AWS veri merkezi (Frankfurt, Almanya / eu-west-1)</li>
              <li>
                Gizlilik politikası:{" "}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  supabase.com/privacy
                </a>
              </li>
            </ul>

            <SubTitle>3.2 DeepSeek AI</SubTitle>
            <ul>
              <li>Sağlayıcı: DeepSeek, Hangzhou, Çin</li>
              <li>Amaç: AI yanıt üretimi (yalnızca kullanıcı DeepSeek seçerse)</li>
              <li>
                Gizlilik politikası:{" "}
                <a href="https://www.deepseek.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  deepseek.com/privacy
                </a>
              </li>
              <li className="text-muted text-sm">
                ⚠ DeepSeek sunucuları Çin&apos;de bulunmaktadır. DeepSeek kullanmayı
                tercih etmiyorsanız Hugging Face veya OpenRouter&apos;ı seçin.
              </li>
            </ul>

            <SubTitle>3.3 Hugging Face</SubTitle>
            <ul>
              <li>Sağlayıcı: Hugging Face Inc., New York, ABD</li>
              <li>Amaç: AI yanıt üretimi (yalnızca kullanıcı HF seçerse)</li>
              <li>
                Gizlilik politikası:{" "}
                <a href="https://huggingface.co/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  huggingface.co/privacy
                </a>
              </li>
            </ul>

            <SubTitle>3.4 OpenRouter</SubTitle>
            <ul>
              <li>Sağlayıcı: OpenRouter Inc., ABD</li>
              <li>Amaç: AI yanıt üretimi (yalnızca kullanıcı OpenRouter seçerse)</li>
              <li>
                Gizlilik politikası:{" "}
                <a href="https://openrouter.ai/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  openrouter.ai/privacy
                </a>
              </li>
            </ul>

            <SubTitle>3.5 Vercel (Barındırma)</SubTitle>
            <ul>
              <li>Sağlayıcı: Vercel Inc., San Francisco, CA, ABD</li>
              <li>Amaç: Web uygulaması barındırma ve edge ağı</li>
              <li>
                Gizlilik politikası:{" "}
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  vercel.com/legal/privacy-policy
                </a>
              </li>
            </ul>

            <p className="mt-4 text-sm">
              Her API sağlayıcısının kendi gizlilik politikasını incelemenizi öneririz.
              API anahtarınızı Craft.Coder&apos;ye kaydettiğinizde, bu anahtar{" "}
              <strong>yalnızca tarayıcınızın yerel deposunda (localStorage)</strong>{" "}
              saklanır ve Craft.Coder sunucusuna gönderilmez.
            </p>
          </Section>

          <Section title="4. Uluslararası Veri Transferi">
            <p>
              Supabase (Frankfurt EU sunucu seçeneği ile), Hugging Face ve Vercel
              için GDPR Standart Sözleşme Maddeleri (SCC) çerçevesinde veri
              güvencesi sağlanmaktadır.
            </p>
            <p className="mt-2">
              <strong>DeepSeek:</strong> Mesajlarınız DeepSeek kullanılıyorsa
              Çin&apos;e aktarılabilir. KVKK Madde 9 uyarınca bu aktarım için
              açık rızanız gerekmektedir; DeepSeek model seçimi bu onayı
              kapsamaktadır.
            </p>
          </Section>

          <Section title="5. Veri Saklama Süreleri">
            <ul>
              <li>
                <strong>Sohbet geçmişi:</strong> Hesabınızı silene veya sohbeti
                manuel silene kadar Supabase&apos;de tutulur.
              </li>
              <li>
                <strong>E-posta adresi:</strong> Hesap silme talebine kadar.
              </li>
              <li>
                <strong>IP bazlı hız sınırlama kaydı:</strong> Sunucu belleğinde
                en fazla 1 dakika.
              </li>
              <li>
                <strong>LocalStorage verileri:</strong> Tarayıcı verilerini
                temizleyene kadar cihazınızda.
              </li>
            </ul>
          </Section>

          <Section title="6. KVKK ve GDPR Kapsamındaki Haklarınız">
            <p>
              6698 sayılı KVKK&apos;nın 11. maddesi ve GDPR&apos;ın 15-22.
              maddeleri kapsamında aşağıdaki haklara sahipsiniz:
            </p>
            <ul>
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içi veya yurt dışında verilerin aktarıldığı üçüncü kişileri öğrenme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>KVKK Madde 7 kapsamında verilerinizin silinmesini isteme</li>
              <li>Düzeltme ve silme işlemlerinin üçüncü kişilere bildirilmesini isteme</li>
              <li>Otomatik sistemler vasıtasıyla analiz edilmesi halinde aleyhte sonuca itiraz etme</li>
              <li>Zararın giderilmesini talep etme</li>
            </ul>
            <p className="mt-3">
              Haklarınızı kullanmak için{" "}
              <a href="mailto:eneskahveci.bs@gmail.com" className="text-brand hover:underline">
                eneskahveci.bs@gmail.com
              </a>{" "}
              adresine yazabilirsiniz. Talepler 30 gün içinde yanıtlanır.
            </p>
          </Section>

          <Section title="7. Güvenlik">
            <p>
              Verilerinizi korumak için aşağıdaki teknik ve idari önlemler alınmaktadır:
            </p>
            <ul>
              <li>HTTPS ile şifreli iletişim (TLS 1.2+)</li>
              <li>Supabase Row Level Security (RLS) ile satır düzeyinde erişim denetimi</li>
              <li>API anahtarlarının sunucuya iletilmemesi</li>
              <li>İstek başına hız sınırlaması (rate limiting)</li>
              <li>Güvenlik başlıkları: X-Frame-Options, X-Content-Type-Options, CSP</li>
            </ul>
          </Section>

          <Section title="8. Çerezler">
            <p>
              Craft.Coder yalnızca zorunlu çerezler kullanmaktadır. Ayrıntılar için{" "}
              <Link href="/cookies" className="text-brand hover:underline">
                Çerez Politikamıza
              </Link>{" "}
              bakın.
            </p>
          </Section>

          <Section title="9. Politika Değişiklikleri">
            <p>
              Bu politika güncellenebildiğinde değişiklikler bu sayfada
              yayımlanır ve &quot;Son güncelleme&quot; tarihi revize edilir.
              Önemli değişikliklerde kayıtlı kullanıcılar e-posta ile
              bilgilendirilir.
            </p>
          </Section>

          <Section title="10. İletişim ve Şikayet">
            <p>
              Sorularınız için:{" "}
              <a href="mailto:eneskahveci.bs@gmail.com" className="text-brand hover:underline">
                eneskahveci.bs@gmail.com
              </a>
            </p>
            <p className="mt-2">
              KVKK kapsamında şikayetleriniz için Kişisel Verileri Koruma
              Kurumu&apos;na başvurabilirsiniz:{" "}
              <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                kvkk.gov.tr
              </a>
            </p>
            <p className="mt-2">
              AB&apos;de ikamet ediyorsanız yerel Veri Koruma Otoritenize
              (DPA) başvurabilirsiniz.
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
      <div className="space-y-3 text-sm leading-relaxed text-muted [&_strong]:text-ink [&_a]:text-brand [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted [&_th]:border-b [&_th]:border-line [&_th]:pb-2 [&_td]:py-2 [&_td]:border-b [&_td]:border-line/50 [&_td]:text-sm">
        {children}
      </div>
    </section>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-ink mt-5 mb-2">{children}</h3>;
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
