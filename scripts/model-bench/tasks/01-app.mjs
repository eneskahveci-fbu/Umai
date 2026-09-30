import { extractCode, withPage, result } from "../lib.mjs";

export const id = "app";
export const title = "Tam uygulama yaz (görev takipçisi)";
export const category = "Kod";

export const prompt = `Tek dosyalık (CSS ve JS gömülü, HARİCİ kütüphane/CDN/font YOK) bir görev takipçisi web uygulaması yaz. Cevabında yalnız tek bir \`\`\`html kod bloğu olsun.

Zorunlu yapı (otomatik test bu seçicilerle çalışır, birebir uy):
- Yazı kutusu: input#new-task ; ekle düğmesi: button#add-btn. Enter tuşu da görev eklesin. Boş/boşluk görev eklenmesin.
- Görev listesi: ul#task-list; her görev bir li. li içinde: input.toggle (checkbox), span.title (görev metni), button.delete.
- Sayaç: #counter — içinde kalan (tamamlanmamış) görev sayısı rakamla yazsın, örn. "2 kalan".
- Filtre düğmeleri: button[data-filter="all"], button[data-filter="active"], button[data-filter="done"]. Seçili filtreye uymayan görevler DOM'da görünmesin (li'ler kaldırılsın ya da display:none olsun; sayaç her zaman toplam kalan sayıyı göstersin).
- Görevler localStorage'da "tasks" anahtarıyla saklansın; sayfa yenilenince geri gelsin.
- Görev metnini HTML olarak yorumlama (XSS olmasın; textContent kullan).
- Konsolda hata olmasın. Şık ve okunaklı görünsün.`;

export async function check(answer) {
  const html = extractCode(answer, ["html"]);
  const notes = [];
  if (!/<html|<!doctype/i.test(html)) return result(false, 0, ["Geçerli bir HTML belgesi yok"]);
  let ok = 0, total = 0;
  const t = (cond, msg) => { total++; if (cond) ok++; else notes.push(msg); };
  try {
    await withPage(html, async (page, errors, url) => {
      const add = async (txt) => { await page.fill("#new-task", txt); await page.click("#add-btn"); };
      await add("Süt al"); await add("Rapor yaz"); await add("<b>x</b>");
      t((await page.locator("#task-list li").count()) === 3, "3 görev eklenince 3 li olmalı");
      t((await page.locator("#counter").innerText()).includes("3"), "Sayaç 3 göstermeli");
      t((await page.locator("#task-list li b").count()) === 0, "HTML enjekte edilebiliyor (textContent kullanılmalı)");
      await page.fill("#new-task", "   "); await page.click("#add-btn");
      t((await page.locator("#task-list li").count()) === 3, "Boş görev eklenmemeli");
      await page.fill("#new-task", "Enter ile"); await page.press("#new-task", "Enter");
      t((await page.locator("#task-list li").count()) === 4, "Enter tuşu görev eklemeli");
      await page.locator("#task-list li input.toggle").first().check();
      t((await page.locator("#counter").innerText()).includes("3"), "1 görev tamamlanınca sayaç 3 (4-1) olmalı");
      await page.click('button[data-filter="done"]');
      t((await page.locator("#task-list li:visible").count()) === 1, "'done' filtresi 1 görev göstermeli");
      await page.click('button[data-filter="active"]');
      t((await page.locator("#task-list li:visible").count()) === 3, "'active' filtresi 3 görev göstermeli");
      await page.click('button[data-filter="all"]');
      await page.locator("#task-list li button.delete").first().click();
      t((await page.locator("#task-list li:visible").count()) === 3, "Silince 3 görev kalmalı");
      const stored = await page.evaluate(() => localStorage.getItem("tasks"));
      t(!!stored && stored.includes("Rapor yaz"), "localStorage 'tasks' anahtarında görevler olmalı");
      await page.goto(url);
      t((await page.locator("#task-list li:visible").count()) === 3, "Yenilenince görevler geri gelmeli");
      t(errors.length === 0, `Konsol/ağ hatası: ${errors.slice(0, 2).join(" | ")}`);
    });
  } catch (e) {
    return result(false, ok / Math.max(total, 1), [...notes, `Test çalışırken hata (seçici eksik olabilir): ${e.message.split("\n")[0]}`]);
  }
  return result(ok === total, ok / total, notes);
}

const REF = `<!doctype html><html><head><meta charset="utf-8"><title>Görevler</title><style>body{font-family:sans-serif;max-width:480px;margin:2rem auto}li{display:flex;gap:.5rem}</style></head><body>
<h1>Görevler</h1><input id="new-task" placeholder="Görev"><button id="add-btn">Ekle</button>
<div><button data-filter="all">Hepsi</button><button data-filter="active">Aktif</button><button data-filter="done">Biten</button></div>
<ul id="task-list"></ul><footer id="counter"></footer>
<script>
let tasks = JSON.parse(localStorage.getItem("tasks") || "[]"); let filter = "all";
function save(){ localStorage.setItem("tasks", JSON.stringify(tasks)); }
function render(){
  const ul = document.getElementById("task-list"); ul.innerHTML = "";
  tasks.forEach((t, i) => {
    if (filter === "active" && t.done) return; if (filter === "done" && !t.done) return;
    const li = document.createElement("li");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "toggle"; cb.checked = t.done;
    cb.onchange = () => { t.done = cb.checked; save(); render(); };
    const sp = document.createElement("span"); sp.className = "title"; sp.textContent = t.title;
    const del = document.createElement("button"); del.className = "delete"; del.textContent = "Sil";
    del.onclick = () => { tasks.splice(i, 1); save(); render(); };
    li.append(cb, sp, del); ul.append(li);
  });
  document.getElementById("counter").textContent = tasks.filter(t => !t.done).length + " kalan";
}
function add(){ const inp = document.getElementById("new-task"); const v = inp.value.trim(); if (!v) return; tasks.push({ title: v, done: false }); inp.value = ""; save(); render(); }
document.getElementById("add-btn").onclick = add;
document.getElementById("new-task").addEventListener("keydown", e => { if (e.key === "Enter") add(); });
document.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { filter = b.dataset.filter; render(); });
render();
</script></body></html>`;
export const reference = "```html\n" + REF + "\n```";
export const wrong = "```html\n<!doctype html><html><body><h1>Merhaba</h1></body></html>\n```";
