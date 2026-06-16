/* Jupyter Notebook (.ipynb) okuma/düzenleme yardımcıları.
 * Saf (tarayıcı API'si yok) — hem sunucuda (read_file tool) hem istemcide kullanılır. */

interface NotebookCell {
  cell_type: string;
  source: string | string[];
  outputs?: NotebookOutput[];
  execution_count?: number | null;
}
interface NotebookOutput {
  output_type: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
}
interface Notebook {
  cells?: NotebookCell[];
  metadata?: { kernelspec?: { language?: string; name?: string } };
}

function joinSource(src: string | string[] | undefined): string {
  if (Array.isArray(src)) return src.join("");
  return src ?? "";
}

function renderOutput(o: NotebookOutput): string {
  if (o.output_type === "stream") return joinSource(o.text);
  if (o.output_type === "error") return `${o.ename ?? "Error"}: ${o.evalue ?? ""}`;
  if (o.data) {
    const txt = o.data["text/plain"];
    if (txt) return joinSource(txt);
    if (o.data["image/png"] || o.data["image/jpeg"]) return "[görsel çıktı]";
    if (o.data["text/html"]) return "[HTML çıktı]";
  }
  return "";
}

/** .ipynb JSON metnini, LLM'in rahat okuyabileceği hücre-bazlı metne çevirir. */
export function ipynbToReadable(jsonText: string): string {
  let nb: Notebook;
  try { nb = JSON.parse(jsonText) as Notebook; }
  catch { return "Hata: geçersiz .ipynb (JSON ayrıştırılamadı)"; }
  const cells = nb.cells ?? [];
  const lang = nb.metadata?.kernelspec?.language || nb.metadata?.kernelspec?.name || "python";
  const parts: string[] = [`# Jupyter Notebook — ${cells.length} hücre (çekirdek: ${lang})`];
  cells.forEach((cell, i) => {
    const src = joinSource(cell.source).replace(/\n$/, "");
    if (cell.cell_type === "markdown") {
      parts.push(`## [Hücre ${i}] markdown\n${src}`);
    } else if (cell.cell_type === "code") {
      let block = `## [Hücre ${i}] kod\n\`\`\`${lang}\n${src}\n\`\`\``;
      const outs = (cell.outputs ?? []).map(renderOutput).filter(Boolean).join("\n").slice(0, 2000);
      if (outs) block += `\nÇıktı:\n\`\`\`\n${outs}\n\`\`\``;
      parts.push(block);
    } else {
      parts.push(`## [Hücre ${i}] ${cell.cell_type}\n${src}`);
    }
  });
  return parts.join("\n\n");
}

/** Belirli bir hücrenin kaynağını değiştirir, güncellenmiş .ipynb JSON'unu döndürür.
 *  Hücre-bazlı düzenleme için; biçimi (indent) korur. */
export function setCellSource(jsonText: string, cellIndex: number, newSource: string): string {
  const nb = JSON.parse(jsonText) as Notebook;
  if (!nb.cells || cellIndex < 0 || cellIndex >= nb.cells.length) {
    throw new Error(`Geçersiz hücre indeksi: ${cellIndex}`);
  }
  /* Kaynağı satır-dizisi formatında sakla (Jupyter konvansiyonu): son satır hariç
     her satır '\n' ile biter. */
  const lines = newSource.split("\n");
  nb.cells[cellIndex].source = lines.map((l, i) => (i < lines.length - 1 ? l + "\n" : l));
  if (nb.cells[cellIndex].cell_type === "code") nb.cells[cellIndex].outputs = [];
  return JSON.stringify(nb, null, 1);
}

export function isNotebook(path: string): boolean {
  return path.toLowerCase().endsWith(".ipynb");
}
