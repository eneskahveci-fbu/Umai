import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store";
import { DEFAULT_CONFIG, POLLINATIONS_DEFAULT_MODEL } from "../constants";
import { installFakeBrowserCrypto, removeFakeBrowserCrypto } from "./fakeBrowserCrypto";

/* store.ts'in saf yardımcıları (mergeConfigs/mergeChats/migrateRepos) zaten
   config.test.ts/mergeChats.test.ts'te test ediliyor. Bu dosya, o dosyaların
   KAPSAMADIĞI gerçek Zustand store aksiyonlarını (sohbet CRUD, config
   mutasyonları) hedefler — önceden hiç test edilmemişlerdi. Testler `environment:
   node` altında çalıştığından (window/localStorage yok) yalnızca tarayıcıya
   dokunmayan/`window` kontrolüyle korunan kod yolları egzersiz edilir; bu,
   store'un SSR/node davranışıyla da tutarlıdır. */

function resetStore() {
  useStore.setState({
    chats: [],
    currentId: null,
    incognito: false,
    userId: null,
    userEmail: null,
    toasts: [],
    backgroundJobs: [],
    projectModalId: null,
    view: "chat",
    config: { ...DEFAULT_CONFIG, models: [POLLINATIONS_DEFAULT_MODEL], activeModelId: POLLINATIONS_DEFAULT_MODEL.id },
  });
}

beforeEach(resetStore);

