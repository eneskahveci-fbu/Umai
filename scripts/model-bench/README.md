# Model test tezgâhı

10 gerçek iş × modeller. Her işin **otomatik doğrulayıcısı** var (insan yorumu yok);
başarısız olursa modele hata listesi geri verilir (en fazla `--repairs` onarım turu).

| # | İş | Nasıl doğrulanır |
|---|---|---|
| 1 | Tam uygulama (görev takipçisi) | Headless Chromium'da gerçek tıklama/yazma, localStorage, XSS, konsol hatası |
| 2 | Eski kodu modernleştir | 12 davranış testi (eski "tuhaflıklar" dahil) |
| 3 | Hata ayıkla | 15 test (log'daki bug + gizli kenar durumlar) |
| 4 | Test paketi yaz | Doğru kodda geçmeli, 6 hatalı sürümün ≥5'ini yakalamalı (mutasyon) |
| 5 | Uzun belge özeti | Yerleştirilmiş gerçekler + belgede olmayan soruya "belirtilmemiş" + özette uydurma sayı yok |
| 6 | Sözleşme incelemesi | 5 riskli madde bulunmalı, gereksiz alarm sınırlı (recall/precision) |
| 7 | İş planı | Başlıklar + 12 aylık tablo hesabı + başa baş ayı |
| 8 | Veriden dashboard | Toplam/en iyi bölge doğru mu, grafik var mı, tablo satırları, konsol hatası |
| 9 | Çok adımlı ajan | Araç döngüsüyle çok dosyalı hata düzeltme, `test.js` değişmeden testler geçmeli |
| 10 | Türkçe çeviri | Sözlük terimleri, `kod`/{yer_tutucu}/sayı korunması, İngilizce artık yok |

```bash
node scripts/model-bench/run.mjs --selftest                        # doğrulayıcıları sına (model gerekmez)
node scripts/model-bench/run.mjs --models models.json              # i. iş → i. model
node scripts/model-bench/run.mjs --models models.json --matrix     # her iş × her model
```

`models.json` biçimi için `models.example.json`. Anahtarlar `apiKeyEnv` ile ortam
değişkeninden okunur; dosyaya/rapora/depoya yazılmaz. Çıktı: `bench-results/RAPOR.md`,
`results.json`, `answers/` (ham cevaplar).
