import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım Şartları — Craft",
  description:
    "Craft hizmetini kullanırken uymanız gereken kullanım şartları ve koşullar.",
};

export default function TermsPage() {
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
            <Link href="/cookies" className="hover:text-ink">Çerezler</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14 flex-1 w-full">
        <div className="mb-8">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Hukuki Belgeler</p>
          <h1 className="text-3xl font-extrabold mb-2">Kullanım Şartları</h1>
          <p className="text-sm text-muted">
            Son güncelleme: 27 Mayıs 2026 · Yürürlük tarihi: 27 Mayıs 2026
          </p>
        </div>

        <div className="text-sm leading-relaxed text-muted [&_strong]:text-ink mb-6 p-4 rounded-xl border border-line bg-surface">
          Bu şartlar, Craft hizmetini kullanmanız için geçerlidir. Hizmeti
          kullanarak bu şartları kabul etmiş sayılırsınız. Kabul etmiyorsanız
          lütfen hizmeti kullanmayın.
        </div>

        <div>
          <Section title="1. Hizmet Tanımı">
            <p>
              Craft (<strong>&quot;Hizmet&quot;</strong>), Enes Kahveci
              tarafından geliştirilen ve işletilen bir yapay zeka kodlama
              asistanı web uygulamasıdır. Hizmet; üçüncü taraf AI API
              sağlayıcılarına (DeepSeek, Hugging Face, OpenRouter vb.) bağlantı
              sağlayan bir arayüz sunar.
            </p>
            <p className="mt-2">
              <strong>Önemli:</strong> Craft bir AI modeli işletmez.
              Mesajlarınız seçtiğiniz üçüncü taraf AI sağlayıcısına iletilir.
              Craft, bu sağlayıcıların ürettiği içerikten sorumlu değildir.
            </p>
          </Section>

          <Section title="2. Kullanım Koşulları">
            <p>Hizmeti kullanmak için:</p>
            <ul>
              <li>13 yaşını doldurmuş olmanız gerekmektedir.</li>
              <li>
                18 yaşından küçükseniz, ebeveyn veya vasi onayı ile
                kullanabilirsiniz.
              </li>
              <li>
                Kendi adınıza geçerli bir API anahtarı edinmekten siz
                sorumlusunuz. Craft API anahtarı sağlamaz.
              </li>
              <li>
                Hesap oluşturursanız, doğru ve güncel bilgi vermeyi kabul
                edersiniz.
              </li>
            </ul>
          </Section>

          <Section title="3. Yasak Kullanımlar">
            <p>
              Hizmeti aşağıdaki amaçlarla kullanmak kesinlikle yasaktır:
            </p>
            <ul>
              <li>
                Yasadışı içerik üretimi, paylaşımı veya depolanması
              </li>
              <li>
                Şiddet, nefret söylemi, ayrımcılık veya taciz içeren mesajlar
              </li>
              <li>
                Başkalarının kişisel verilerini izinsiz işlemek veya paylaşmak
              </li>
              <li>
                Kötü amaçlı yazılım (malware, ransomware, spyware vb.) geliştirme
              </li>
              <li>
                Kimlik avı (phishing), dolandırıcılık veya sahtecilik
              </li>
              <li>
                Sunuculara saldırı (DoS/DDoS), yetkisiz erişim girişimi veya
                güvenlik açığı istismarı
              </li>
              <li>
                Hizmetin kendisine veya üçüncü taraf sistemlere yönelik siber
                saldırı araçları geliştirme
              </li>
              <li>
                API hız sınırlarını manipüle etme veya sistemi aşma girişimi
              </li>
              <li>
                Telif hakkı korumalı içerikleri izinsiz çoğaltma veya dağıtma
              </li>
              <li>
                Çocukların istismarına yönelik herhangi bir içerik üretimi
              </li>
            </ul>
            <p className="mt-3">
              Bu kuralların ihlali hesabın askıya alınmasına ve gerektiğinde
              yetkili makamlarla paylaşıma yol açabilir.
            </p>
          </Section>

          <Section title="4. Üçüncü Taraf AI API Kullanımı">
            <p>
              Craft aracılığıyla üçüncü taraf AI sağlayıcılarına
              bağlandığınızda, o sağlayıcının kullanım şartlarını da kabul etmiş
              sayılırsınız:
            </p>
            <ul>
              <li>
                <a href="https://www.deepseek.com/terms" target="_blank" rel="noopener noreferrer">
                  DeepSeek Kullanım Şartları
                </a>
              </li>
              <li>
                <a href="https://huggingface.co/terms-of-service" target="_blank" rel="noopener noreferrer">
                  Hugging Face Kullanım Şartları
                </a>
              </li>
              <li>
                <a href="https://openrouter.ai/terms" target="_blank" rel="noopener noreferrer">
                  OpenRouter Kullanım Şartları
                </a>
              </li>
            </ul>
            <p className="mt-3">
              Her sağlayıcının içerik politikasına uymakla yükümlüsünüz.
              Craft, sağlayıcıların ürettiği yanıtların doğruluğunu,
              güncelliğini veya uygunluğunu garanti etmez.
            </p>
          </Section>

          <Section title="5. API Anahtarı Güvenliği">
            <p>
              API anahtarlarınız <strong>yalnızca tarayıcınızın yerel
              deposunda</strong> saklanır. Bununla birlikte:
            </p>
            <ul>
              <li>
                API anahtarınızı kimseyle paylaşmamaktan siz sorumlusunuz.
              </li>
              <li>
                Kullanımı biten veya sızan bir anahtarı hemen sağlayıcı
                panelinden iptal etmelisiniz.
              </li>
              <li>
                API anahtarınızın kötüye kullanımından doğacak masraflar size
                aittir.
              </li>
            </ul>
          </Section>

          <Section title="6. Fikri Mülkiyet">
            <p>
              Craft uygulamasının kaynak kodu MIT lisansı altında
              yayımlanmaktadır. Craft adı, logosu ve markası Enes
              Kahveci&apos;ye aittir.
            </p>
            <p className="mt-2">
              Siz kullanıcı olarak, hizmet aracılığıyla oluşturduğunuz
              içeriklerin (sohbet geçmişi, üretilen kodlar vb.) tüm haklarını
              saklı tutarsınız. Craft bu içerikleri pazarlama amacıyla
              kullanmaz.
            </p>
          </Section>

          <Section title="7. Hizmetin Sürekliliği ve Değişiklikler">
            <p>
              Craft, hizmeti önceden haber vermeksizin geçici veya kalıcı
              olarak değiştirme, askıya alma veya sonlandırma hakkını saklı tutar.
              Bu durumlarda herhangi bir tazminat yükümlülüğümüz bulunmamaktadır.
            </p>
            <p className="mt-2">
              Bu şartlar zaman zaman güncellenebilir. Güncellemeler bu sayfada
              yayımlanır. Hizmeti kullanmaya devam etmeniz güncel şartları
              kabul ettiğiniz anlamına gelir.
            </p>
          </Section>

          <Section title="8. Sorumluluk Sınırlaması">
            <p>
              Yürürlükteki yasaların izin verdiği azami ölçüde:
            </p>
            <ul>
              <li>
                Craft, hizmet kesintilerinden, veri kayıplarından veya AI
                yanıtlarının hatalı olmasından kaynaklanan doğrudan ya da dolaylı
                zararlardan sorumlu değildir.
              </li>
              <li>
                Hizmet &quot;olduğu gibi&quot; (as-is) ve &quot;mevcut
                haliyle&quot; sunulmaktadır; herhangi bir garantisi yoktur.
              </li>
              <li>
                Üçüncü taraf AI sağlayıcılarının ürettiği yanlış, yanıltıcı
                veya zararlı içeriklerden Craft sorumlu tutulamaz.
              </li>
              <li>
                Doğrudan veya dolaylı zararlara ilişkin toplam sorumluluğumuz
                son 3 aylık dönemde hizmetten elde edilen geliri (varsa) aşmaz.
              </li>
            </ul>
          </Section>

          <Section title="9. Hesap Feshi">
            <p>
              Hesabınızı istediğiniz zaman silebilirsiniz. Hesap silindiğinde
              Supabase&apos;deki tüm sohbet geçmişiniz ve kişisel verileriniz
              kalıcı olarak kaldırılır.
            </p>
            <p className="mt-2">
              Kullanım şartlarını ihlal ettiğiniz tespit edilirse hesabınız
              önceden bildirmeksizin kapatılabilir.
            </p>
          </Section>

          <Section title="10. Uygulanacak Hukuk ve Uyuşmazlık Çözümü">
            <p>
              Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda
              İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.
            </p>
            <p className="mt-2">
              AB&apos;de ikamet eden kullanıcılar için GDPR kapsamındaki
              uyuşmazlıklarda yerel tüketici koruma mevzuatı ve DPA
              başvuruları da geçerlidir.
            </p>
          </Section>

          <Section title="11. İletişim">
            <p>
              Bu şartlarla ilgili sorularınız için:{" "}
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
      <div className="space-y-3 text-sm leading-relaxed text-muted [&_strong]:text-ink [&_a]:text-brand [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
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