describe("useStore — sohbet CRUD", () => {
  it("newChat: yeni sohbet ekler, currentId'yi ayarlar, listenin başına koyar", () => {
    useStore.getState().newChat();
    const { chats, currentId, view } = useStore.getState();
    expect(chats).toHaveLength(1);
    expect(currentId).toBe(chats[0].id);
    expect(view).toBe("chat");
  });

  it("newChat(true): incognito sohbet oluşturur", () => {
    useStore.getState().newChat(true);
    expect(useStore.getState().incognito).toBe(true);
    expect(useStore.getState().current()?.incognito).toBe(true);
  });

  it("newChat: aktif proje varsa sohbete projectId atanır", () => {
    useStore.setState((s) => ({ config: { ...s.config, activeProjectId: "p1" } }));
    useStore.getState().newChat();
    expect(useStore.getState().current()?.projectId).toBe("p1");
  });

  it("selectChat: currentId değişir, incognito sıfırlanır, view chat'e döner", () => {
    useStore.getState().newChat(true);
    const id = useStore.getState().currentId!;
    useStore.setState({ view: "coder" });
    useStore.getState().selectChat(id);
    const s = useStore.getState();
    expect(s.currentId).toBe(id);
    expect(s.incognito).toBe(false);
    expect(s.view).toBe("chat");
  });

  it("pushMessage: yalnız aktif sohbete mesaj ekler", () => {
    useStore.getState().newChat();
    const id1 = useStore.getState().currentId!;
    useStore.getState().newChat();
    const id2 = useStore.getState().currentId!;
    useStore.getState().pushMessage({ role: "user", content: "merhaba" });
    const chats = useStore.getState().chats;
    expect(chats.find((c) => c.id === id2)!.messages).toHaveLength(1);
    expect(chats.find((c) => c.id === id1)!.messages).toHaveLength(0);
  });

  it("updateLastContent: son mesajın içeriğini ve isError bayrağını günceller", () => {
    useStore.getState().newChat();
    useStore.getState().pushMessage({ role: "assistant", content: "" });
    useStore.getState().updateLastContent("Hata: ağ sorunu", { isError: true });
    const last = useStore.getState().current()!.messages[0];
    expect(last.content).toBe("Hata: ağ sorunu");
    expect(last.isError).toBe(true);
  });

  it("updateLastThinking: son mesajın thinking alanını günceller", () => {
    useStore.getState().newChat();
    useStore.getState().pushMessage({ role: "assistant", content: "" });
    useStore.getState().updateLastThinking("düşünüyorum...");
    expect(useStore.getState().current()!.messages[0].thinking).toBe("düşünüyorum...");
  });

  it("updateLastTokens: token sayaçlarını hem mesaja hem sohbet toplamına ekler", () => {
    useStore.getState().newChat();
    useStore.getState().pushMessage({ role: "assistant", content: "" });
    useStore.getState().updateLastTokens(10, 20);
    const chat = useStore.getState().current()!;
    expect(chat.messages[0].tokenIn).toBe(10);
    expect(chat.messages[0].tokenOut).toBe(20);
    expect(chat.totalInTokens).toBe(10);
    expect(chat.totalOutTokens).toBe(20);
  });

  it("popLastMessage: son mesajı kaldırır", () => {
    useStore.getState().newChat();
    useStore.getState().pushMessage({ role: "user", content: "a" });
    useStore.getState().pushMessage({ role: "assistant", content: "b" });
    useStore.getState().popLastMessage();
    expect(useStore.getState().current()!.messages).toHaveLength(1);
    expect(useStore.getState().current()!.messages[0].content).toBe("a");
  });

  it("renameChat: başlığı günceller", () => {
    useStore.getState().newChat();
    const id = useStore.getState().currentId!;
    useStore.getState().renameChat(id, "Yeni başlık");
    expect(useStore.getState().chats.find((c) => c.id === id)!.title).toBe("Yeni başlık");
  });

  it("tagChat: etiketleri ayarlar", () => {
    useStore.getState().newChat();
    const id = useStore.getState().currentId!;
    useStore.getState().tagChat(id, ["iş", "önemli"]);
    expect(useStore.getState().chats.find((c) => c.id === id)!.tags).toEqual(["iş", "önemli"]);
  });

  it("pinChat: pinned bayrağını ayarlar", () => {
    useStore.getState().newChat();
    const id = useStore.getState().currentId!;
    useStore.getState().pinChat(id, true);
    expect(useStore.getState().chats.find((c) => c.id === id)!.pinned).toBe(true);
  });

  it("moveChat: sohbeti projeye taşır / projeden çıkarır", () => {
    useStore.getState().newChat();
    const id = useStore.getState().currentId!;
    useStore.getState().moveChat(id, "proj1");
    expect(useStore.getState().chats.find((c) => c.id === id)!.projectId).toBe("proj1");
    useStore.getState().moveChat(id, null);
    expect(useStore.getState().chats.find((c) => c.id === id)!.projectId).toBeUndefined();
  });

  it("deleteChat: sohbeti kaldırır, currentId null olur; 'Geri al' onu geri getirir", async () => {
    useStore.getState().newChat();
    const id = useStore.getState().currentId!;
    await useStore.getState().deleteChat(id);
    expect(useStore.getState().chats.find((c) => c.id === id)).toBeUndefined();
    expect(useStore.getState().currentId).toBeNull();
    const toast = useStore.getState().toasts.find((t) => t.action);
    expect(toast).toBeTruthy();
    toast!.action!.fn();
    expect(useStore.getState().chats.find((c) => c.id === id)).toBeTruthy();
  });

  it("rateMessage: belirli sohbet+index'teki mesajı derecelendirir", () => {
    useStore.getState().newChat();
    const id = useStore.getState().currentId!;
    useStore.getState().pushMessage({ role: "assistant", content: "yanıt" });
    useStore.getState().rateMessage(id, 0, "up");
    expect(useStore.getState().chats.find((c) => c.id === id)!.messages[0].rating).toBe("up");
    useStore.getState().rateMessage(id, 0, null);
    expect(useStore.getState().chats.find((c) => c.id === id)!.messages[0].rating).toBeUndefined();
  });

  it("maybeSetTitle: yalnız 'Yeni sohbet' başlığındaysa değiştirir", () => {
    useStore.getState().newChat();
    useStore.getState().maybeSetTitle("Merhaba, bugün hava çok güzel değil mi acaba sence de öyle");
    expect(useStore.getState().current()!.title).not.toBe("Yeni sohbet");
    useStore.getState().renameChat(useStore.getState().currentId!, "Sabit başlık");
    useStore.getState().maybeSetTitle("başka bir metin");
    expect(useStore.getState().current()!.title).toBe("Sabit başlık");
  });
});

