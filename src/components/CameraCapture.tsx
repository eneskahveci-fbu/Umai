"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

/* Masaüstünde (mobilde zaten native kamera input'u kullanılır, bkz.
   CoderView.tsx'teki `capture="environment"` girişi) canlı getUserMedia
   önizlemesi + tek kare yakalama. Sekme kapanınca/unmount olunca kamera
   izini bırakmak için tüm track'ler durdurulur. */
export function CameraCaptureModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Kameraya erişilemedi — izin verildiğinden ve bir kamera bağlı olduğundan emin ol.");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `kamera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-sm grid place-items-center p-4 animate-modal-bg" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-line bg-surface overflow-hidden shadow-2xl animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Camera size={15} className="text-brand" />
          <span className="text-sm font-semibold flex-1">Fotoğraf çek</span>
          <button onClick={onClose} aria-label="Kapat" className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="relative aspect-video bg-black grid place-items-center">
          {error ? (
            <p className="text-xs text-muted text-center px-6">{error}</p>
          ) : !ready ? (
            <Loader2 size={20} className="text-muted/60 animate-spin" />
          ) : null}
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${ready ? "" : "hidden"}`} />
        </div>
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-line">
          <button
            onClick={capture}
            disabled={!ready}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm hover:bg-branddim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Camera size={14} /> Çek
          </button>
        </div>
      </div>
    </div>
  );
}
