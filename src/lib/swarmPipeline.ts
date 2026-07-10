/* Ekip (swarm) orkestrasyonunun paylaşılan, TAŞIMA-BAĞIMSIZ parçaları —
   rol rehberi, planlayıcı/birleştirici prompt'ları, görev ayrıştırma.
   /api/orchestrate (canlı SSE) bunları KENDİ yerel kopyalarıyla kullanır
   (davranışı değiştirmemek için dokunulmadı); `runSwarmToCompletion` bu
   parçaları TEK, akışsız bir sonuç metnine indirger — arka plan görevleri
   (/api/jobs) sekme kapansa da aynı "planla → paralel uzmanlar → birleştir"
   akışından geçsin diye. */
import { callModel, type LlmCfg } from "./llmCall";

export const MAX_AGENTS = 4;

export const ROLE_GUIDE: Record<string, string> = {
  mimar: "Sen bir YAZILIM MİMARISIN. Tasarım, dosya/modül yapısı, arayüzler, veri akışı ve mimari kararlara odaklan. Somut bir tasarım/plan üret; gerekirse iskelet kod ver.",
  kodlayıcı: "Sen deneyimli bir GELİŞTİRİCİSİN. İstenen işlevi ÇALIŞAN, temiz kodla uygula. Tam kod blokları ver, kenar durumları ele al.",
  test: "Sen bir TEST MÜHENDİSİSİN. Kapsamlı test senaryoları yaz: mutlu yol, kenar durumlar, hata senaryoları. Uygun framework'le (Vitest/pytest vb.) çalışan test kodu ver.",
  inceleyici: "Sen kıdemli bir KOD İNCELEYİCİSİSİN. Bug, güvenlik açığı, performans sorunu ve kod kalitesi açısından titiz incele; her bulguya ciddiyet ve somut düzeltme öner.",
  araştırmacı: "Sen bir ARAŞTIRMACI AJANSIN. Kod tabanını/dış kaynakları keşfedip ilgili gerçekleri topla ve özetle. Bulgularını kanıta (dosya/satır) dayandır.",
  genel: "Sen uzman bir alt-ajansın. Sana verilen alt görevi eksiksiz, uygulanabilir biçimde tamamla.",
};
export const VALID_ROLES = Object.keys(ROLE_GUIDE);
export const ROLE_ICON: Record<string, string> = {
  mimar: "📐", kodlayıcı: "⌨️", test: "🧪", inceleyici: "🔍", araştırmacı: "🔬", genel: "⚙️",
};

export interface SwarmTask { title: string; role: string; instruction: string }

/** Planlayıcı çıktısından JSON görevleri çıkar (kod bloğu/fazla metne dayanıklı). */
export function parseTasks(raw: string, maxAgents: number = MAX_AGENTS): SwarmTask[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { tasks?: { title?: string; role?: string; instruction?: string }[] };
    return (obj.tasks ?? [])
      .filter((t) => t && typeof t.instruction === "string" && t.instruction.trim())
      .slice(0, maxAgents)
      .map((t) => {
        const role = (t.role || "genel").trim().toLowerCase();
        return {
          title: (t.title || "Alt görev").trim(),
          role: VALID_ROLES.includes(role) ? role : "genel",
          instruction: t.instruction!.trim(),
        };
      });
  } catch { return []; }
}

export function buildPlanPrompt(maxAgents: number = MAX_AGENTS): string {
  return (
    `Sen bir baş planlayıcı ajansın. Kullanıcının isteğini, PARALEL ve BAĞIMSIZ ` +
    `çalışabilecek (birbirine bağımlı olmayan) en fazla ${maxAgents} alt göreve böl. ` +
    `Her alt göreve en uygun UZMAN ROLÜ ata. Roller: ` +
    `mimar (tasarım/mimari), kodlayıcı (uygulama), test (test yazımı), ` +
    `inceleyici (bug/güvenlik/performans denetimi), araştırmacı (keşif/analiz), genel. ` +
    `Görev küçükse veya bölmeye değmezse TEK görev döndür. ` +
    `SADECE şu JSON ile yanıt ver, başka hiçbir şey yazma:\n` +
    `{"tasks":[{"title":"kısa başlık","role":"kodlayıcı","instruction":"o ajana net, bağımsız talimat"}]}`
  );
}

