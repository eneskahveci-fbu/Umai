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
  { id: "dropdown", name: "Açılır liste" },
  { id: "rating", name: "Derecelendirme (1-5)" },
  { id: "date", name: "Tarih" },
  { id: "file", name: "Dosya yükleme" },
];

/** Seçenek listesi taşıyan soru türleri (editör + normalize ortak kullanır). */
export const OPTION_QTYPES: ReadonlySet<FormQuestionType> = new Set(["choice", "multi", "dropdown"]);

/** Koşul kaynağı olabilen türler: tek-değerli seçim soruları. */
export const CONDITION_SOURCE_QTYPES: ReadonlySet<FormQuestionType> = new Set(["choice", "dropdown"]);

export const MAX_FORM_QUESTIONS = 40;

export function newQuestionId(): string {
  return `fq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newQuestion(type: FormQuestionType = "short"): FormQuestion {
  const q: FormQuestion = { id: newQuestionId(), type, label: "Yeni soru" };
  if (OPTION_QTYPES.has(type)) q.options = ["Seçenek 1", "Seçenek 2"];
  return q;
}

/* ── LLM çıktısını güvenli ankete çevirme ───────────────────────────── */

const VALID_QTYPES: FormQuestionType[] = ["short", "long", "choice", "multi", "rating", "dropdown", "date", "file"];

function normalizeQuestion(raw: unknown): (FormQuestion & { _showIfIndex?: number; _showIfEquals?: string }) | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === "string" ? r.label.trim() : "";
  if (!label) return null;
  const type = VALID_QTYPES.includes(r.type as FormQuestionType) ? (r.type as FormQuestionType) : "short";
  const q: FormQuestion & { _showIfIndex?: number; _showIfEquals?: string } = { id: newQuestionId(), type, label };
  if (OPTION_QTYPES.has(type)) {
    const opts = Array.isArray(r.options)
      ? r.options.filter((o): o is string => typeof o === "string" && !!o.trim()).map((o) => o.trim()).slice(0, 10)
      : [];
    q.options = opts.length >= 2 ? opts : ["Evet", "Hayır"];
  }
  if (r.required === true) q.required = true;
  if (r.pageBreakAfter === true) q.pageBreakAfter = true;
  /* Koşul, LLM şemasında İNDEKS ile gelir (LLM bizim üreteceğimiz id'leri
     bilemez) — normalizeForm ikinci geçişte gerçek questionId'ye çevirir. */
  const si = r.showIf as Record<string, unknown> | undefined;
  if (si && typeof si === "object" && typeof si.q === "number" && typeof si.equals === "string" && si.equals.trim()) {
    q._showIfIndex = si.q;
    q._showIfEquals = si.equals.trim();
  }
  return q;
}

export function normalizeForm(raw: unknown, fallbackTitle = "Anket"): CraftForm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const questions = (Array.isArray(r.questions) ? r.questions : [])
    .map(normalizeQuestion)
    .filter((q): q is FormQuestion & { _showIfIndex?: number; _showIfEquals?: string } => q !== null)
    .slice(0, MAX_FORM_QUESTIONS);
  if (!questions.length) return null;
  /* İkinci geçiş: indeks-tabanlı koşulları id'ye bağla. Yalnız DAHA ÖNCEKİ ve
     tek-değerli (choice/dropdown) bir soru hedefse geçerli; değilse at. */
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const idx = q._showIfIndex;
    if (idx != null && q._showIfEquals && idx >= 0 && idx < i && CONDITION_SOURCE_QTYPES.has(questions[idx].type)) {
      q.showIf = { questionId: questions[idx].id, equals: q._showIfEquals };
    }
    delete q._showIfIndex;
    delete q._showIfEquals;
  }
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
  let body: string;
  switch (q.type) {
    case "long":
      body = `${label}<textarea name="${name}" rows="4"${req}></textarea>`; break;
    case "choice":
      body = `${label}${(q.options ?? []).map((o) =>
        `<label class="opt"><input type="radio" name="${name}" value="${escapeHtml(o)}"${req}> ${escapeHtml(o)}</label>`).join("")}`; break;
    case "multi":
      body = `${label}${(q.options ?? []).map((o) =>
        `<label class="opt"><input type="checkbox" name="${name}" value="${escapeHtml(o)}"> ${escapeHtml(o)}</label>`).join("")}`; break;
    case "dropdown":
      body = `${label}<select name="${name}"${req}><option value="">Seçiniz…</option>${(q.options ?? []).map((o) =>
        `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}</select>`; break;
    case "rating":
      body = `${label}<div class="rate">${[1, 2, 3, 4, 5].map((n) =>
        `<label><input type="radio" name="${name}" value="${n}"${req}><span>${n}</span></label>`).join("")}</div>`; break;
    case "date":
      body = `${label}<input type="date" name="${name}"${req}>`; break;
    case "file":
      /* Sunucusuz mimari: dosyanın kendisi HİÇBİR YERE yüklenmez, yalnız
         seçilen dosyanın adı yanıt olarak (CSV'ye) kaydedilir — localStorage'a
         ikili içerik gömmek kota riskini + karmaşıklığı haklı çıkarmıyor. */
      body = `${label}<input type="file" name="${name}"${req}><p class="hint">Dosyanın adı kaydedilir; içeriği sunucuya/CSV'ye gönderilmez.</p>`; break;
    default:
      body = `${label}<input type="text" name="${name}"${req}>`;
  }
  /* Koşullu sorular id'li sarmalayıcı alır; görünürlüğü script yönetir. */
  return `<div class="q" id="qw${i}">${body}</div>`;
}

export interface FormExportOptions {
  /** Merkezî yanıt toplama: doldurulan her yanıt bu uca da POST edilir
      (/api/forms/respond). Yalnız form sahibi girişliyken (published_forms
      kaydı yazılabildiyse) etkinleştirilir; yoksa form saf sunucusuz kalır. */
  collect?: { url: string };
}

/** Sunucusuz, kendi kendine yeten anket HTML'i: yanıtlar tarayıcıda birikir,
    CSV indirilebilir. Ağ bağımlılığı yok — `collect` verilirse EK OLARAK
    merkezî uca gönderim denenir (başarısızlık formu etkilemez). */
export function formToHtml(form: CraftForm, exportOpts?: FormExportOptions): string {
  const storageKey = `craft_form_${form.id}`;
  const headers = form.questions.map((q) => q.label);
  const collect = exportOpts?.collect ? { url: exportOpts.collect.url, formId: form.id } : null;
  /* Koşul kuralları: hedef indeks + kaynak indeks + beklenen değer. Geçersiz
     (silinmiş kaynak, kendinden sonraki soru) kurallar dışa aktarımda elenir. */
  const logic = form.questions
    .map((q, i) => {
      if (!q.showIf) return null;
      const s = form.questions.findIndex((x) => x.id === q.showIf!.questionId);
      if (s === -1 || s >= i || !CONDITION_SOURCE_QTYPES.has(form.questions[s].type)) return null;
      return { t: i, s, eq: q.showIf.equals };
    })
    .filter((r): r is { t: number; s: number; eq: string } => r !== null);
  /* Sayfalar: pageBreakAfter işaretli sorudan sonra yeni sayfa başlar (Google
     Forms "bölüm"ünün sunucusuz karşılığı) — soruya bağlı olduğundan sıralama/
     silme sırasında ayrı bir indeks listesi bayatlamaz. İşaret hiç yoksa tek
     sayfa (eski davranışla birebir aynı). */
  const pages: number[][] = [];
  {
    let cur: number[] = [];
    form.questions.forEach((q, i) => {
      cur.push(i);
      if (q.pageBreakAfter && i < form.questions.length - 1) { pages.push(cur); cur = []; }
    });
    pages.push(cur);
  }
  const paged = pages.length > 1;
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
  input[type=text], input[type=date], textarea, select { width: 100%; border: 1px solid var(--line); border-radius: .5rem; padding: .55rem .7rem;
    font: inherit; background: #faf8f2; } input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); border-color: transparent; }
  .opt { display: flex; align-items: center; gap: .5rem; padding: .25rem 0; cursor: pointer; }
  .rate { display: flex; gap: .5rem; } .rate label { cursor: pointer; }
  .rate input { position: absolute; opacity: 0; } .rate span { display: grid; place-items: center; width: 2.4rem; height: 2.4rem;
    border: 1px solid var(--line); border-radius: .5rem; font-weight: 600; }
  .rate input:checked + span { background: var(--accent); color: #fff; border-color: var(--accent); }
  .hint { font-size: .78rem; color: var(--muted); margin: .4rem 0 0; }
  button { font: inherit; font-weight: 700; background: var(--accent); color: #fff; border: 0; border-radius: .7rem;
    padding: .7rem 1.6rem; cursor: pointer; margin-top: .6rem; }
  button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
  .foot { margin-top: 2rem; font-size: .8rem; color: var(--muted); display: flex; gap: 1rem; align-items: center; }
  .foot a { color: var(--muted); } #ok { display: none; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46;
    padding: 1rem 1.2rem; border-radius: .8rem; margin-top: 1rem; }
  .progress { height: .4rem; border-radius: 999px; background: var(--line); overflow: hidden; margin-bottom: .5rem; }
  .progress .bar { height: 100%; background: var(--accent); transition: width .25s ease; }
  .navrow { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .5rem; }
  .navrow span { font-size: .8rem; color: var(--muted); font-weight: 600; }
  .navbtns { display: flex; gap: .5rem; } .navbtns button { margin-top: 0; }
  @media (prefers-color-scheme: dark) {
    :root { --line: #33322e; --muted: #a8a396; }
    body { background: #111110; color: #f4f2ec; } .q { background: #1c1c1a; }
    input[type=text], input[type=date], textarea, select { background: #111110; color: #f4f2ec; }
    #ok { background: #10231c; border-color: #14532d; color: #a7f3d0; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(form.title)}</h1>
${form.desc ? `<p class="desc">${escapeHtml(form.desc)}</p>` : ""}
${paged ? `<div class="progress"><div class="bar" id="bar" style="width:${Math.round((100 / pages.length))}%"></div></div>
<div class="navrow"><span id="pagelabel">Sayfa 1 / ${pages.length}</span></div>` : ""}
<form id="f">
${pages.map((idxs, pi) => `<div class="page" id="page${pi}">${idxs.map((i) => questionHtml(form.questions[i], i)).join("\n")}</div>`).join("\n")}
${paged ? `<div class="navbtns">
  <button type="button" class="ghost" id="prevBtn" style="display:none">Geri</button>
  <button type="button" id="nextBtn">İleri</button>
  <button type="submit" id="submitBtn" style="display:none">Gönder</button>
</div>` : `<button type="submit">Gönder</button>`}
</form>
<div id="ok">Yanıtın kaydedildi — teşekkürler! Bu cihazdaki tüm yanıtlar aşağıdan CSV olarak indirilebilir.</div>
<div class="foot">
  <span id="cnt"></span>
  <a href="#" id="csv">Yanıtları CSV indir</a>
  <span>${collect
    ? "· craft anketi — yanıtın form sahibine iletilir (bu cihazda da saklanır)"
    : "· craft anketi — sunucusuz, yanıtlar bu cihazda saklanır"}</span>
</div>
<script>
(function () {
  var KEY = ${JSON.stringify(storageKey)};
  var HEADERS = ${JSON.stringify(headers)};
  /* Yanıt satırı HER ZAMAN yayınlanma anındaki soru sırasına göre pozisyonel
     (row[0]=ilk soru...) — form sahibi YAYINDAN SONRA soru ekler/siler/
     sıralarsa, mevcut form.questions'ın GÜNCEL sırası artık bu satırla
     UYUŞMAZ (bkz. formAnalytics.ts answerAt). Bu kaymayı tespit edip doğru
     eşleştirebilmek için o anki soru id'lerini de AYNI SIRADA gönderiyoruz. */
  var QUESTION_IDS = ${JSON.stringify(form.questions.map((q) => q.id))};
  var LOGIC = ${JSON.stringify(logic)};
  var PAGES = ${JSON.stringify(pages)};
  var COLLECT = ${JSON.stringify(collect)};
  var form = document.getElementById("f");
  var page = 0;
  function all() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function refresh() { var n = all().length; document.getElementById("cnt").textContent = n + " yanıt"; }
  /* Koşullu görünürlük: kaynak sorunun değeri beklenene eşitse hedef görünür;
     gizliyken girdiler disabled olur (required engellemez, yanıt CSV'ye girmez). */
  function srcValue(i) {
    var checked = form.querySelector('input[name="q' + i + '"]:checked');
    if (checked) return checked.value;
    var sel = form.querySelector('select[name="q' + i + '"]');
    return sel ? sel.value : "";
  }
  function pageOf(i) {
    for (var p = 0; p < PAGES.length; p++) if (PAGES[p].indexOf(i) !== -1) return p;
    return 0;
  }
  function logicOk(i) {
    var rule = LOGIC.filter(function (r) { return r.t === i; })[0];
    return !rule || srcValue(rule.s) === rule.eq;
  }
  /* Görünürlüğün TEK kaynağı: sayfa gezinmesi (değer korunur, sadece
     disabled/gizli) + koşullu mantık (mantık başarısızsa değer SIFIRLANIR —
     eski davranışla aynı). İkisi ayrı sebeplerle disabled olsa da nihai
     görünürlük her zaman bu fonksiyondan hesaplanır. */
  function refreshVisibility() {
    for (var i = 0; i < HEADERS.length; i++) {
      var wrap = document.getElementById("qw" + i);
      if (!wrap) continue;
      var onPage = pageOf(i) === page;
      var passes = logicOk(i);
      wrap.style.display = onPage ? (passes ? "" : "none") : "none";
      wrap.querySelectorAll("input, textarea, select").forEach(function (el) {
        el.disabled = !(onPage && passes);
        if (!passes) { if (el.type === "radio" || el.type === "checkbox") el.checked = false; else el.value = ""; }
      });
    }
  }
  function updatePageUi() {
    var bar = document.getElementById("bar");
    if (bar) bar.style.width = Math.round(((page + 1) / PAGES.length) * 100) + "%";
    var label = document.getElementById("pagelabel");
    if (label) label.textContent = "Sayfa " + (page + 1) + " / " + PAGES.length;
    var prev = document.getElementById("prevBtn");
    var next = document.getElementById("nextBtn");
    var submitBtn = document.getElementById("submitBtn");
    if (prev) prev.style.display = page === 0 ? "none" : "";
    if (next) next.style.display = page === PAGES.length - 1 ? "none" : "";
    if (submitBtn) submitBtn.style.display = page === PAGES.length - 1 ? "" : "none";
  }
  if (LOGIC.length || PAGES.length > 1) { form.addEventListener("change", refreshVisibility); refreshVisibility(); }
  if (PAGES.length > 1) {
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    nextBtn.addEventListener("click", function () {
      var cur = document.getElementById("page" + page);
      var invalid = cur.querySelector(":invalid:not(:disabled)");
      if (invalid) { invalid.reportValidity(); return; }
      if (page < PAGES.length - 1) { page++; refreshVisibility(); updatePageUi(); window.scrollTo(0, 0); }
    });
    prevBtn.addEventListener("click", function () {
      if (page > 0) { page--; refreshVisibility(); updatePageUi(); window.scrollTo(0, 0); }
    });
    updatePageUi();
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var row = [];
    for (var i = 0; i < HEADERS.length; i++) {
      var els = form.querySelectorAll('[name="q' + i + '"]');
      var vals = [];
      els.forEach(function (el) {
        if (el.disabled) return;
        if (el.type === "file") { if (el.files && el.files[0]) vals.push(el.files[0].name); return; }
        if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
        if (el.value) vals.push(el.value);
      });
      row.push(vals.join(" | "));
    }
    var rows = all(); rows.push({ t: new Date().toISOString(), a: row });
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (err) {}
    /* Merkezî toplama (opsiyonel): başarısızlık sessizdir — form sunucusuz da
       tam çalışır. Sandbox iframe/file:// origin'i "null" olduğundan uç CORS
       açık; kimlik bilgisi taşınmaz. */
    if (COLLECT) {
      try {
        fetch(COLLECT.url, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formId: COLLECT.formId, answers: row, questionIds: QUESTION_IDS }) }).catch(function () {});
      } catch (err) {}
    }
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
  '{"title": "anket başlığı", "desc": "kısa açıklama", "questions": [{"type": "short|long|choice|multi|dropdown|rating|date", ' +
  '"label": "soru metni", "options": ["choice/multi/dropdown için 2-6 seçenek"], "required": true|false, ' +
  '"showIf": {"q": 0, "equals": "Evet"}}]}\n' +
  'showIf OPSİYONELDİR: soru yalnız, DAHA ÖNCEKİ bir choice/dropdown sorusu (0-tabanlı indeks "q") ' +
  '"equals" değerini aldığında görünür — takip soruları için kullan.';

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