describe("useStore — config aksiyonları", () => {
  it("addSkill/toggleSkill/removeSkill: skill yaşam döngüsü", () => {
    useStore.getState().addSkill({ title: "T", content: "C", tags: [], enabled: true, source: "manual" });
    const skill = useStore.getState().config.skills!.find((s) => s.title === "T")!;
    expect(skill.enabled).toBe(true);
    useStore.getState().toggleSkill(skill.id);
    expect(useStore.getState().config.skills!.find((s) => s.id === skill.id)!.enabled).toBe(false);
    useStore.getState().removeSkill(skill.id);
    expect(useStore.getState().config.skills!.find((s) => s.id === skill.id)).toBeUndefined();
  });

  it("incrementSkillUsage / resetSkillProgress", () => {
    useStore.getState().addSkill({ title: "T", content: "C", tags: [], enabled: true, source: "manual" });
    const id = useStore.getState().config.skills!.find((s) => s.title === "T")!.id;
    useStore.getState().incrementSkillUsage([id]);
    expect(useStore.getState().config.skills!.find((s) => s.id === id)!.usageCount).toBe(1);
    useStore.getState().resetSkillProgress();
    expect(useStore.getState().config.skills!.find((s) => s.id === id)!.usageCount).toBe(0);
  });

  it("addHighlight/removeHighlight", () => {
    useStore.getState().addHighlight("önemli pasaj", "kaynak");
    const h = useStore.getState().config.highlights![0];
    expect(h.text).toBe("önemli pasaj");
    useStore.getState().removeHighlight(h.id);
    expect(useStore.getState().config.highlights).toHaveLength(0);
  });

  it("addMemory/removeMemory (legacy)", () => {
    useStore.getState().addMemory("bir not");
    const m = useStore.getState().config.memories.find((x) => x.content === "bir not")!;
    expect(m).toBeTruthy();
    useStore.getState().removeMemory(m.id);
    expect(useStore.getState().config.memories.find((x) => x.id === m.id)).toBeUndefined();
  });

  it("toggleTheme: dark <-> light", () => {
    const start = useStore.getState().config.theme;
    useStore.getState().toggleTheme();
    expect(useStore.getState().config.theme).not.toBe(start);
    useStore.getState().toggleTheme();
    expect(useStore.getState().config.theme).toBe(start);
  });

  it("updateModel/removeModel/activeModel", () => {
    const before = useStore.getState().config.models[0].id;
    useStore.getState().updateModel(before, { label: "Yeni etiket" });
    expect(useStore.getState().activeModel()!.label).toBe("Yeni etiket");
    useStore.getState().removeModel(before);
    expect(useStore.getState().config.models.find((m) => m.id === before)).toBeUndefined();
  });

  it("strongestModel: anahtarlı en güçlü modeli seçer", () => {
    useStore.setState((s) => ({
      config: {
        ...s.config,
        models: [
          { id: "a", label: "gpt-4o-mini", provider: "custom", baseUrl: "x", model: "gpt-4o-mini", apiKey: "K" },
          { id: "b", label: "Claude Opus", provider: "anthropic", baseUrl: "x", model: "opus", apiKey: "K2" },
        ],
        activeModelId: "a",
      },
    }));
    expect(useStore.getState().strongestModel()!.id).toBe("b");
  });

  it("addGithub/removeGithub/activeGithub", () => {
    useStore.getState().addGithub({ username: "u", token: "t" });
    const acc = useStore.getState().config.githubAccounts[0];
    expect(useStore.getState().activeGithub()!.id).toBe(acc.id);
    useStore.getState().removeGithub(acc.id);
    expect(useStore.getState().config.githubAccounts).toHaveLength(0);
  });

  it("addGitlab/removeGitlab/activeGitlab", () => {
    useStore.getState().addGitlab({ username: "u", token: "t" });
    const acc = useStore.getState().config.gitlabAccounts![0];
    expect(useStore.getState().activeGitlab()!.id).toBe(acc.id);
    useStore.getState().removeGitlab(acc.id);
    expect(useStore.getState().config.gitlabAccounts).toHaveLength(0);
  });

  it("addRepo/removeRepo: en son eklenen başa gelir, aktif repo ayarlanır", () => {
    useStore.getState().addRepo("a/b");
    expect(useStore.getState().config.activeRepo).toBe("a/b");
    useStore.getState().addRepo("c/d");
    expect(useStore.getState().config.repos[0]).toBe("c/d");
    useStore.getState().removeRepo("c/d");
    expect(useStore.getState().config.repos).not.toContain("c/d");
  });

  it("addProject/updateProject/removeProject: silinince bağlı sohbetlerin projectId'si temizlenir", () => {
    const id = useStore.getState().addProject("Proje 1");
    expect(useStore.getState().config.activeProjectId).toBe(id);
    useStore.getState().updateProject(id, { name: "Yeniden adlandırıldı" });
    expect(useStore.getState().config.projects.find((p) => p.id === id)!.name).toBe("Yeniden adlandırıldı");
    useStore.getState().newChat();
    useStore.getState().moveChat(useStore.getState().currentId!, id);
    useStore.getState().removeProject(id);
    expect(useStore.getState().config.projects.find((p) => p.id === id)).toBeUndefined();
    expect(useStore.getState().chats[0].projectId).toBeUndefined();
  });

  it("addProjectFromTemplate: şablon alanlarını uygular", () => {
    const id = useStore.getState().addProjectFromTemplate({ name: "Şablon", systemPrompt: "sp" });
    const p = useStore.getState().config.projects.find((x) => x.id === id)!;
    expect(p.name).toBe("Şablon");
    expect(p.systemPrompt).toBe("sp");
  });

  it("addProjectFile/removeProjectFile", () => {
    const id = useStore.getState().addProject("P");
    useStore.getState().addProjectFile(id, { name: "a.txt", content: "merhaba" });
    const file = useStore.getState().config.projects.find((p) => p.id === id)!.files![0];
    expect(file.name).toBe("a.txt");
    useStore.getState().removeProjectFile(id, file.id);
    expect(useStore.getState().config.projects.find((p) => p.id === id)!.files).toHaveLength(0);
  });

  it("addMcpServer/updateMcpServer/removeMcpServer", () => {
    /* DEFAULT_CONFIG.mcpServers zaten yerleşik (Zaman/Adım Adım Düşünme)
       girdiler taşır — yeni eklenen sunucu adına göre bulunmalı, index 0'a
       göre değil. addMcpServer sona ekler. */
    const before = useStore.getState().config.mcpServers?.length ?? 0;
    useStore.getState().addMcpServer({ name: "S", url: "https://x", enabled: true });
    const s = useStore.getState().config.mcpServers!.find((x) => x.name === "S")!;
    expect(s).toBeTruthy();
    useStore.getState().updateMcpServer(s.id, { enabled: false });
    expect(useStore.getState().config.mcpServers!.find((x) => x.id === s.id)!.enabled).toBe(false);
    useStore.getState().removeMcpServer(s.id);
    expect(useStore.getState().config.mcpServers).toHaveLength(before);
  });

  it("addHook/updateHook/removeHook", () => {
    useStore.getState().addHook({ event: "onFinish", command: "echo hi", enabled: true });
    const h = useStore.getState().config.hooks![0];
    useStore.getState().updateHook(h.id, { enabled: false });
    expect(useStore.getState().config.hooks!.find((x) => x.id === h.id)!.enabled).toBe(false);
    useStore.getState().removeHook(h.id);
    expect(useStore.getState().config.hooks).toHaveLength(0);
  });
});

