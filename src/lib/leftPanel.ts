/* "Alan" paneli — sol taraftaki tek-panel durumu (Tem 2026 kullanıcı kararı).

   Sorun: CoderView'da "Dosyalar (depo)" ve "Sunucu (workspace)" panelleri
   AYNI konumda (sol, w-64/56, z-30, absolute) render ediliyordu ama bağımsız
   boolean state'lerdi (filesOpen, wsOpen) — ikisi de teorik olarak aynı anda
   açık kalabilir, üst üste biner ve hangisinin görüneceği CSS sıralamasına
   kalırdı. Artık TEK bir kaynak-doğruluk (leftPanel) ile en fazla biri açık
   olabilir; geçiş saf bir fonksiyonla yapılır → birim testli. */

export type LeftPanel = "files" | "workspace" | null;

/** Menüden tıklanan panel zaten açıksa kapatır (tekrar tıklama = kapat),
    değilse AÇAR ve diğerini (varsa) otomatik kapatır. */
export function toggleLeftPanel(current: LeftPanel, which: "files" | "workspace"): LeftPanel {
  return current === which ? null : which;
}

/** Panel içindeki "diğerine geç" düğmesi — zaten açıksa dokunmaz (idempotent),
    kapalıysa açar. toggleLeftPanel'den farkı: hep AÇMA yönünde, kapatmaz. */
export function switchLeftPanel(which: "files" | "workspace"): LeftPanel {
  return which;
}
