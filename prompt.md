# prompt.md — Umai için Ürün Stratejisi ve Konumlandırma Rehberi

> Bu dosya `CLAUDE.md`'den `@prompt.md` ile içe aktarılır — yani her yeni
> oturumda otomatik olarak bağlama girer. Amacı: Umai üzerinde çalışan her
> yapay zekâ ajanının (ve insan katkıda bulunanın) aynı stratejik pusulaya
> göre karar vermesini sağlamak. Kod nasıl yazılacağını değil, HANGİ işin
> neden/ne zaman/ne kadar öncelikli olduğunu anlatır.
>
> Bu bir "özellik listesi" değil — bir KISITLAR ve ÖNCELİKLER belgesidir.
> Çelişki durumunda: kullanıcının o anki açık talebi > bu dosya > genel
> sağduyu. Ama bu dosyadaki kurallar özellikle "sırada ne yapalım?" gibi
> açık uçlu sorularda varsayılan yön olarak kullanılmalı.

## 1. Neden bu dosya var — teşhis

Umai, tek bir uygulamada 8'den fazla ürün kategorisinin (kodlama asistanı,
tasarım stüdyosu, doküman editörü, anket aracı, not defteri, kart/tekrar
sistemi, zihin haritası, görsel/podcast üretimi) ince birer versiyonunu
barındırıyor. Her biri kendi başına, iyi finanse edilmiş rakiplere sahip
tam bir ürün kategorisi (Cursor/Copilot/Claude Code, Figma, Notion, Google
Forms, NotebookLM, Anki, Miro, Midjourney). Bunların hepsini AYNI ANDA iyi
yapmaya çalışmak, hiçbirini gerçekten öne çıkaramama riski taşıyor.

Buna karşılık projenin elinde gerçek, az kullanılan bir kanca var:
**BYOK (kendi anahtarını getir) + anahtarsız ücretsiz sağlayıcı zinciri
(Pollinations + otomatik fallback) sayesinde "asla ödeme yapmadan, asla
sert bir limitle karşılaşmadan çalışan" bir AI kodlama/sohbet deneyimi.**
Büyük oyuncuların (ChatGPT, Claude, Cursor, Copilot) hiçbiri bu vaadi
vermiyor — hepsi er ya da geç ücretli duvara çarptırıyor. Bu segment
(öğrenciler, hobiciler, gelişmekte olan ülkelerdeki geliştiriciler, Türkçe
konuşan dünya) gerçek ve büyük, ama kimse onun için TASARLANMIYOR.

## 2. Tek cümlelik konumlandırma (kuzey yıldızı)

> **"Asla ödeme yapmadan, asla limitle karşılaşmadan kod yaz ve sohbet et."**

Bu cümle, ürünün TÜM dış yüzeyinde (landing page, onboarding, ilk açılış
ekranı, pazarlama metni) tek ve net mesaj olmalı. Şu anki landing page
(`src/app/page.tsx`) bu kurala UYMUYOR — "İki yol" bölümü (satır 34-53)
Stüdyo'yu ("Yaratıcı işler") kodlama deneyimiyle ("Kod & geliştirme") EŞİT
görsel ağırlıkta, hero'da yan yana sunuyor. Bu, gelecekteki bir işte
düzeltilmesi gereken somut, kod-seviyesinde bir örnektir — bu dosyanın
yazıldığı anda henüz düzeltilmemiştir.

## 3. Stüdyolar hakkında KESİN kural

**STÜDYOLAR ÖN PLANA ÇIKARILMAYACAK — AMA KALDIRILMAYACAK, GELİŞTİRİLMEYE DEVAM EDİLECEK.**

Bu iki yönlü bir kural, ikisi de eşit derecede bağlayıcı:

### 3a. Ön plana çıkarma — YAPMA
- Landing page hero'sunda kodlama/sohbet deneyimiyle EŞİT görsel ağırlık
  verme (mevcut "iki yol" bölümü buna aykırı — düzeltilecek).