describe("useStore — toast/görev kuyruğu", () => {
  it("addToast/removeToast", () => {
    useStore.getState().addToast("merhaba", "info");
    const t = useStore.getState().toasts[0];
    expect(t.message).toBe("merhaba");
    useStore.getState().removeToast(t.id);
    expect(useStore.getState().toasts).toHaveLength(0);
  });

  it("enqueueJob/updateJob/removeJob/clearFinishedJobs", () => {
    const id = useStore.getState().enqueueJob("bir şey yap");
    expect(useStore.getState().backgroundJobs[0].status).toBe("queued");
    useStore.getState().updateJob(id, { status: "done" });
    expect(useStore.getState().backgroundJobs.find((j) => j.id === id)!.status).toBe("done");
    useStore.getState().clearFinishedJobs();
    expect(useStore.getState().backgroundJobs.find((j) => j.id === id)).toBeUndefined();
  });

  it("removeJob: belirli işi kaldırır", () => {
    const id = useStore.getState().enqueueJob("hedef");
    useStore.getState().removeJob(id);
    expect(useStore.getState().backgroundJobs.find((j) => j.id === id)).toBeUndefined();
  });
});

describe("useStore — setUser izolasyon süpürgesi (Kritik-7)", () => {
  it("hesap değişiminde (prev≠id) snippets ve backgroundJobs de temizlenir", () => {
    useStore.setState({ userId: "userA" });
    useStore.getState().addSnippet({ title: "gizli", language: "text", code: "A'nın promptu" });
    useStore.getState().enqueueJob("A'nın hedef metni");
    expect(useStore.getState().snippets).toHaveLength(1);
    expect(useStore.getState().backgroundJobs).toHaveLength(1);

    useStore.getState().setUser("userB", "b@example.com");

    /* Önceki kullanıcının snippet kütüphanesi/görev hedef metni yeni hesaba
       sızmamalı — yalnız config/chats değil, bunlar da CONFIG_OWNER_KEY'e
       bağlı olmadığından ayrıca süpürülmesi gerekiyordu. */
    expect(useStore.getState().snippets).toHaveLength(0);
    expect(useStore.getState().backgroundJobs).toHaveLength(0);
    expect(useStore.getState().chats).toHaveLength(0);
  });

  it("ilk giriş (prev yok, foreignLocal yok) snippets/backgroundJobs'a dokunmaz", () => {
    useStore.setState({ userId: null });
    useStore.getState().addSnippet({ title: "kalıcı", language: "text", code: "içerik" });
    useStore.getState().setUser("userA", "a@example.com");
    expect(useStore.getState().snippets).toHaveLength(1);
  });
});

