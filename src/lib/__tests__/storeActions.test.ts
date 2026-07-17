import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store";
import { DEFAULT_CONFIG, POLLINATIONS_DEFAULT_MODEL } from "../constants";

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
