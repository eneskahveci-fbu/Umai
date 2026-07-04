/* Anket Stüdyosu çekirdeği — Google Forms'tan İLHAM alan (klonu değil) craft
   yorumu: anket = yapılandırılmış soru listesi. LLM soru JSON'u üretir; craft
   düzenler, canlı önizler ve BAĞIMSIZ HTML form olarak dışa aktarır. Dışa
   aktarılan form sunucusuz çalışır: yanıtlar dolduranın tarayıcısında
   (localStorage) birikir, formun altından CSV olarak indirilebilir —
   kiosk / sınıf / atölye senaryoları için sıfır maliyet. */
import type { CraftForm, FormQuestion, FormQuestionType } from "./types";
import { escapeHtml } from "./slides";
import { streamChat, extractJsonObject } from "./genChat";

export const FORM_QUESTION_TYPES: { id: FormQuestionType; name: string }[] = [
  { id: "short", name: "Kısa yanıt" },
  { id: "long", name: "Uzun yanıt" },
  { id: "choice", name: "Çoktan seçmeli" },
  { id: "multi", name: "Çoklu seçim" },
  { id: "rating", name: "Derecelendirme (1-5)" },
];

export const MAX_FORM_QUESTIONS = 40;

export function newQuestionId(): string {
  return `fq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newQuestion(type: FormQuestionType = "short"): FormQuestion {
  const q: FormQuestion = { id: newQuestionId(), type, label: "Yeni soru" };
  if (type === "choice" || type === "multi") q.options = ["Seçenek 1", "Seçenek 2"];
  return q;
}

/* ── LLM çıktısını güvenli ankete çevirme ───────────────────────────── */

const VALID_QTYPES: FormQuestionType[] = ["short", "long", "choice", "multi", "rating"];

function normalizeQuestion(raw: unknown): FormQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === "string" ? r.label.trim() : "";
  if (!label) return null;
  const type = VALID_QTYPES.includes(r.type as FormQuestionType) ? (r.type as FormQuestionType) : "short";
  const q: FormQuestion = { id: newQuestionId(), type, label };
  if (type === "choice" || type === "multi") {
    const opts = Array.isArray(r.options)
      ? r.options.filter((o): o is string => typeof o === "string" && !!o.trim()).map((o) => o.trim()).slice(0, 10)
      : [];
    q.options = opts.length >= 2 ? opts : ["Evet", "Hayır"];
  }
  if (r.required === true) q.required = true;
  return q;
}

export function normalizeForm(raw: unknown, fallbackTitle = "Anket"): CraftForm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const questions = (Array.isArray(r.questions) ? r.questions : [])
    .map(normalizeQuestion)
    .filter((q): q is FormQuestion => q !== null)
    .slice(0, MAX_FORM_QUESTIONS);
  if (!questions.length) return null;
  const now = Date.now();
  return {
    id: `form_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: (typeof r.title === "string" && r.title.trim()) ? r.title.trim() : fallbackTitle,
    desc: (typeof r.desc === "string" && r.desc.trim()) ? r.desc.trim() : undefined,
    questions,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseFormJson(text: string, fallbackTitle = "Anket"): CraftForm {
  let raw: unknown;
  try { raw = JSON.parse(extractJsonObject(text)); } catch { throw new Error("Anket JSON'u bozuk — tekrar dene."); }
  const form = normalizeForm(raw, fallbackTitle);
  if (!form) throw new Error("Ankette kullanılabilir soru yok — brief'i netleştir.");
  return form;
}

/* ── Bağımsız HTML dışa aktarma ─────────────────────────────────────── */

function questionHtml(q: FormQuestion, i: number): string {
  const name = `q${i}`;
  const req = q.required ? " required" : "";
  const label = `<label class="ql">${i + 1}. ${escapeHtml(q.label)}${q.required ? ' <em title="Zorunlu">*</em>' : ""}</label>`;
  switch (q.type) {
    case "long":
      return `<div class="q">${label}<textarea name="${name}" rows="4"${req}></textarea></div>`;
    case "choice":
      return `<div class="q">${label}${(q.options ?? []).map((o) =>
        `<label class="opt"><input type="radio" name="${name}" value="${escapeHtml(o)}"${req}> ${escapeHtml(o)}</label>`).join("")}</div>`;
    case "multi":
      return `<div class="q">${label}${(q.options ?? []).map((o) =>
        `<label class="opt"><input type="checkbox" name="${name}" value="${escapeHtml(o)}"> ${escapeHtml(o)}</label>`).join("")}</div>`;
    case "rating":
      return `<div class="q">${label}<div class="rate">${[1, 2, 3, 4, 5].map((n) =>
        `<label><input type="radio" name="${name}" value="${n}"${req}><span>${n}</span></label>`).join("")}</div></div>`;
    default:
      return `<div class="q">${label}<input type="text" name="${name}"${req}></div>`;
  }
}

/** Sunucusuz, kendi kendine yeten anket HTML'i: yanıtlar tarayıcıda birikir,
    CSV indirilebilir. Ağ bağımlılığı yok. */
export function formToHtml(form: CraftForm): string {
  const storageKey = `craft_form_${form.id}`;
  const headers = form.questions.map((q) => q.label);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(form.title)}</title>
<style>
  :root { --accent: #b45309; --line: #e2ddd0; --muted: #6b675e; }
  * { box-sizing: border-box; }
  body { max-width: 42rem; margin: 2.5rem auto; padding: 0 1.25rem 4rem; color: #1f1e1b; background: #faf8f2;
         font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
  h1 { font-size: 1.7rem; letter-spacing: -0.02em; }
  h1::after { content: ""; display: block; width: 3rem; height: 3px; background: var(--accent); margin-top: .5rem; border-radius: 2px; }
  .desc { color: var(--muted); margin-bottom: 1.6rem; }
  .q { background: #fff; border: 1px solid var(--line); border-radius: .8rem; padding: 1rem 1.2rem; margin: .9rem 0; }
  .ql { display: block; font-weight: 600; margin-bottom: .6rem; } .ql em { color: var(--accent); font-style: normal; }
  input[type=text], textarea { width: 100%; border: 1px solid var(--line); border-radius: .5rem; padding: .55rem .7rem;
    font: inherit; background: #faf8f2; } input:focus, textarea:focus { outline: 2px solid var(--accent); border-color: transparent; }
  .opt { display: flex; align-items: center; gap: .5rem; padding: .25rem 0; cursor: pointer; }
  .rate { display: flex; gap: .5rem; } .rate label { cursor: pointer; }
  .rate input { position: absolute; opacity: 0; } .rate span { display: grid; place-items: center; width: 2.4rem; height: 2.4rem;
    border: 1px solid var(--line); border-radius: .5rem; font-weight: 600; }
  .rate input:checked + span { background: var(--accent); color: #fff; border-color: var(--accent); }
  button { font: inherit; font-weight: 700; background: var(--accent); color: #fff; border: 0; border-radius: .7rem;
    padding: .7rem 1.6rem; cursor: pointer; margin-top: .6rem; }
  .foot { margin-top: 2rem; font-size: .8rem; color: var(--muted); display: flex; gap: 1rem; align-items: center; }
  .foot a { color: var(--muted); } #ok { display: none; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46;
    padding: 1rem 1.2rem; border-radius: .8rem; margin-top: 1rem; }
  @media (prefers-color-scheme: dark) {
    :root { --line: #33322e; --muted: #a8a396; }
    body { background: #111110; color: #f4f2ec; } .q { background: #1c1c1a; }
    input[type=text], textarea { background: #111110; color: #f4f2ec; }
    #ok { background: #10231c; border-color: #14532d; color: #a7f3d0; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(form.title)}</h1>
${form.desc ? `<p class="desc">${escapeHtml(form.desc)}</p>` : ""}
<form id="f">
${form.questions.map(questionHtml).join("\n")}
<button type="submit">Gönder</button>
</form>
<div id="ok">Yanıtın kaydedildi — teşekkürler! Bu cihazdaki tüm yanıtlar aşağıdan CSV olarak indirilebilir.</div>
<div class="foot">
  <span id="cnt"></span>
  <a href="#" id="csv">Yanıtları CSV indir</a>
  <span>· craft anketi — sunucusuz, yanıtlar bu cihazda saklanır</span>
</div>
<script>
(function () {
  var KEY = ${JSON.stringify(storageKey)};
  var HEADERS = ${JSON.stringify(headers)};
  var form = document.getElementById("f");
  function all() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function refresh() { var n = all().length; document.getElementById("cnt").textContent = n + " yanıt"; }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var row = [];
    for (var i = 0; i < HEADERS.length; i++) {
      var els = form.querySelectorAll('[name="q' + i + '"]');
      var vals = [];
      els.forEach(function (el) {
        if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
        if (el.value) vals.push(el.value);
      });
      row.push(vals.join(" | "));
    }
    var rows = all(); rows.push({ t: new Date().toISOString(), a: row });
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (err) {}
    form.reset(); form.style.display = "none";
    document.getElementById("ok").style.display = "block";
    refresh();
  });
  document.getElementById("csv").addEventListener("click", function (e) {
    e.preventDefault();
    var esc = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var lines = [["Zaman"].concat(HEADERS).map(esc).join(",")];
    all().forEach(function (r) { lines.push([r.t].concat(r.a).map(esc).join(",")); });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\\uFEFF" + lines.join("\\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "anket-yanitlari.csv"; a.click();
  });
  refresh();
})();
</script>
</body>
</html>`;
}

/* ── Üretim ─────────────────────────────────────────────────────────── */

const FORM_SCHEMA =
  '{"title": "anket başlığı", "desc": "kısa açıklama", "questions": [{"type": "short|long|choice|multi|rating", ' +
  '"label": "soru metni", "options": ["choice/multi için 2-6 seçenek"], "required": true|false}]}';

export interface FormGenOptions {
  brief: string;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export async function generateForm(opts: FormGenOptions): Promise<CraftForm> {
  const sys =
    "Sen deneyimli bir araştırmacı ve anket tasarımcısısın. Kullanıcının brief'inden TÜRKÇE, " +
    "tarafsız ve net bir anket üret. SADECE geçerli JSON döndür (istersen tek ```json bloğu). Şema:\n" +
    FORM_SCHEMA + "\n" +
    "Kurallar: 5-12 soru; yönlendirici/çift-namlulu soru yazma; soru türlerini ÇEŞİTLENDİR " +
    "(kapalı uçlular önce, açık uçlular sonda); memnuniyet/olasılık ölçümünde rating kullan; " +
    "yalnızca gerçekten kritik soruları required yap.";
  const full = await streamChat({ system: sys, messages: [{ role: "user", content: opts.brief }], onDelta: opts.onDelta, signal: opts.signal, temperature: 0.6 });
  const form = parseFormJson(full, opts.brief.slice(0, 48));
  form.brief = opts.brief;
  return form;
}