describe("useStore — rehydrateSecrets yarış koruması (Kritik-7)", () => {
  beforeAll(() => installFakeBrowserCrypto());
  afterAll(() => removeFakeBrowserCrypto());

  it("decrypt sürerken config başka bir yerden değişirse (hesap değişimi) bayat sonucu UYGULAMAZ", async () => {
    const staleConfig = { ...DEFAULT_CONFIG, providerKeys: { groq: "gsk_STALE_USER_A_KEY" } };
    useStore.setState({ config: staleConfig });
    const pending = useStore.getState().rehydrateSecrets(); // `cur` bu anlık görüntüyü yakalar, decrypt async başlar
    /* Decrypt tamamlanmadan ÖNCE (gerçek yarış penceresi) — setUser/syncConfig'in
       yaptığı gibi config'i BAŞKA bir referansla değiştir. */
    const freshConfig = { ...DEFAULT_CONFIG, providerKeys: { groq: "gsk_USER_B_REAL_KEY" } };
    useStore.setState({ config: freshConfig });
    await pending;
    /* rehydrateSecrets bayat kullanıcı A anlık görüntüsünü uygulamamalı —
       B'nin gerçek config'i korunmalı. */
    expect(useStore.getState().config.providerKeys?.groq).toBe("gsk_USER_B_REAL_KEY");
  });

  it("yarış YOKSA normal şekilde çözüp uygular", async () => {
    useStore.setState({ config: { ...DEFAULT_CONFIG, providerKeys: { groq: "gsk_normal" } } });
    await useStore.getState().rehydrateSecrets();
    expect(useStore.getState().config.providerKeys?.groq).toBe("gsk_normal");
  });
});