- Onboarding/ilk açılış akışında Stüdyo'yu birincil CTA (call-to-action)
  yapma. Birincil CTA her zaman "sohbete başla / kod yaz" olmalı.
- Pazarlama metnini "hepsi bir arada" ("all-in-one") anlatısı üzerine
  kurma — bu, "her şeyi biraz yapan, hiçbir şeyi iyi yapmayan" izlenimini
  güçlendirir. Tek mesaj madde 2'deki cümledir.
- Yeni bir stüdyo/ürün kategorisi EKLEME (ör. "9. stüdyo: X") — bu,
  genişleme değil dağılma olur. Mevcut kapsam (kodlama, tasarım, doküman,
  anket, defter, kartlar, kroki, görsel) sabit kabul edilsin.
- Sidebar/komut paletindeki mevcut erişilebilirlik seviyesini ARTIRMA
  (ör. Stüdyo'yu üst menüye/rail'e daha büyük bir ikonla taşımak,
  ayrı bir üst-seviye sekme yapmak vb.).

### 3b. Geliştirmeye devam et — YAP
- Mevcut stüdyoların KALİTESİNİ artır: hata düzeltme, eksik özellik
  tamamlama, performans, çıktı kalitesi (bkz. `studioCraft.ts`'teki
  "görünmez süpervizör" yaklaşımı — bu tarz sessiz kalite işleri devam
  etsin).
  ürün kategorisine ödünç almadan (kart sistemi zaten Anki'den, doküman
  zaten Notion'dan ilhamla — bunları GERÇEKTEN iyi yapmaya devam et, yeni
  bir kategori icat etme).
- Stüdyolar arası tutarlılığı (ExportMenu, Projelerim, kaydetme deseni)
  sürdür — kullanıcı bir stüdyoyu bulduğunda kaliteli bir deneyim bulsun,
  yalnız ORAYA GİDEN YOLU pazarlamayla büyütme.
- Sidebar/komut paletindeki MEVCUT erişim seviyesini (bir nav satırı, ⌘K
  ile bulunabilir) koru — buradaki "sessiz ama var" denge doğru, bozma.

**Özetle**: Stüdyolar sessiz, iyi bakılan bir arka bahçe olsun — ödünç
verilen misafirler için değil, onları zaten arayan/keşfeden kullanıcı için
kaliteli bir deneyim. Ama şirketin/ürünün "biz buyuz" cümlesi asla stüdyo
etrafında kurulmasın.

## 4. Beş somut stratejik hamle

### Hamle 1 — Pazarlama/konumlandırmada keskin tek-mesajlılık
Şu an ürün "hem X hem Y hem Z" anlatıyor. Tek cümleye (madde 2) indir.
Landing page, meta description, onboarding, ilk boş-sohbet ekranı — hepsi
AYNI cümleyi farklı şekillerde tekrarlamalı. Farklı sayfalarda farklı
vaatler kafa karıştırır ve hiçbiri hatırlanmaz.

### Hamle 2 — Sıfır sürtünmeli ilk deneyim
`/app` şu an girişsiz açılmıyor (auth gate). Bu, "gerçekten bedava mı?"
şüphesini anında kırma fırsatını kaybettiriyor. Hedef: bir ziyaretçi kayıt
olmadan, kredi kartı istenmeden, İLK 10 SANİYEDE gerçek bir mesaj
gönderip gerçek bir yanıt alabilsin (anahtarsız Pollinations zaten bunu
teknik olarak destekliyor — engel ürün kararı, teknik kısıt değil). Bu,
büyümenin önündeki en büyük sürtünme noktalarından biri olarak
değerlendirilmeli; auth gate'i tamamen kaldırmak yerine "önce dene, sonra
(isteğe bağlı) kaydol" akışı düşünülebilir — ama bu büyük bir mimari karar,
kullanıcıyla ayrıca konuşulmalı, bu dosya yalnız YÖNÜ işaret ediyor.

