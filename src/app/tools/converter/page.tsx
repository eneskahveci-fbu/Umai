"use client";

import { ArrowLeft, Download, FileImage, FileUp, Image as ImageIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Output = "pdf" | "png" | "jpeg" | "webp";

export default function ConverterPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [output, setOutput] = useState<Output>("pdf");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const source = sessionStorage.getItem("umai_converter_source");
      if (!source) return;
      sessionStorage.removeItem("umai_converter_source");
      void fetch(source).then((r) => r.blob()).then((blob) => setFiles([new File([blob], "umai-image.jpg", { type: blob.type || "image/jpeg" })])).catch(() => setNotice("Görsel alınamadı. Dosyayı buradan seçebilirsin."));
    } catch { /* yok say */ }
  }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = [...list].filter((file) => file.type.startsWith("image/"));
    setFiles((current) => [...current, ...accepted].slice(0, 20));
    if (accepted.length !== list.length) setNotice("Yalnız görsel dosyaları eklendi.");
  };

  const convert = async () => {
    if (!files.length || busy) return;
    setBusy(true); setNotice("");
    try {
      if (output === "pdf") {
        const jpegPages = await Promise.all(files.map(toJpegPage));
        downloadBlob(buildPdf(jpegPages), "umai-images.pdf");
        const unchanged = files.every((file) => file.type === "image/jpeg");
        setNotice(unchanged ? "PDF hazır. JPEG dosyaları yeniden sıkıştırılmadan gömüldü." : "PDF hazır. JPEG olmayan dosyalar beyaz zeminle JPEG'e dönüştürüldü.");
      } else {
        const converted = await convertImage(files[0], output);
        downloadBlob(converted, `${baseName(files[0].name)}.${output === "jpeg" ? "jpg" : output}`);
        setNotice("Dönüştürme tamamlandı.");
      }
    } catch (error) {
      /* Tarayıcının ham İngilizce decode hatası yerine anlaşılır Türkçe mesaj. */
      const msg = error instanceof Error ? error.message : "";
      setNotice(/decod|encod|source image/i.test(msg)
        ? "Görsel çözülemedi — dosya bozuk veya desteklenmeyen bir biçimde olabilir."
        : msg || "Dönüştürme tamamlanamadı.");
    } finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-bg text-ink"><header className="h-14 border-b border-line flex items-center px-4 sm:px-6"><button onClick={() => router.push("/library")} className="w-10 h-10 grid place-items-center rounded-lg text-muted hover:bg-bgsoft hover:text-ink" aria-label="Kütüphaneye dön"><ArrowLeft size={17} /></button><div><h1 className="text-sm font-semibold">Dönüştürücü</h1><p className="text-[11px] text-muted">Görselleri yerelde dönüştür</p></div></header><div className="max-w-3xl mx-auto px-4 py-8 sm:py-12"><div className="border border-line bg-surface rounded-lg p-5 sm:p-6"><div className="flex items-start gap-3"><div className="w-10 h-10 grid place-items-center rounded-lg bg-brand/10 text-brand"><FileImage size={19} /></div><div><h2 className="text-base font-semibold">Görsel dönüştür</h2><p className="text-xs text-muted mt-1">Image → PDF, PNG, JPG veya WebP. Dosyalar tarayıcından çıkmaz.</p></div></div><label className="mt-6 min-h-32 border border-dashed border-line rounded-lg grid place-items-center cursor-pointer hover:border-brand/60 hover:bg-bgsoft/40 transition-colors"><span className="text-center text-sm text-muted"><FileUp size={20} className="mx-auto mb-2" />Görselleri seç veya buraya bırak<br /><small>PNG, JPG, WebP · en fazla 20 dosya</small></span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => addFiles(e.target.files)} /></label>{files.length > 0 && <div className="mt-4 space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 p-2 rounded-lg bg-bgsoft text-xs"><ImageIcon size={14} className="text-muted" /><span className="truncate flex-1">{file.name}</span><span className="text-muted">{formatBytes(file.size)}</span><button onClick={() => setFiles((items) => items.filter((_, i) => i !== index))} className="p-1 text-muted hover:text-red" aria-label={`${file.name} dosyasını kaldır`}><Trash2 size={14} /></button></div>)}</div>}<div className="mt-6"><p className="text-xs font-semibold mb-2">Çıktı biçimi</p><div className="flex flex-wrap gap-2">{(["pdf", "png", "jpeg", "webp"] as Output[]).map((item) => <button key={item} onClick={() => setOutput(item)} className={`px-3 py-2 rounded-lg border text-xs font-semibold uppercase ${output === item ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>{item === "jpeg" ? "JPG" : item}</button>)}</div>{output === "pdf" && <p className="text-[11px] text-muted mt-3">JPEG dosyaları PDF’ye özgün baytlarıyla gömülür. PNG/WebP, PDF uyumluluğu için beyaz zeminli JPEG’e dönüştürülür.</p>}{output !== "pdf" && files.length > 1 && <p className="text-[11px] text-muted mt-3">Biçim dönüşümünde ilk dosya kullanılır.</p>}</div><button disabled={!files.length || busy} onClick={convert} className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-bg text-sm font-semibold disabled:opacity-40 hover:bg-branddim"><Download size={16} />{busy ? "Hazırlanıyor…" : output === "pdf" ? "PDF indir" : "Dönüştür ve indir"}</button>{notice && <p className="mt-4 text-xs text-muted" role="status">{notice}</p>}</div></div></main>;
}