describe("useStore — onboarding turu", () => {
  it("setOnboardingDone: tanıtım turunu tekrar izle akışında false'a döner", () => {
    useStore.getState().setOnboardingDone(true);
    expect(useStore.getState().onboardingDone).toBe(true);
    useStore.getState().setOnboardingDone(false);
    expect(useStore.getState().onboardingDone).toBe(false);
  });
});

/* H5 (Tem 2026 hata raporu): "bazen modelin cevabı ben yazmışım gibi
   görünüyor". Akış sürerken araya gizli bir bağlam mesajı (role:"user" —
   terminal/kod çıktısının ajana geri beslenmesi) girebiliyor. Tüm `*OnLast`
   yazıcıları KONUMSAL olduğu için akan metin O mesajın üzerine yazılıyor,
   önek silinince mesaj görünür oluyor ve rolü hâlâ "user" olduğundan modelin
   cevabı kullanıcı balonunda çiziliyordu.

   Aşağıdaki senaryo o pencereyi birebir kurar: asistan placeholder'ı açılır,
   ARAYA kullanıcı mesajı girer, sonra akış yazmaya devam eder. */
describe("useStore — akış yazımları KULLANICI mesajına asla dokunmaz (H5)", () => {
  /** asistan placeholder + araya giren gizli bağlam mesajı. */
  function raceSetup() {
    useStore.getState().newChat();
    useStore.getState().pushMessage({ role: "user", content: "merhaba" });
    useStore.getState().pushMessage({ role: "assistant", content: "" });
    useStore.getState().pushMessage({ role: "user", content: "**Terminal çıktısı** (`ls`):\nREADME.md" });
  }
  const msgs = () => useStore.getState().current()!.messages;

  it("updateLastContent araya giren kullanıcı mesajını değil ASİSTANI günceller", () => {
    raceSetup();
    useStore.getState().updateLastContent("Merhaba! Nasıl yardımcı olabilirim?");
    expect(msgs()[1].role).toBe("assistant");
    expect(msgs()[1].content).toBe("Merhaba! Nasıl yardımcı olabilirim?");
    /* Gizli bağlam mesajı olduğu gibi durmalı — öneki silinirse sohbette
       modelin cevabı kullanıcı balonu olarak görünür (asıl belirti). */
    expect(msgs()[2].role).toBe("user");
    expect(msgs()[2].content).toContain("**Terminal çıktısı**");
  });

  it("thinking / plan / sources / finishReason asistana yazılır", () => {
    raceSetup();
    useStore.getState().updateLastThinking("düşünüyorum…");
    useStore.getState().setPlanOnLast("1. adım\n2. adım");
    useStore.getState().setSourcesOnLast([{ title: "kaynak", url: "https://x.dev" }]);
    useStore.getState().setFinishReasonOnLast("length");
    const a = msgs()[1];
    expect(a.role).toBe("assistant");
    expect(a.thinking).toBe("düşünüyorum…");
    expect(a.plan).toBe("1. adım\n2. adım");
    expect(a.sources).toHaveLength(1);
    expect(a.finishReason).toBe("length");
    const u = msgs()[2];
    expect(u.thinking).toBeUndefined();
    expect(u.plan).toBeUndefined();
    expect(u.sources).toBeUndefined();
    expect(u.finishReason).toBeUndefined();
  });

  it("üretilen görsel asistan mesajına iliştirilir", () => {
    raceSetup();
    useStore.getState().addImageToLast("https://img.example/a.png");
    expect(msgs()[1].images).toEqual(["https://img.example/a.png"]);
    expect(msgs()[2].images).toBeUndefined();
  });

  it("token sayaçları asistana yazılır, kullanıcı mesajına değil", () => {
    raceSetup();
    useStore.getState().updateLastTokens(120, 340);
    expect(msgs()[1].tokenIn).toBe(120);
    expect(msgs()[1].tokenOut).toBe(340);
    expect(msgs()[2].tokenIn).toBeUndefined();
    /* Sohbet toplamı yine de artmalı (davranış değişmedi). */
    expect(useStore.getState().current()!.totalOutTokens).toBe(340);
  });

  it("araç çağrıları asistana eklenir", () => {
    raceSetup();
    useStore.getState().appendToolCallToLast({ id: "t1", name: "run_command", arguments: "{}", status: "pending" });
    useStore.getState().updateToolCallOnLast("t1", { status: "done" });
    expect(msgs()[1].toolCalls).toHaveLength(1);
    expect(msgs()[1].toolCalls![0].status).toBe("done");
    expect(msgs()[2].toolCalls).toBeUndefined();
  });

  it("popLastMessage ASİSTANI siler — kullanıcının yazdığını değil", () => {
    raceSetup();
    useStore.getState().popLastMessage();
    const m = msgs();
    expect(m).toHaveLength(2);
    expect(m[0].content).toBe("merhaba");
    expect(m[1].content).toContain("**Terminal çıktısı**");
    expect(m.some((x) => x.role === "assistant")).toBe(false);
  });

  it("hiç asistan mesajı yoksa hiçbir şey yazılmaz/silinmez", () => {
    useStore.getState().newChat();
    useStore.getState().pushMessage({ role: "user", content: "tek mesaj" });
    useStore.getState().updateLastContent("model cevabı");
    useStore.getState().popLastMessage();
    expect(msgs()).toHaveLength(1);
    expect(msgs()[0].role).toBe("user");
    expect(msgs()[0].content).toBe("tek mesaj");
  });

  it("normal akışta (araya mesaj girmeden) davranış aynı kalır", () => {
    useStore.getState().newChat();
    useStore.getState().pushMessage({ role: "user", content: "soru" });
    useStore.getState().pushMessage({ role: "assistant", content: "" });
    useStore.getState().updateLastContent("cevap");
    expect(msgs()[1].content).toBe("cevap");
    useStore.getState().popLastMessage();
    expect(msgs()).toHaveLength(1);
  });
});