### Hamle 3 — Gerçek bir viral/paylaşım döngüsü
`/a/[id]` ile üretilen çıktılar zaten paylaşılabiliyor ama bu bir büyüme
motoru olarak TASARLANMAMIŞ. Her paylaşılan çıktının görünür bir "bununla
üretildi, sen de bedava dene" imzası + tek tıkla deneme yolu olmalı.
Kullanıcı kullanıcı getirmeden hiçbir ürün organik büyümez — bu, yeni bir
stüdyo eklemekten çok daha yüksek kaldıraçlı bir iş.

### Hamle 4 — Türkiye'yi sıçrama tahtası, nihai hedef değil yap
Türkçe konuşan dünya (Türkiye + Azerbaycan + diaspora), büyük İngilizce
şirketlerin göz ardı ettiği gerçek bir pazar. Üniversiteler, Türkçe
geliştirici toplulukları, bootcamp'ler üzerinden dağıtımla ÖNCE burada
gerçek, sadık bir kullanıcı kitlesi kazan. Aynı "bedava/sınırsız" vaadiyle
İngilizce/global pazara SONRA taşı — tersi sırayla (önce global, distraksiyon
riski çok daha yüksek) değil.

### Hamle 5 — Tek metriğe kilitlenme: özellik sayısı değil, geri dönüş
Yeni özellik/stüdyo eklemek yerine "kaç kullanıcı YARIN da geri geldi"
(retention/D1-D7) sorusuna odaklan. Şu an admin-only analitik var
(`AdminAnalytics.tsx`) ama bunun fiilen izlenip karar aldığına dair bir
işaret yok. Bir sonraki büyük mimari kararlardan önce: bu veriye BAK,
yoksa bakılabilir hale getir. "Sırada ne var?" sorusunun cevabı artık
"başka bir özellik" değil, "bu veri ne diyor?" olmalı.

## 5. Yapılmaması gerekenler (guardrails)

- Yeni bir ürün kategorisi/stüdyo EKLEME (madde 3a).
- Mevcut stüdyoları marketing/hero'ya taşıma (madde 3a).
- Anahtarsız/ücretsiz deneyimi kısıtlama veya arkasına yeni bir engel
  (kayıt, kredi kartı, e-posta doğrulama vb.) ekleme — bu, tam olarak
  kurulmaya çalışılan güven vaadini kırar.
- "Hepsi bir arada" / "all-in-one" temalı pazarlama metni yazma.
- Kullanıcı doğrulanmış talep olmadan (madde 4, Hamle 5) büyük yeni
  özellik/mimari yatırımı yapma — önce ölç, sonra ekle.
- Bu dosyayı okumadan/dikkate almadan "sırada ne yapalım?" tarzı açık
  uçlu bir isteğe geniş bir özellik listesiyle cevap verme — önce bu
  belgedeki 5 hamleden hangisinin sırada olduğunu değerlendir.

## 6. Bu dosyayla nasıl çalışılır

Bir gelecek oturumda "sırada ne var", "bu siteye ne eklenebilir" gibi açık
uçlu bir soru geldiğinde:
1. Önce madde 4'teki 5 hamleden hangisinin henüz yapılmadığını/eksik
   olduğunu kontrol et.
2. Yeni bir stüdyo/kategori önerme — madde 3a/5 bunu açıkça yasaklıyor.
3. Kullanıcı stüdyo GELİŞTİRMEK isterse (madde 3b) bu tamamen meşru —
   yalnız pazarlama/ön-plan konumunu DEĞİŞTİRME.
4. Emin değilsen, önerini bu dosyanın kuzey yıldızıyla (madde 2)
   karşılaştır: "bu, 'asla ödeme yapmadan, asla limitle karşılaşmadan'
   vaadini güçlendiriyor mu, yoksa dikkat dağıtıyor mu?"

## 7. Yeniden gözden geçirme

Bu belge sabit bir dogma değil — kullanıcı gerçek kullanım verisi/geri
bildirim topladıkça (madde 4, Hamle 5) güncellenmeli. Ama güncelleme
kararı yalnız kullanıcının açık talimatıyla yapılmalı, bir AI oturumunun
kendi inisiyatifiyle değil.
