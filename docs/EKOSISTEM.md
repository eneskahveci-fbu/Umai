# craft ekosistem yol haritası & ilham anketi

> Amaç: craft'ı tek bir kodlama asistanından, **ücretsiz ve anahtarsız çalışan
> bir üretkenlik ekosistemine** dönüştürmek. Bu doküman hem bu turda ekleneni
> özetler hem de "sıradaki ilham hangi ekosistemden gelsin?" anketini içerir.

## Bu turda eklenenler (Google ekosisteminden ilhamla)

| Özellik | İlham | Maliyet | Nerede |
|---|---|---|---|
| **Sunum Stüdyosu** — brief → slayt destesi, tema, tek-slayt AI yeniden yazımı, sunum modu, HTML/PDF dışa aktarma | Google Slides (klon değil: slaytlar JSON verisi olarak kalır, render deterministik) | 0 ₺ (Pollinations tabanı) | `/studio/sunum` |
| **TTS anlatım** — slayt notlarını ve sohbet yanıtlarını seslendirme, 6 ses | Google Assistant / NotebookLM sesli özet | 0 ₺ (Pollinations `openai-audio`, tarayıcı yedeği) | Sunum Stüdyosu + sohbet "Seslendir" |
| **Canlı görsel model kataloğu** — Pollinations `/models` ucundan; yeni modeller kendiliğinden listeye düşer | Google Play "otomatik güncellenen katalog" yaklaşımı | 0 ₺ | Görüntü Stüdyosu |
| **Slayt görselleri** — deterministik seed'le slayt başına AI görseli + tek tıkla varyasyon | Google Slides görsel önerileri | 0 ₺ | Sunum Stüdyosu |

Stüdyo artık **dört yüzeyli** tek bir üretim merkezi: **Stüdyo** (brief→web
tasarımı) · **Sunum** (slayt destesi) · **Tuval** (katman editörü) · **Görüntü**
(AI görsel). Tüm yüzeyler gerçek rotalarda yaşar, mobil alt çubukta ve komut
paletinde (⌘K) yer alır.

## Anket: sıradaki ilham hangi ekosistemden gelsin?

> **Anket sonucu (2026-07-04):** Notion, Google Forms, Canva ve NotebookLM'in
> **dördü de** seçildi. Uygulama sırası (değer/emek oranına göre):
> **1) Notion Docs → 2) Google Forms → 3) Canva şablon pazarı → 4) NotebookLM.**
> Figma ve Obsidian şimdilik beklemede.

Hepsi **ücretsiz altyapıyla** (localStorage + Supabase free tier + Pollinations)
yapılabilecek şekilde seçildi. Birden fazla işaretlenebilir; sıralama önerilen
önceliktir.

- [x] **1. Notion — "Craft Docs" (ÖNERİLEN)**
  Blok tabanlı doküman/wiki yüzeyi: AI ile taslak, sohbetten dokümana dönüştürme,
  Skills ile beslenen şablonlar. Sunum Stüdyosu'nun JSON-veri yaklaşımı bloklara
  birebir taşınır — altyapının %60'ı hazır. *Maliyet: 0 ₺ (localStorage).*

- [x] **2. Google Forms — "Craft Anket"**
  Brief → anket JSON'u → paylaşılabilir bağımsız HTML formu (`/api/publish`
  zaten var). Yanıtlar Supabase free tier'da toplanır, özet AI ile çıkarılır.
  Bu dokümandaki anketin kendisi bile bu özellikle yapılabilirdi. *Maliyet: 0 ₺.*

- [x] **3. Canva — şablon pazarı & marka kiti genişletmesi**
  Mevcut tasarım sistemleri + şablon galerisini topluluk paylaşımına açmak:
  şablonu bağlantıyla paylaş / içe aktar (JSON). Tuval'in katman modeliyle uyumlu.
  *Maliyet: 0 ₺ (paylaşım `/api/publish` üstünden).*

- [ ] **4. Figma — canlı işbirliği**
  Supabase Realtime ile aynı stüdyo projesinde eşzamanlı imleç/yorum. Teknik
  olarak en iddialı seçenek; free tier limitlerine dikkat. *Maliyet: 0 ₺ başlangıç.*

- [ ] **5. Obsidian — bilgi grafiği**
  Sohbetler + skills + dokümanlar arasında otomatik bağlantı grafiği; "bunu
  daha önce konuşmuştuk" hafızası (mevcut `rag.ts` üstüne). *Maliyet: 0 ₺.*

- [x] **6. NotebookLM — kaynak-temelli çalışma alanı**
  PDF/URL kaynakları yükle (pdf.ts var) → kaynaklara sadık AI sohbeti +
  Pollinations TTS ile "sesli özet" (podcast benzeri). *Maliyet: 0 ₺.*

### Öneri gerekçesi

**Notion (1) + Forms (2)** ikilisi en yüksek değer/emek oranını verir: ikisi de
Sunum Stüdyosu'nda kurulan "yapılandırılmış JSON → deterministik render →
bağımsız HTML dışa aktarma" desenini yeniden kullanır, yeni harici bağımlılık
gerektirmez ve craft'ı "sohbet + kod" ürününden "üret-yayınla-topla" döngüsü
olan gerçek bir ekosisteme taşır.

## İlkeler (her yeni yüzey için)

1. **Ücretsiz taban şart:** özellik anahtarsız Pollinations ile de çalışmalı;
   BYOK yalnızca kaliteyi yükseltir.
2. **Veri > HTML:** üretimler mümkünse yapılandırılmış veri olarak saklanır
   (tema/düzen değişimi kayıpsız olsun), HTML yalnız dışa aktarma biçimidir.
3. **Tek stüdyo hissi:** her yüzey mod seçicide, mobil alt çubukta ve ⌘K
   paletinde yer alır; gerçek rotada yaşar (derin bağlantı + geri tuşu).
4. **Gizlilik:** anahtarlar tarayıcıda kalır; Pollinations çağrılarına
   `private=true` eklenir (herkese açık akışa düşmez).