/* Ö8/Ö9 (kullanıcı isteği, Tem 2026): "Dosyalar" (bağlı deponun ağacı) ve
   "Sunucu (workspace)" panelleri kod olarak duruyordu ama ⋯ menüsü
   kaldırılınca ÜST-SEVİYE GİRİŞ NOKTALARI da gitmişti — hiçbir yerden
   açılamıyorlardı. Artık Sidebar → "Araçlar" menüsünden açılıyorlar; bu
   ancak durum CoderView'ın yerel useState'inden STORE'a taşınarak mümkün
   (Sidebar, CoderView'ın kardeşi). */
describe("useStore — sol Alan paneli (Ö8)", () => {
  it("varsayılan kapalı", () => {
    expect(useStore.getState().leftPanel).toBeNull();
  });

  it("toggleLeftPanelState açar, aynı panele tekrar basınca kapatır", () => {
    useStore.getState().toggleLeftPanelState("files");
    expect(useStore.getState().leftPanel).toBe("files");
    useStore.getState().toggleLeftPanelState("files");
    expect(useStore.getState().leftPanel).toBeNull();
  });

  it("en fazla BİR panel açık kalır — diğerine geçince ilki kapanır", () => {
    useStore.getState().toggleLeftPanelState("files");
    useStore.getState().toggleLeftPanelState("workspace");
    expect(useStore.getState().leftPanel).toBe("workspace");
  });

  it("setLeftPanel(null) kapatır", () => {
    useStore.getState().toggleLeftPanelState("workspace");
    useStore.getState().setLeftPanel(null);
    expect(useStore.getState().leftPanel).toBeNull();
  });
});

