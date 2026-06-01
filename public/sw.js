/* KILL-SWITCH SERVICE WORKER
   Önceki sürüm gezinme HTML'ini önbelleğe alıp her yenilemede BAYAT (eski)
   uygulama paketini sunuyordu; bu yüzden yeni özellikler (skill dosyaları,
   model değişiklikleri, iOS düzeltmeleri) canlıda görünmüyordu.

   Bu service worker hiçbir şeyi önbelleğe almaz. Aktifleştiğinde tüm eski
   cache'leri siler, kendini kayıttan düşürür ve açık sekmeleri yeniler.
   Böylece sayfa bir daha SW tarafından kontrol edilmez; her zaman ağdan
   taze yüklenir. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch { /* yok say */ }
      try {
        await self.registration.unregister();
      } catch { /* yok say */ }
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          /* Açık sekmeleri taze paketle yeniden yükle */
          client.navigate(client.url);
        }
      } catch { /* yok say */ }
    })(),
  );
});

/* Hiçbir isteği yakalama — her şey doğrudan ağdan gitsin (önbellek yok). */
self.addEventListener("fetch", () => {});