export function buildWorkerSystemPrompt(role: string): string {
  return (
    `${ROLE_GUIDE[role] ?? ROLE_GUIDE.genel} ` +
    `SADECE sana verilen alt göreve odaklan; diğer alt görevleri YAPMA. ` +
    `Önce kısaca planla, sonra çöz; çıktını sunmadan önce öz-doğrula (hata/eksik yakala). ` +
    `Uydurma — emin olmadığın yeri belirt. ` +
    `Net, uygulanabilir sonuç üret (gerekiyorsa kod blokları). Türkçe yaz.`
  );
}

export function buildSynthSystemPrompt(baseSys: string): string {
  return (
    `Sen baş ajansın. Alt ajanların sonuçlarını TEK, tutarlı ve eksiksiz bir cevapta ` +
    `birleştir: tekrarları temizle, çelişkileri çöz, mantıklı sıraya koy. Kullanıcının ` +
    `orijinal isteğine doğrudan cevap ver. Alt ajanlardan/süreçten bahsetme, yalnızca ` +
    `nihai sonucu sun. Türkçe yaz.\n\n${baseSys}`
  );
}

/* Yapışkan aday zinciri: bir çağrı hata verirse sıradaki modele geç; çalışan
   aday bulununca sonraki tüm çağrılar oradan başlar. */
function stickyFallback(cfgs: LlmCfg[]) {
  let cfgIdx = 0;
  return async function withFallback<T>(fn: (c: LlmCfg) => Promise<T>): Promise<T> {
    let lastErr: Error | null = null;
    for (let i = cfgIdx; i < cfgs.length; i++) {
      try {
        const r = await fn(cfgs[i]);
        cfgIdx = i;
        return r;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e;
        lastErr = e as Error;
      }
    }
    throw lastErr ?? new Error("Hiçbir model yanıt vermedi.");
  };
}

/** Tam ekip akışını (planla → paralel uzmanlar → birleştir) TEK, akışsız bir
    sonuç metnine indirger — canlı SSE olayı yok, yalnız nihai metin. Görev
    bölünmeye değmezse planlayıcı tek görev döndürür ve doğrudan tek-ajan
    yanıtına düşülür (basit hedefler için ek gecikme yaratmaz). */
export async function runSwarmToCompletion({ cfgs, baseSys, shared, userTask, signal }: {
  cfgs: LlmCfg[];
  baseSys: string;
  shared: { role: string; content: string }[];
  userTask: string;
  signal: AbortSignal;
}): Promise<string> {
  const withFallback = stickyFallback(cfgs);

  const planRaw = await withFallback((c) => callModel(c, [
    { role: "system", content: buildPlanPrompt() },
    ...shared,
    { role: "user", content: `İstek:\n${userTask.slice(0, 4000)}\n\nBunu paralel alt görevlere böl ve JSON döndür.` },
  ], signal));
  const tasks = parseTasks(planRaw);

  if (tasks.length <= 1) {
    return withFallback((c) => callModel(c, [
      { role: "system", content: baseSys },
      ...shared,
      { role: "user", content: userTask },
    ], signal));
  }

  const results = await Promise.all(tasks.map(async (t) => {
    try {
      return await withFallback((c) => callModel(c, [
        { role: "system", content: buildWorkerSystemPrompt(t.role) },
        ...shared,
        { role: "user", content: `ALT GÖREVİN (${t.role}): ${t.title}\n\n${t.instruction}` },
      ], signal));
    } catch (e) {
      return `(Bu alt görev tamamlanamadı: ${(e as Error).message})`;
    }
  }));

  const combined = tasks
    .map((t, i) => `### ${ROLE_ICON[t.role] ?? "⚙️"} ${t.title} (${t.role})\n${results[i]}`)
    .join("\n\n");
  return withFallback((c) => callModel(c, [
    { role: "system", content: buildSynthSystemPrompt(baseSys) },
    ...shared,
    { role: "user", content: `Alt ajanların sonuçları aşağıda. Bunları birleştirip orijinal isteğe nihai cevabı ver:\n\n${combined}` },
  ], signal));
}