describe("useStore — depo/hesap bağlama (çok hesaplı)", () => {
  const gh = (id: string, username: string, token: string) => ({ id, username, token });

  it("tokenForRepo: depo hangi hesapla eklendiyse ONUN token'ını verir", async () => {
    /* Regresyon: yalnız "aktif" hesabın token'ı kullanılıyordu; ikinci
       hesabın deposu, birinci hesabın token'ıyla açılmaya çalışılıp 404/401
       alıyordu. */
    const st = useStore.getState();
    st.saveConfig({
      ...st.config,
      githubAccounts: [gh("a1", "kisisel", "TOKEN_A"), gh("a2", "is", "TOKEN_B")],
      activeGithubId: "a1",
      repos: ["is/proje"],
      repoAccounts: { "is/proje": "a2" },
    });
    expect(await useStore.getState().tokenForRepo("is/proje")).toBe("TOKEN_B");
  });

  it("tokenForRepo: bağlı hesap yoksa o sağlayıcının aktif hesabına düşer", async () => {
    const st = useStore.getState();
    st.saveConfig({
      ...st.config,
      githubAccounts: [gh("a1", "kisisel", "TOKEN_A")],
      activeGithubId: "a1",
      repos: ["baska/proje"],
    });
    expect(await useStore.getState().tokenForRepo("baska/proje")).toBe("TOKEN_A");
  });

  it("tokenForRepo: provider parametresi dize sezgisini EZER", async () => {
    /* "namespace/repo" GitHub'a benzer ama GitLab'a düşen depolarda sağlayıcı
       dizeden anlaşılamaz — çağıran taraf kesin bilgiyi geçebilmeli. */
    const st = useStore.getState();
    st.saveConfig({
      ...st.config,
      githubAccounts: [gh("g1", "gh", "GH_TOKEN")],
      activeGithubId: "g1",
      gitlabAccounts: [gh("l1", "gl", "GL_TOKEN")],
      activeGitlabId: "l1",
    });
    const s = useStore.getState();
    expect(await s.tokenForRepo("ns/repo")).toBe("GH_TOKEN");
    expect(await s.tokenForRepo("ns/repo", "gitlab")).toBe("GL_TOKEN");
  });

  it("addRepo: hesabı işaretler ve mezar taşını kaldırır", () => {
    const st = useStore.getState();
    st.saveConfig({ ...st.config, repos: [], deletedRepos: ["geri/gelen"] });
    useStore.getState().addRepo("geri/gelen", "acc9");
    const c = useStore.getState().config;
    expect(c.repos).toContain("geri/gelen");
    expect(c.deletedRepos ?? []).not.toContain("geri/gelen");
    expect(c.repoAccounts?.["geri/gelen"]).toBe("acc9");
  });

  it("removeRepo: mezar taşı bırakır, bağlamayı siler", () => {
    const st = useStore.getState();
    st.saveConfig({
      ...st.config,
      repos: ["a/b", "c/d"],
      activeRepo: "a/b",
      repoAccounts: { "a/b": "acc1" },
    });
    useStore.getState().removeRepo("a/b");
    const c = useStore.getState().config;
    expect(c.repos).toEqual(["c/d"]);
    expect(c.activeRepo).toBe("c/d");
    expect(c.deletedRepos).toContain("a/b");
    expect(c.repoAccounts?.["a/b"]).toBeUndefined();
  });

  it("removeRepo: son depo silinince canlı bağlantı da düşer", () => {
    /* Aksi halde arayüz "bir depo bağlı" gösterirken ajan bağlamına silinmiş
       depo gitmeye devam ediyordu. */
    const st = useStore.getState();
    st.saveConfig({ ...st.config, repos: ["a/b"], activeRepo: "a/b" });
    useStore.setState({ repo: { owner: "a", repo: "b", branch: "main", provider: "github" }, tree: { dirs: {}, files: [] } });
    useStore.getState().removeRepo("a/b");
    expect(useStore.getState().config.activeRepo).toBeNull();
    expect(useStore.getState().repo).toBeNull();
    expect(useStore.getState().tree).toBeNull();
  });
});