async function toJpegPage(file: File): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (file.type === "image/jpeg") { const bytes = new Uint8Array(await file.arrayBuffer()); const size = jpegSize(bytes); return { bytes, ...size }; }
  const jpeg = await convertImage(file, "jpeg"); const bytes = new Uint8Array(await jpeg.arrayBuffer()); return { bytes, ...jpegSize(bytes) };
}
async function convertImage(file: File, type: Exclude<Output, "pdf">): Promise<Blob> {
  const bitmap = await createImageBitmap(file); const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Tarayıcı görsel dönüştürmeyi desteklemiyor.");
  if (type === "jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bitmap, 0, 0); bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Görsel dönüştürülemedi.")), `image/${type}`, type === "jpeg" ? 0.96 : undefined));
}
function jpegSize(bytes: Uint8Array): { width: number; height: number } { for (let i = 2; i < bytes.length - 9; i++) { if (bytes[i] !== 0xff || bytes[i + 1] < 0xc0 || bytes[i + 1] > 0xc3) continue; return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] }; } throw new Error("JPEG boyutu okunamadı."); }
function buildPdf(pages: { bytes: Uint8Array; width: number; height: number }[]): Blob { const enc = new TextEncoder(); const chunks: Uint8Array[] = []; const offsets: number[] = [0]; let length = 0; const push = (value: string | Uint8Array) => { const data = typeof value === "string" ? enc.encode(value) : value; chunks.push(data); length += data.length; }; const obj = (id: number, body: string | Uint8Array) => { offsets[id] = length; push(`${id} 0 obj\n`); push(body); push("\nendobj\n"); }; push("%PDF-1.4\n%"); push(new Uint8Array([0xff, 0xff, 0xff, 0xff])); push("\n"); const pageIds = pages.map((_, index) => 3 + index * 3); obj(1, "<< /Type /Catalog /Pages 2 0 R >>"); obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`); pages.forEach((page, index) => { const pageId = pageIds[index], imageId = pageId + 1, contentId = pageId + 2; const w = Math.max(1, Math.round(page.width * 0.75)), h = Math.max(1, Math.round(page.height * 0.75)); obj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`); const header = enc.encode(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`); const footer = enc.encode("\nendstream"); obj(imageId, concat([header, page.bytes, footer])); const commands = `q\n${w} 0 0 ${h} 0 0 cm\n/Im1 Do\nQ\n`; obj(contentId, `<< /Length ${enc.encode(commands).length} >>\nstream\n${commands}endstream`); }); const start = length; push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`); for (let i = 1; i < offsets.length; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`); push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`); const output = concat(chunks); return new Blob([output.buffer as ArrayBuffer], { type: "application/pdf" }); }
function concat(chunks: Uint8Array[]) { const out = new Uint8Array(chunks.reduce((total, item) => total + item.length, 0)); let offset = 0; for (const item of chunks) { out.set(item, offset); offset += item.length; } return out; }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
function baseName(name: string) { return name.replace(/\.[^/.]+$/, "") || "umai-image"; }
function formatBytes(bytes: number) { return bytes < 1_000_000 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`; }
