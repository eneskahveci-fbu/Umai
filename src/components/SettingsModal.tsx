"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalA11y } from "@/lib/useModalA11y";
import {
  Brain,
  Check,
  ChevronRight,
  ChevronLeft,
  Layers,
  ExternalLink,
  Download,
  FolderGit2,
  GitBranch,
  Loader2,
  Upload,
  Moon,
  Pencil,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  User,
  Cpu,
  SlidersHorizontal,
  Wrench,
  Plug,
  Webhook,
  Blocks,
  BarChart3,
  Crown,
  Info,
  X,
  Zap,
} from "lucide-react";
import { isGuestMode, setGuestMode, useStore } from "@/lib/store";
import { isAdminEmail } from "@/lib/admin";
import { readErrors, clearErrors } from "@/lib/errorLog";
import { AccountSettings } from "@/components/AccountSettings";
import { ExtensionsSettings } from "@/components/ExtensionsSettings";
import { ProUpgrade } from "@/components/ProUpgrade";
import { AnalyticsSettings } from "@/components/AnalyticsSettings";
import { createClient } from "@/lib/supabase/client";
import { PRESETS, PROVIDER_MODELS, DEFAULT_SYSTEM_PROMPT, STYLE_LABELS, ALL_TOOL_CATALOG } from "@/lib/constants";
import { buildFallbackChain } from "@/lib/fallback";
import { calculateCost, formatCost } from "@/lib/pricing";
import { quickComplete } from "@/lib/quickComplete";
import { fetchUserRepos } from "@/lib/github";
import { fetchGitLabUserRepos } from "@/lib/gitlab";
import { friendlyError } from "@/lib/friendlyError";
import { pickReplacementModel } from "@/lib/modelPicker";
import type { Provider, ResponseStyle } from "@/lib/types";

export type SettingsTab = "model" | "github" | "general" | "advanced" | "mcp" | "hooks" | "hesap" | "extensions" | "plan" | "hakkinda" | "kullanim";

export const SETTINGS_TAB_KEYS: SettingsTab[] = ["model", "github", "general", "advanced", "mcp", "hooks", "hesap", "extensions", "plan", "hakkinda", "kullanim"];

/* routeMode: /settings gerçek rotası olarak render — store bayrağı yok sayılır,
   kapatma /app'e döner, sekme değişimi onTabChange ile URL'e yansır.
   Prop'suz kullanım = /app içi hızlı modal (eski davranış aynen). */
export function SettingsModal({ routeMode = false, initialTab, onTabChange }: {
  routeMode?: boolean;
  initialTab?: SettingsTab;
  onTabChange?: (t: SettingsTab) => void;
} = {}) {
  const storeOpen = useStore((s) => s.settingsOpen);
  const open = routeMode || storeOpen;
  const setOpen = useStore((s) => s.setSettingsOpen);
  const router = useRouter();
  const config = useStore((s) => s.config);
  /* Admin kapısı: hassas sunucu/terminal ayarları yalnız admin e-postasına açık.
     Liste boşken (kurulum öncesi) herkese açık — kimse kilitlenmez. */
  const isAdmin = isAdminEmail(useStore((s) => s.userEmail));
  const updateModel = useStore((s) => s.updateModel);
  const removeModel = useStore((s) => s.removeModel);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const addGithub = useStore((s) => s.addGithub);
  const removeGithub = useStore((s) => s.removeGithub);
  const setActiveGithub = useStore((s) => s.setActiveGithub);
  const addGitlab = useStore((s) => s.addGitlab);
  const removeGitlab = useStore((s) => s.removeGitlab);
  const setActiveGitlab = useStore((s) => s.setActiveGitlab);
  const addRepo = useStore((s) => s.addRepo);
  const setActiveRepo = useStore((s) => s.setActiveRepo);
  const removeRepo = useStore((s) => s.removeRepo);
  const saveConfig = useStore((s) => s.saveConfig);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const addToast = useStore((s) => s.addToast);
  const chats = useStore((s) => s.chats);
  const addMemory = useStore((s) => s.addMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const setAutoMemoryFacts = useStore((s) => s.setAutoMemoryFacts);
  const updateProject = useStore((s) => s.updateProject);
  const addMcpServer = useStore((s) => s.addMcpServer);
  const removeMcpServer = useStore((s) => s.removeMcpServer);
  const updateMcpServer = useStore((s) => s.updateMcpServer);
  const addHook = useStore((s) => s.addHook);
  const removeHook = useStore((s) => s.removeHook);
  const updateHook = useStore((s) => s.updateHook);

  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpHeaderKey, setMcpHeaderKey] = useState("");
  const [mcpHeaderVal, setMcpHeaderVal] = useState("");
  const [mcpTesting, setMcpTesting] = useState<string | null>(null);

  const [hookLabel, setHookLabel] = useState("");
  const [hookCommand, setHookCommand] = useState("");
  const [hookEvent, setHookEvent] = useState<"afterEdit" | "onFinish" | "onError">("afterEdit");

  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "model");
  /* Sekme değişimini tek noktadan geçir: routeMode'da URL de güncellenir. */
  const changeTab = (t: SettingsTab) => { setTab(t); onTabChange?.(t); };
  /* URL'den gelen sekme (geri/ileri) — render sırasında önceki-değer deseni. */
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    if (initialTab) setTab(initialTab);
  }
  const [search, setSearch] = useState("");
  /* iOS tarzı mobil drill-down: mobilde önce kategori listesi gösterilir; bir
     satıra dokununca detay (mobileDetail=true) tam ekran açılır, geri ile listeye
     dönülür. sm+ (masaüstü) bu state'i yok sayar (yan-yana GNOME düzeni). */
  const [mobileDetail, setMobileDetail] = useState(false);
  /* Hibrit/Oracle köprü sağlık testi — /health ucu (token gerektirmez, CORS açık). */
  const [bridgeTest, setBridgeTest] = useState<
    | { status: "idle" }
    | { status: "testing" }
    | { status: "ok"; root?: string; terminal?: boolean }
    | { status: "fail"; message: string }
  >({ status: "idle" });

  /* Hibrit köprüyü test et: terminalWsUrl/localBridgeUrl'den HTTP tabanı türetip
     /health ucuna vurur (tarayıcıdan doğrudan; ucu token istemez, CORS açık). */
  const testBridge = async () => {
    const raw = (config.terminalWsUrl || config.localBridgeUrl || "").trim();
    if (!raw) { setBridgeTest({ status: "fail", message: "Önce bir adres gir." }); return; }
    let base: string;
    try {
      const u = new URL(raw);
      const proto = u.protocol === "ws:" || u.protocol === "http:" ? "http:" : "https:";
      base = `${proto}//${u.host}`;
    } catch { setBridgeTest({ status: "fail", message: "Adres geçersiz — tam URL gir." }); return; }
    setBridgeTest({ status: "testing" });
    try {
      const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) { setBridgeTest({ status: "fail", message: `Sunucu ${r.status} döndü.` }); return; }
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; root?: string; terminal?: boolean };
      if (d?.ok) setBridgeTest({ status: "ok", root: d.root, terminal: d.terminal });
      else setBridgeTest({ status: "fail", message: "Beklenmeyen yanıt — köprü değil?" });
    } catch {
      setBridgeTest({ status: "fail", message: "Ulaşılamadı — tünel kapalı ya da adres yanlış." });
    }
  };
  const modalRef = useRef<HTMLDivElement>(null);
  /* Kapatma: modalda bayrak kapanır; rotada /app'e dönülür. */
  const close = () => {
    setMobileDetail(false);
    if (routeMode) router.push("/app");
    else setOpen(false);
  };
  useModalA11y(modalRef, open, close);
  const [guestMode, setGuestModeState] = useState(() =>
    typeof window === "undefined" ? false : isGuestMode(),
  );

  /* Keyword index — typing in the search box jumps to whichever tab
     contains the matching keyword (first hit wins). */
  const SEARCH_INDEX: Record<"model" | "github" | "general" | "advanced" | "mcp" | "hooks" | "hesap" | "extensions" | "plan" | "hakkinda" | "kullanim", string[]> = {
    hesap:    ["hesap", "account", "e-posta", "email", "giriş", "çıkış", "oturum", "admin"],
    kullanim: ["kullanım", "usage", "analitik", "analytics", "token", "maliyet", "cost", "istatistik", "grafik", "pano"],
    plan:     ["plan", "pro", "abonelik", "yükselt", "upgrade", "ödeme", "fatura", "stripe", "premium"],
    hakkinda: ["hakkında", "about", "sürüm", "version", "gizlilik", "şartlar", "lisans", "iletişim", "destek"],
    extensions: ["eklenti", "extension", "paket", "pack", "git", "ci", "cd", "kural", "web", "modül", "modular"],
    model:    ["model", "api", "anahtar", "key", "openai", "anthropic", "huggingface", "hf", "nvidia", "nim", "provider", "test"],
    github:   ["github", "gitlab", "token", "depo", "repo", "branch", "dal", "kullanıcı", "username"],
    general:  ["otomatik", "pilot", "auto", "davranış", "web", "arama", "search", "bildirim", "notification", "ses", "sound", "kalite", "quality", "hatırla", "bellek", "memori", "memory", "sistem", "prompt", "stil", "style", "tema", "theme", "renk", "color", "accent", "font", "yazı", "boyut", "bağlam", "context", "yedek", "backup", "skill", "ayar", "kısayol", "öğrenme", "öğren", "learning", "eğitim", "ders"],
    advanced: ["webcontainer", "gelişmiş", "guest", "misafir", "terminal", "hibrit", "köprü", "bridge", "otomasyon", "automation", "yerel", "local", "hata", "error", "kural", "rules", "rulesfile"],
    mcp:      ["mcp", "model context", "protocol", "sunucu", "server", "araç", "tool", "entegrasyon"],
    hooks:    ["hook", "kanca", "olay", "event", "lint", "test", "otomatik", "afteredit", "onfinish", "komut", "command"],
  };
  const matchingTabs = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set<string>();
    const hits = new Set<string>();
    for (const [k, kws] of Object.entries(SEARCH_INDEX)) {
      if (kws.some((kw) => kw.includes(q))) hits.add(k);
    }
    return hits;
  })();
  /* Auto-jump to the first matching tab when the search text changes —
     adjusted during render rather than in a state-syncing effect. */
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    if (search.trim() && matchingTabs.size > 0) {
      const adminOnly = new Set(["advanced", "mcp", "hooks"]);
      const first = (["model", "github", "extensions", "general", "kullanim", "plan", "hakkinda", "advanced", "mcp", "hooks", "hesap"] as const)
        .find((k) => matchingTabs.has(k) && (isAdmin || !adminOnly.has(k)));
      if (first && first !== tab) changeTab(first);
    }
  }
  const [provider, setProvider] = useState<Provider>("hf");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState(PRESETS.hf.baseUrl);
  const [model, setModel] = useState(PRESETS.hf.model);
  const [apiKey, setApiKey] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editKey, setEditKey] = useState("");
  const [ghUser, setGhUser] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [verifyingGithub, setVerifyingGithub] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"github" | "gitlab" | null>(null);
  const [glUser, setGlUser] = useState("");
  const [glToken, setGlToken] = useState("");
  const [repoInput, setRepoInput] = useState("");
  /* Hesaba bağlı otomatik gelen depolar (henüz eklenmemiş olanlar) */
  const [accountRepos, setAccountRepos] = useState<string[]>([]);
  const [loadingAccountRepos, setLoadingAccountRepos] = useState(false);
  const [testing, setTesting] = useState(false);
  /* Birleşik model ekleme: ekle + aktif yap + test durumu ve Gelişmiş bölümü. */
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickResult, setQuickResult] = useState<null | "ok" | string>(null);
  /* Self-heal model değişimi olduysa (bkz. addAndTest), sonuç ok/başarısız
     olsun fark etmeksizin bu notu ayrıca göster — quickResult'ın "ok" ile
     "başarısız" render dallarını karıştırmadan. */
  const [quickSwapNote, setQuickSwapNote] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [advOpen, setAdvOpen] = useState(false);
  const [, setErrTick] = useState(0); // hata paneli temizlenince yeniden çiz
  const [memInput, setMemInput] = useState("");
  /* Özel yazı stili oluşturma formu. */
  const [styleFormOpen, setStyleFormOpen] = useState(false);
  const [styleName, setStyleName] = useState("");
  const [styleInstr, setStyleInstr] = useState("");
  const [styleSample, setStyleSample] = useState("");
  const [deriving, setDeriving] = useState(false);
  /* Local drafts for large text fields — saved on blur to avoid calling
     saveConfig on every keystroke (which triggers re-renders and focus loss). */
  const [systemPromptDraft, setSystemPromptDraft] = useState(() => config.systemPrompt);
  const [rulesFileDraft, setRulesFileDraft] = useState(() => config.rulesFile);
  /* Refresh the drafts when the modal (re)opens so stale text isn't shown —
     adjusted during render on the open→true transition. */
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSystemPromptDraft(config.systemPrompt);
      setRulesFileDraft(config.rulesFile);
    }
  }
  /* Sağlayıcıdan anahtarla canlı çekilen model listesi + durum */
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  /* Anahtar girildiğinde modelleri otomatik (debounce'lu) çek. Anahtara göre
     gerçek model listesini getirir; böylece model adı tahminden kaynaklı
     "geçersiz model/anahtar" hataları oluşmaz. */
  useEffect(() => {
    if (!open || tab !== "model") return;
    const key = apiKey.trim();
    const url = baseUrl.trim();
    if (!url || (key.length > 0 && key.length < 8)) return;
    if (provider !== "ollama" && provider !== "custom" && provider !== "pollinations" && key.length === 0) return;
    const t = setTimeout(() => {
      fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: url, apiKey: key, provider }),
      })
        .then((r) => r.json().catch(() => ({})))
        .then((data) => {
          if (!Array.isArray(data.models)) return;
          const models: string[] = data.models;
          setFetchedModels(models);
          if (models.length && !models.includes(model.trim())) {
            /* Henüz hiçbir şey başarısız olmadı — tahmin yürütmeye gerek yok.
               Eşleşme varsa uygula; yoksa modeli DEĞİŞTİRME, kullanıcı
               Gelişmiş'ten kendi seçsin (liste zaten fetchedModels'te). */
            const r = pickReplacementModel(models, PROVIDER_MODELS[provider] ?? [], model.trim());
            if (r.kind === "hardcoded-match" || r.kind === "free-tier-match") setModel(r.model);
            else setAdvOpen(true);
          }
        })
        .catch(() => { /* sessiz; manuel "Yenile" butonu var */ });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, baseUrl, provider, open, tab]);

  /* Git sekmesi açıldığında ve bir hesap aktifse, o hesaptaki depoları otomatik
     getir. Henüz eklenmemiş olanlar "Hesabındaki depolar" listesinde tek tıkla
     eklenebilir. Token varsa özel depolar da gelir. */
  useEffect(() => {
    if (!open || tab !== "github") return;
    const gh = config.githubAccounts.find((a) => a.id === config.activeGithubId);
    const gl = (config.gitlabAccounts ?? []).find((a) => a.id === config.activeGitlabId);
    let cancelled = false;
    (async () => {
      if (!gh && !gl) { if (!cancelled) setAccountRepos([]); return; }
      setLoadingAccountRepos(true);
      const results: string[] = [];
      try {
        if (gh) results.push(...(await fetchUserRepos(gh.token, gh.username)));
      } catch { /* sessiz */ }
      try {
        if (gl) results.push(...(await fetchGitLabUserRepos(gl.token, gl.username)));
      } catch { /* sessiz */ }
      if (cancelled) return;
      const have = new Set(config.repos);
      setAccountRepos([...new Set(results)].filter((r) => !have.has(r)));
      setLoadingAccountRepos(false);
    })();
    return () => { cancelled = true; };
  }, [open, tab, config.activeGithubId, config.activeGitlabId, config.githubAccounts, config.gitlabAccounts, config.repos]);

  if (!open) return null;

  const onProvider = (p: Provider) => {
    setProvider(p);
    setFetchedModels([]);
    if (p !== "custom") { setBaseUrl(PRESETS[p].baseUrl); setModel(PRESETS[p].model); }
    /* Sağlayıcı için daha önce kaydedilmiş anahtar varsa otomatik doldur →
       aynı sağlayıcıya tekrar anahtar girmeye gerek kalmaz. */
    setApiKey(config.providerKeys?.[p] ?? "");
  };

  /* Girilen anahtar + Base URL ile sağlayıcının desteklediği gerçek modelleri
     çeker. Model adını tahmin etmek yerine anahtara göre listelediğimizden
     "model bulunamadı / geçersiz" hataları önlenir. */
  const loadModels = async (opts?: { silent?: boolean }) => {
    if (!baseUrl.trim()) { if (!opts?.silent) addToast("Önce Base URL gir.", "error"); return; }
    setLoadingModels(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.models)) {
        if (!opts?.silent) addToast(data.error || "Modeller alınamadı.", "error");
        setFetchedModels([]);
        return;
      }
      const models: string[] = data.models;
      setFetchedModels(models);
      if (models.length) {
        /* Mevcut model bu anahtarla erişilebilir değilse: bilinen/ücretsiz bir
           eşleşme varsa uygula; yoksa TAHMİN ETME — modeli olduğu gibi bırak,
           Gelişmiş paneli aç ve kullanıcı kendi seçsin (liste zaten hazır). */
        let noMatchNotice = false;
        if (!models.includes(model.trim())) {
          const r = pickReplacementModel(models, PROVIDER_MODELS[provider] ?? [], model.trim());
          if (r.kind === "hardcoded-match" || r.kind === "free-tier-match") {
            setModel(r.model);
          } else {
            setAdvOpen(true);
            noMatchNotice = true;
            if (!opts?.silent) addToast(`'${model.trim()}' bu anahtarla bulunamadı. Aşağıdan bir model seç (Gelişmiş → Model seçimi).`, "info");
          }
        }
        if (!opts?.silent && !noMatchNotice) addToast(`${models.length} model bulundu.`, "success");
      } else if (!opts?.silent) {
        addToast("Bu anahtarla model bulunamadı.", "info");
      }
    } catch (err) {
      if (!opts?.silent) addToast(`Hata: ${(err as Error).message}`, "error");
      setFetchedModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const submitGithub = async () => {
    if (!ghToken.trim()) { addToast("GitHub token gerekli (ghp_...).", "error"); return; }
    setVerifyingGithub(true);
    try {
      /* Token'ı eklemeden ÖNCE doğrula → anında net geri bildirim, sessiz hata yok. */
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${ghToken.trim()}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        addToast(
          res.status === 401 ? "Token geçersiz veya süresi dolmuş — yeni bir PAT oluştur."
          : res.status === 403 ? "Token yetkisiz/oran sınırı — 'repo' kapsamı gerekli."
          : `GitHub doğrulama hatası (${res.status}).`,
          "error",
        );
        return;
      }
      const user = await res.json() as { login?: string };
      addGithub({ username: ghUser.trim() || user.login || "github", token: ghToken.trim() });
      addToast(`GitHub bağlandı: ${user.login} ✓`, "success");
      setGhUser(""); setGhToken("");
    } catch (e) {
      addToast(`Ağ hatası: ${(e as Error).message}`, "error");
    } finally {
      setVerifyingGithub(false);
    }
  };

  const submitGitlab = () => {
    if (!glUser.trim() || !glToken.trim()) { addToast("Kullanıcı adı ve token gerekli.", "error"); return; }
    addGitlab({ username: glUser.trim(), token: glToken.trim() });
    addToast("GitLab hesabı eklendi.", "success");
    setGlUser(""); setGlToken("");
  };

  /* Claude tarzı tek tıkla bağlama: Supabase OAuth (linkIdentity) ile GitHub/
     GitLab hesabını mevcut oturuma bağlar. Dönüşte /app?gitlink=... yakalanıp
     hesap eklenir. Supabase'de ilgili provider + "Manual linking" açık olmalı. */
  const connectGitOAuth = async (prov: "github" | "gitlab") => {
    const sb = createClient();
    if (!sb) {
      addToast("Supabase bağlı değil — aşağıdan token ile ekleyebilirsin.", "error");
      return;
    }
    setOauthBusy(prov);
    try {
      const scopes = prov === "github" ? "repo read:user read:org" : "api read_user";
      const redirectTo = `${window.location.origin}/app?gitlink=${prov}`;
      const { error } = await sb.auth.linkIdentity({ provider: prov, options: { scopes, redirectTo } });
      if (error) {
        addToast(
          `${prov === "github" ? "GitHub" : "GitLab"} bağlanamadı: ${error.message}. ` +
          `Supabase → Authentication'da ${prov} provider'ı ve "Manual linking" açık olmalı.`,
          "error",
        );
        setOauthBusy(null);
      }
      // Başarılıysa tarayıcı OAuth sayfasına yönlenir; setOauthBusy sıfırlamaya gerek yok.
    } catch (err) {
      addToast(`Bağlantı hatası: ${err instanceof Error ? err.message : "bilinmeyen"}`, "error");
      setOauthBusy(null);
    }
  };

  const submitRepo = () => {
    if (!repoInput.trim()) { addToast("Depo adı gerekli.", "error"); return; }
    addRepo(repoInput.trim());
    addToast("Depo eklendi.", "success");
    setRepoInput("");
  };

  const testModel = async (m: { baseUrl: string; model: string; apiKey: string; provider: Provider }) => {
    setTesting(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Merhaba, 1+1=?" }], baseUrl: m.baseUrl, model: m.model, apiKey: m.apiKey, provider: m.provider }) });
      addToast(res.ok ? "Bağlantı başarılı!" : `Hata: ${(await res.text()).slice(0, 200)}`, res.ok ? "success" : "error");
    } catch (err) { addToast(`Hata: ${(err as Error).message}`, "error"); }
    finally { setTesting(false); }
  };

  /* Anahtar alma sayfaları (bilinenler; olmayanlarda link gizlenir). */
  const QUICK_KEY_URL: Partial<Record<Provider, string>> = {
    gemini: "https://aistudio.google.com/apikey",
    groq: "https://console.groq.com/keys",
    deepseek: "https://platform.deepseek.com/api_keys",
    openrouter: "https://openrouter.ai/keys",
    anthropic: "https://console.anthropic.com/settings/keys",
    mistral: "https://console.mistral.ai/api-keys",
    cerebras: "https://cloud.cerebras.ai",
    together: "https://api.together.xyz/settings/api-keys",
    xai: "https://console.x.ai",
    hf: "https://huggingface.co/settings/tokens",
    github: "https://github.com/settings/tokens",
    nvidia: "https://build.nvidia.com",
  };
  /* Anahtarsız çalışabilen sağlayıcılar (anahtar alanı opsiyonel). */
  const KEY_OPTIONAL: Provider[] = ["pollinations", "ollama", "custom"];
  /* PRESET etiketinden kısa, temiz ad (emoji + parantez kırpılır). */
  const cleanLabel = (p: Provider) => PRESETS[p].label.replace(/\s*\([^)]*\)\s*$/, "").replace(/^[^\p{L}]*/u, "").trim();

  /* Birleşik ekleme: preset (veya Gelişmiş'teki override'lar) ile modeli ekle,
     AKTİF yap, anahtarı sağlayıcı hafızasına yaz ve canlı test et. */
  /* Bir modeli kısa bir "Merhaba" ile dener; başarılıysa null, değilse kısa
     hata metni döner. Model adı geçersizse (decommissioned/yanlış) bunu ayırt
     eder → çağıran gerçek listeden geçerli modele geçebilir. */
  const probeModel = async (bu: string, mdl: string, key: string, prov: string): Promise<{ ok: true } | { ok: false; detail: string; badModel: boolean }> => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Merhaba" }], baseUrl: bu, model: mdl, apiKey: key, provider: prov }),
      });
      if (res.ok) return { ok: true };
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      const low = detail.toLowerCase();
      /* Durum koduna göre kapı: yalnız 400/404 "model hatası" sayılabilir.
         401/403/429/5xx ASLA — aksi halde ör. "Ayarlar → Modeller'den
         anahtarı kontrol et" (401 mesajı, içinde "model" alt-dizesi geçer)
         yanlışlıkla bad-model sanılıp gereksiz bir self-heal tetiklenir. */
      const badModel = (res.status === 400 || res.status === 404) &&
        /\bmodel\b|not found|does not exist|decommission|unknown model|no such model|geçersiz model|model bulunamadı/.test(low);
      return { ok: false, detail: detail || `HTTP ${res.status}`, badModel };
    } catch (e) {
      return { ok: false, detail: (e as Error).message, badModel: false };
    }
  };

  const addAndTest = async () => {
    const key = apiKey.trim() || config.providerKeys?.[provider] || "";
    if (!key && !KEY_OPTIONAL.includes(provider)) { addToast("Önce API anahtarını yapıştır.", "error"); return; }
    const bu = baseUrl.trim() || PRESETS[provider].baseUrl;
    let mdl = model.trim() || PRESETS[provider].model;
    if (!bu || !mdl) { addToast("Base URL ve model gerekli (Gelişmiş bölümünden gir).", "error"); return; }
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `m_${Date.now()}`;
    setLabel("");
    setQuickBusy(true);
    setQuickResult(null);
    setQuickSwapNote(null);

    const persist = (finalModel: string) => saveConfig({
      ...useStore.getState().config,
      models: [...useStore.getState().config.models.filter((m) => m.id !== id), { id, label: label.trim() || cleanLabel(provider), provider, baseUrl: bu, model: finalModel, apiKey: key }],
      activeModelId: id,
      providerKeys: key ? { ...useStore.getState().config.providerKeys, [provider]: key } : useStore.getState().config.providerKeys,
    });

    try {
      /* Model her hâlükârda KAYDEDİLİR (test sadece bir kontrol). */
      persist(mdl);
      let r = await probeModel(bu, mdl, key, provider);

      /* Test, model adının geçersizliği yüzünden başarısızsa: anahtarla gerçek
         model listesini çek, GÜVENLİ bir modele geç ve BİR KEZ daha dene →
         "preset modeli bayat" kaynaklı hataları kullanıcı görmeden düzeltir.
         Asla rastgele (ör. ücretli) bir modele sessizce düşülmez — bkz.
         modelPicker.ts; hangi katmanda eşleşme bulunduğuna göre kullanıcıya
         FARKLI TONDA haber verilir (A4). */
      let swapNotice: { tone: "info" | "warning"; text: string } | null = null;
      const originalModel = mdl;
      if (!r.ok && r.badModel && provider !== "pollinations") {
        try {
          const mr = await fetch("/api/models", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ baseUrl: bu, apiKey: key, provider }),
          });
          const md = await mr.json().catch(() => ({}));
          const list: string[] = Array.isArray(md.models) ? md.models : [];
          if (list.length && !list.includes(mdl)) {
            const pick = pickReplacementModel(list, PROVIDER_MODELS[provider] ?? [], originalModel);
            const preferred = pick.kind === "no-safe-match" ? pick.firstAvailable : pick.model;
            if (preferred) {
              mdl = preferred;
              setModel(preferred);
              setFetchedModels(list);
              persist(preferred);
              r = await probeModel(bu, preferred, key, provider);
              if (pick.kind === "hardcoded-match") {
                swapNotice = { tone: "info", text: `Model güncellendi: '${originalModel}' artık yok, önerilen '${preferred}' kullanılıyor.` };
              } else if (pick.kind === "free-tier-match") {
                swapNotice = { tone: "info", text: `Ücretsiz model değişti: '${originalModel}' artık yok, '${preferred}' (ücretsiz) kullanılıyor.` };
              } else {
                swapNotice = { tone: "warning", text: `Dikkat: '${originalModel}' bulunamadı ve ücretsiz alternatif yok. Geçici olarak '${preferred}' denendi — ücretli/uygun olmayabilir, Ayarlar → Modeller'den kendin seç.` };
              }
            }
          }
        } catch { /* liste alınamadı → mevcut hatayı göster */ }
      }

      if (swapNotice) {
        setQuickSwapNote(swapNotice);
        addToast(swapNotice.text, swapNotice.tone === "warning" ? "error" : "info");
      }
      if (r.ok) {
        setQuickResult("ok");
        if (!swapNotice) addToast(`Model eklendi ve çalışıyor (${mdl}) — artık aktif.`, "success");
      } else {
        setQuickResult(friendlyError(r.detail));
        /* Model KAYDEDİLDİ — kullanıcı "eklenmedi" sanmasın. */
        addToast("Model kaydedildi. Test yanıtı alınamadı — anahtarı/model adını kontrol et ya da yine de kullanmayı dene.", "info");
      }
    } finally {
      setQuickBusy(false);
    }
  };

  const activeProj = config.projects.find((p) => p.id === config.activeProjectId);

  /* GNOME tarzı dikey sekmeler. `admin: true` olanlar (teknik ayarlar) admin
     dışındaki kullanıcılardan tamamen gizlenir → sade deneyim. */
  const ALL_TABS = [
    { key: "hesap", label: "Hesap", icon: User, admin: false },
    { key: "model", label: "Model", icon: Cpu, admin: false },
    { key: "github", label: "Git", icon: GitBranch, admin: false },
    { key: "extensions", label: "Eklentiler", icon: Blocks, admin: false },
    { key: "general", label: "Temel", icon: SlidersHorizontal, admin: false },
    { key: "kullanim", label: "Kullanım", icon: BarChart3, admin: false },
    { key: "plan", label: "Plan", icon: Crown, admin: false },
    { key: "advanced", label: "Gelişmiş", icon: Wrench, admin: true },
    { key: "mcp", label: "MCP", icon: Plug, admin: true },
    { key: "hooks", label: "Kancalar", icon: Webhook, admin: true },
    { key: "hakkinda", label: "Hakkında", icon: Info, admin: false },
  ] as const;
  const visibleTabs = ALL_TABS.filter((t) => isAdmin || !t.admin);
  /* Admin dışı kullanıcı gizli bir sekmedeyse (ör. arama/eski durum) Hesap'a düş. */
  if (!visibleTabs.some((t) => t.key === tab)) {
    if (tab !== "hesap") setTab("hesap");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={close}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative w-full max-w-none sm:max-w-3xl h-dvh sm:h-[88dvh] rounded-none sm:rounded-2xl border-0 sm:border border-line bg-surface overflow-hidden flex"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* SOL — GNOME (masaüstü) / iOS liste (mobil). Mobilde detayda gizlenir. */}
        <aside className={`${mobileDetail ? "hidden sm:flex" : "flex"} w-full sm:w-56 shrink-0 border-r border-line/60 bg-bgsoft/40 flex-col min-h-0`}>
          <div className="flex items-center justify-between gap-1 px-4 sm:px-4 pt-4 pb-2">
            <h3 id="settings-title" className="text-xl sm:text-lg font-bold">Ayarlar</h3>
            <button onClick={close} className="shrink-0 text-muted hover:text-ink p-1 rounded-lg hover:bg-bgsoft" title="Kapat"><X size={18} /></button>
          </div>
          <div className="px-3 sm:px-2.5 pb-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ara…"
                className="w-full bg-surface border border-line/60 rounded-lg pl-8 pr-7 py-2 sm:py-1.5 text-sm outline-none focus:border-brand/50 placeholder:text-muted/40 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted/40 hover:text-ink p-1 rounded transition-colors" title="Temizle"><X size={12} /></button>
              )}
            </div>
          </div>
          {/* sm+: pill listesi (GNOME). Mobil: iOS satırları (chevron + büyük dokunma). */}
          <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-3 sm:px-2 pb-3 sm:gap-0.5">
            {visibleTabs.map(({ key, label, icon: Icon }) => {
              const hit = matchingTabs.has(key);
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => { changeTab(key); setMobileDetail(true); }}
                  className={`relative w-full flex items-center gap-3 sm:gap-2.5 px-3 py-3 sm:py-2 rounded-xl sm:rounded-lg text-[15px] sm:text-sm font-medium transition-colors text-left ${
                    active ? "sm:bg-brand/12 sm:text-brand bg-bgsoft text-ink" : "text-ink sm:text-muted hover:text-ink hover:bg-bgsoft sm:hover:bg-surface"
                  }`}
                >
                  <Icon size={18} className="shrink-0 text-brand sm:text-current" />
                  <span className="truncate flex-1">{label}</span>
                  {hit && !active && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />}
                  <ChevronRight size={16} className="sm:hidden text-muted/40 shrink-0" />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* SAĞ — içerik. Mobilde liste görünümünde gizli, detayda tam ekran. */}
        <div className={`${mobileDetail ? "flex" : "hidden sm:flex"} flex-1 min-w-0 min-h-0 flex-col`}>
          {/* Mobil iOS geri başlığı */}
          <div className="sm:hidden relative shrink-0 flex items-center gap-1 px-1.5 py-2 border-b border-line/60">
            <button onClick={() => setMobileDetail(false)} className="flex items-center gap-0.5 text-brand font-semibold text-[15px] px-2 py-1 rounded-lg hover:bg-bgsoft">
              <ChevronLeft size={20} /> Ayarlar
            </button>
            <span className="font-bold text-sm absolute left-1/2 -translate-x-1/2 pointer-events-none">{visibleTabs.find((t) => t.key === tab)?.label}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-5" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>

        {/* MODEL */}
        {tab === "hesap" && <AccountSettings />}

        {tab === "extensions" && <ExtensionsSettings />}

        {tab === "kullanim" && <AnalyticsSettings />}

        {tab === "plan" && (
          <section className="space-y-4">
            <div>
              <h4 className="text-sm font-bold flex items-center gap-2"><Crown size={16} className="text-brand" /> Plan & Abonelik</h4>
              <p className="text-xs text-muted/70 mt-1 leading-relaxed">
                craft.ai BYOK ile her zaman ücretsizdir — kendi anahtarınla sınırsız kullanırsın. Pro yalnızca ek
                kolaylıklar (hazır kullanım + bulut senkron) sağlar.
              </p>
            </div>
            <ProUpgrade />
            <div className="premium-card rounded-xl p-4 text-xs text-muted/70 leading-relaxed">
              <div className="font-semibold text-ink mb-1">Ücretsiz katmanda neler var?</div>
              Tüm sağlayıcılar (BYOK), çok-sağlayıcılı otomatik fallback, sohbet/coder/stüdyo, sandbox önizleme,
              eklentiler, öğrenme modu — hepsi ücretsiz. Pro paketini yalnızca cihazlar arası bulut senkron ve hazır
              kota istersen değerlendir.
            </div>
          </section>
        )}

        {tab === "hakkinda" && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-brand/12 border border-brand/20 grid place-items-center text-brand"><Info size={22} /></span>
              <div>
                <div className="text-base font-bold">craft.ai</div>
                <div className="text-[11px] text-muted/60">Tarayıcıda çalışan Türkçe AI kodlama asistanı</div>
              </div>
            </div>
            <div className="premium-card rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted/60">Sürüm</span><span className="font-mono">{process.env.NEXT_PUBLIC_APP_VERSION || "2026.06"}</span></div>
              <div className="flex justify-between"><span className="text-muted/60">Model tabanı</span><span>Çok sağlayıcılı (BYOK)</span></div>
              <div className="flex justify-between"><span className="text-muted/60">Gizlilik</span><span>Anahtarlar tarayıcında</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/privacy", label: "Gizlilik" },
                { href: "/terms", label: "Kullanım Şartları" },
                { href: "/cookies", label: "Çerezler" },
                { href: "/pricing", label: "Fiyatlandırma" },
              ].map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between premium-card rounded-lg px-3 py-2 text-xs font-semibold hover:border-brand/40 transition-colors">
                  {l.label} <ExternalLink size={12} className="text-muted/50" />
                </a>
              ))}
            </div>
            <p className="text-[11px] text-muted/45 leading-relaxed">
              API anahtarların asla sunucuya gönderilmez veya saklanmaz. Sohbet geçmişi yalnızca giriş yaptıysan ve
              istersen Supabase üzerinde senkronlanır (RLS ile kişiye özel).
            </p>
          </section>
        )}

        {tab === "model" && (
          <section>
            <p className="text-xs text-muted mb-3">Birden fazla model ekleyebilirsin. Anahtarlar yalnızca bu tarayıcıda saklanır.</p>
            
            {/* Birleşik model ekleme — hızlı kurulum + gelişmiş TEK alanda.
               Varsayılan akış: sağlayıcı seç → anahtarı yapıştır → Ekle ve test et
               (eklenir, aktif olur, canlı test edilir). Gelişmiş: ad/BaseURL/model. */}
            <div className="mb-4 rounded-xl border border-brand/30 bg-brand/8 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand mb-1.5">
                <Zap size={14} /> Model ekle — sağlayıcı seç, anahtarı yapıştır
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-2">
                Base URL ve varsayılan model otomatik ayarlanır; model eklenir, test edilir
                ve aktif olur. Anahtar yalnızca tarayıcında kalır.
              </p>
              {/* Önerilen ücretsiz sağlayıcılar — tek tıkla seç */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted/45 w-full">Önerilen ücretsiz · açık kaynak</span>
                {(["gemini", "groq", "nvidia", "cerebras", "openrouter"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => { onProvider(p); setQuickResult(null); }}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${provider === p ? "border-brand/50 bg-brand/12 text-brand" : "border-line/60 text-muted hover:text-ink hover:border-brand/30"}`}
                  >
                    {cleanLabel(p)}
                  </button>
                ))}
              </div>
              <select
                value={provider}
                onChange={(e) => { onProvider(e.target.value as Provider); setQuickResult(null); }}
                className="input-mono w-full mb-2.5"
              >
                {(Object.keys(PRESETS) as Provider[]).map((p) => (
                  <option key={p} value={p}>{PRESETS[p].label}</option>
                ))}
              </select>
              {QUICK_KEY_URL[provider] && (
                <a
                  href={QUICK_KEY_URL[provider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-brand hover:text-branddim underline mb-2"
                >
                  {cleanLabel(provider)} anahtarı al <ExternalLink size={11} />
                </a>
              )}
              <div className="flex gap-1.5">
                <input
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setQuickResult(null); }}
                  placeholder={PRESETS[provider].keyHint}
                  className="input-mono flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && !quickBusy) addAndTest(); }}
                />
                <button
                  onClick={addAndTest}
                  disabled={quickBusy || (!apiKey.trim() && !config.providerKeys?.[provider] && !KEY_OPTIONAL.includes(provider))}
                  className="px-3 py-2 rounded-lg bg-brand hover:bg-branddim text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  {quickBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Ekle ve test et
                </button>
              </div>
              {quickSwapNote && (
                <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] break-words leading-relaxed ${quickSwapNote.tone === "warning" ? "border-red/30 bg-red/8 text-red" : "border-brand/30 bg-brand/8 text-muted"}`}>
                  {quickSwapNote.text}
                </div>
              )}
              {quickResult === "ok" && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green font-semibold">
                  <Check size={12} /> Çalışıyor — bu model artık aktif.
                </div>
              )}
              {quickResult && quickResult !== "ok" && (
                <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/8 px-2.5 py-2 text-[11px] text-muted break-words leading-relaxed">
                  <span className="font-semibold text-amber-400">Model kaydedildi</span>, ama test yanıtı alınamadı: {quickResult}
                </div>
              )}

              {/* Gelişmiş — ad · Base URL · model (custom seçilince otomatik açık) */}
              <button
                type="button"
                onClick={() => setAdvOpen((v) => !v)}
                className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink transition-colors"
              >
                <ChevronRight size={12} className={`transition-transform ${advOpen || provider === "custom" ? "rotate-90" : ""}`} />
                Gelişmiş — görünen ad · Base URL · model seçimi
              </button>
              {(advOpen || provider === "custom") && (
                <div className="grid gap-2 mt-2">
                  <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Görünen ad (opsiyonel)" className="input-mono" />
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL" className="input-mono" />
                  {fetchedModels.length > 0 ? (
                    <select value={model} onChange={(e) => setModel(e.target.value)} className="input-mono">
                      {!fetchedModels.includes(model) && model && <option value={model}>{model}</option>}
                      {fetchedModels.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <>
                      <input value={model} onChange={(e) => setModel(e.target.value)} list="model-suggestions" placeholder="Model adı — anahtar girince otomatik dolar" className="input-mono" />
                      <datalist id="model-suggestions">
                        {(PROVIDER_MODELS[provider] ?? []).map((m) => <option key={m} value={m} />)}
                      </datalist>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => loadModels()}
                    disabled={loadingModels}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line hover:border-brand text-xs font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50"
                  >
                    {loadingModels ? "Modeller yükleniyor…" : fetchedModels.length > 0 ? `↻ Modelleri yenile (${fetchedModels.length})` : "↻ Anahtarla modelleri getir"}
                  </button>
                </div>
              )}
            </div>

            {/* Güven kartı — anahtarın nerede yaşadığını sade dille anlatır. */}
            <div className="mb-4 rounded-xl border border-line/60 bg-bgsoft/40 p-3 text-[11px] text-muted leading-relaxed">
              <div className="font-bold text-ink/80 mb-1">🔒 Anahtarın nerede saklanır?</div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Yalnızca <strong>bu tarayıcıda</strong>, şifrelenmiş olarak saklanır — sunucuya kaydedilmez.</li>
                <li>İstekler doğrudan senin anahtarınla sağlayıcıya gider; craft aracıdır, içerik saklamaz.</li>
                <li>Modeli silince ya da tarayıcı verisini temizleyince anahtar da gider.</li>
              </ul>
            </div>

            {config.models.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {config.models.map((m) => {
                  const active = config.activeModelId === m.id;
                  const ed = editId === m.id;
                  return (
                    <div key={m.id} className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl border ${active ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveModel(m.id)} className={`w-5 h-5 rounded-full grid place-items-center border ${active ? "bg-brand border-brand text-white" : "border-muted"}`}>
                          {active && <Check size={11} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          {ed ? <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="input-mono !py-1 text-sm" /> : <><div className="text-sm font-semibold truncate">{m.label}</div><div className="text-xs text-muted font-mono truncate">{m.model}</div></>}
                        </div>
                        <div className="flex items-center gap-1">
                          {ed ? <button onClick={() => { updateModel(editId!, { label: editLabel.trim() || undefined, apiKey: editKey.trim() }); addToast("Güncellendi.", "success"); setEditId(null); }} className="text-muted hover:text-green p-1"><Check size={14} /></button>
                            : <>
                              <button onClick={() => testModel(m)} disabled={testing} className="text-muted hover:text-green p-1 disabled:opacity-40" title="Test et"><Play size={14} /></button>
                              <button onClick={() => { setEditId(m.id); setEditLabel(m.label); setEditKey(m.apiKey); }} className="text-muted hover:text-ink p-1"><Pencil size={14} /></button>
                            </>}
                          <button onClick={() => removeModel(m.id)} className="text-muted hover:text-red p-1"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {ed && <input type="password" value={editKey} onChange={(e) => setEditKey(e.target.value)} className="input-mono !py-1 text-sm" placeholder="API anahtarı" />}
                    </div>
                  );
                })}
              </div>
            )}
            {config.activeModelId && (() => {
              /* Otomatik ücretsiz yedek zinciri: aktif model hata verirse sunucu
                 sırayla bu adayları dener. İstemcinin yolladığı zincirle birebir
                 aynı mantık (buildFallbackChain) → kullanıcı ne denenecek görür. */
              const activeM = config.models.find((m) => m.id === config.activeModelId);
              if (!activeM) return null;
              const chain = buildFallbackChain(config.models, config.activeModelId);
              return (
                <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50 mb-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Layers size={13} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-muted uppercase tracking-wide">Otomatik ücretsiz yedek zinciri</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed mb-2.5">
                    Aktif model kota/erişim hatası verirse istek düşmez; soldan sağa sırayla denenir.
                    Her ücretsiz katmanın ayrı kotası birleşince kesintisiz kullanım sağlar.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="px-2 py-1 rounded-lg border border-branddim bg-brand/10 text-brand font-semibold font-mono" title={cleanLabel(activeM.provider)}>
                      {activeM.model}
                    </span>
                    {chain.map((c, i) => (
                      <Fragment key={`${c.provider}-${c.model}-${i}`}>
                        <ChevronRight size={12} className="text-muted shrink-0" />
                        <span
                          className="px-2 py-1 rounded-lg border border-line bg-bgsoft text-muted font-mono"
                          title={`${cleanLabel(c.provider)}${c.apiKey === "" ? " · anahtarsız" : ""}`}
                        >
                          {c.model}{c.apiKey === "" ? " 🆓" : ""}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                  {chain.length === 0 && (
                    <p className="text-xs text-amber-400/90 mt-2 leading-relaxed">
                      Henüz yedek yok. Ücretsiz bir sağlayıcı (Google Gemini / Groq / OpenRouter) eklersen
                      otomatik olarak bu zincire katılır.
                    </p>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* GITHUB + GITLAB */}
        {tab === "github" && (
          <section className="flex flex-col gap-5">
            {/* GitHub Accounts */}
            <div>
              <h4 className="text-sm font-bold mb-1">GitHub Hesapları</h4>
              <p className="text-xs text-muted mb-2">Birden fazla hesap ekleyebilirsin. Aktif hesap token gerektiren işlemlerde kullanılır.</p>
              {config.githubAccounts.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {config.githubAccounts.map((a) => {
                    const isActive = config.activeGithubId === a.id;
                    return (
                      <div key={a.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isActive ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                        <button
                          onClick={() => setActiveGithub(a.id)}
                          className={`w-5 h-5 rounded-full grid place-items-center border shrink-0 ${isActive ? "bg-brand border-brand text-white" : "border-muted"}`}
                        >
                          {isActive && <Check size={11} />}
                        </button>
                        <GitBranch size={13} className={isActive ? "text-brand" : "text-muted"} />
                        <span className="flex-1 text-sm font-semibold truncate">{a.username}</span>
                        {isActive && <span className="text-[10px] text-brand font-mono">aktif</span>}
                        <button onClick={() => removeGithub(a.id)} className="text-muted hover:text-red p-1 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => connectGitOAuth("github")}
                disabled={oauthBusy !== null}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 mb-3"
              >
                {oauthBusy === "github" ? <Loader2 size={16} className="animate-spin" /> : <GitBranch size={16} />}
                GitHub ile bağlan
              </button>
              <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
                <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">veya token ile ekle</div>
                <div className="grid gap-2">
                  <input value={ghUser} onChange={(e) => setGhUser(e.target.value)} placeholder="Kullanıcı adı (opsiyonel)" className="input-mono" />
                  <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !verifyingGithub) submitGithub(); }} placeholder="GitHub token (ghp_...)" className="input-mono" />
                  <button onClick={submitGithub} disabled={verifyingGithub} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors disabled:opacity-50">{verifyingGithub ? <><Loader2 size={15} className="animate-spin" /> Doğrulanıyor…</> : <><Plus size={15} /> Bağla &amp; Doğrula</>}</button>
                </div>
              </div>
            </div>

            {/* Repositories */}
            <div>
              <h4 className="text-sm font-bold mb-1">Depolar</h4>
              <p className="text-xs text-muted mb-2">Aktif depo Coder&apos;da otomatik bağlanır. En fazla 12 depo kaydedilir.</p>
              {config.repos.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {config.repos.map((r) => {
                    const isActive = config.activeRepo === r;
                    return (
                      <div key={r} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isActive ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                        <button
                          onClick={() => setActiveRepo(r)}
                          className={`w-5 h-5 rounded-full grid place-items-center border shrink-0 ${isActive ? "bg-brand border-brand text-white" : "border-muted"}`}
                        >
                          {isActive && <Check size={11} />}
                        </button>
                        <FolderGit2 size={13} className={isActive ? "text-brand" : "text-muted"} />
                        <span className="flex-1 text-xs font-mono truncate">{r}</span>
                        {isActive && <span className="text-[10px] text-brand font-mono">aktif</span>}
                        <button onClick={() => removeRepo(r)} className="text-muted hover:text-red p-1 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
                <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">+ Depo Ekle</div>
                <div className="grid gap-2">
                  <input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="sahip/depo veya sahip/depo:dal" className="input-mono" onKeyDown={(e) => { if (e.key === "Enter") submitRepo(); }} />
                  <button onClick={submitRepo} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors"><Plus size={15} /> Depo Ekle</button>
                </div>
              </div>

              {/* Hesabındaki depolar — bağlı hesaptan otomatik gelir */}
              {(loadingAccountRepos || accountRepos.length > 0) && (
                <div className="mt-3 rounded-xl border border-line p-3.5 bg-bgsoft/50">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="text-xs font-bold text-muted uppercase tracking-wide">Hesabındaki depolar</div>
                    {accountRepos.length > 0 && (
                      <button
                        onClick={() => { accountRepos.forEach((r) => addRepo(r)); addToast(`${accountRepos.length} depo eklendi.`, "success"); setAccountRepos([]); }}
                        className="text-[11px] text-brand hover:underline font-semibold"
                      >
                        Tümünü ekle ({accountRepos.length})
                      </button>
                    )}
                  </div>
                  {loadingAccountRepos ? (
                    <div className="flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Depolar getiriliyor…</div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-auto">
                      {accountRepos.map((r) => (
                        <button
                          key={r}
                          onClick={() => { addRepo(r); setAccountRepos((prev) => prev.filter((x) => x !== r)); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line hover:border-brand bg-bg/40 text-left transition-colors"
                        >
                          <Plus size={12} className="text-brand shrink-0" />
                          <span className="flex-1 text-xs font-mono truncate">{r}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* GitLab Accounts */}
            <div>
              <h4 className="text-sm font-bold mb-1">GitLab Hesapları</h4>
              <p className="text-xs text-muted mb-2">GitLab personal access token ekle. Aktif hesap GitLab repolarına erişimde kullanılır.</p>
              {(config.gitlabAccounts ?? []).length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {(config.gitlabAccounts ?? []).map((a) => {
                    const isActive = config.activeGitlabId === a.id;
                    return (
                      <div key={a.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isActive ? "border-branddim bg-brand/10" : "border-line bg-bgsoft"}`}>
                        <button
                          onClick={() => setActiveGitlab(a.id)}
                          className={`w-5 h-5 rounded-full grid place-items-center border shrink-0 ${isActive ? "bg-brand border-brand text-white" : "border-muted"}`}
                        >
                          {isActive && <Check size={11} />}
                        </button>
                        <GitBranch size={13} className={isActive ? "text-brand" : "text-muted"} />
                        <span className="flex-1 text-sm font-semibold truncate">{a.username}</span>
                        {isActive && <span className="text-[10px] text-brand font-mono">aktif</span>}
                        <button onClick={() => removeGitlab(a.id)} className="text-muted hover:text-red p-1 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => connectGitOAuth("gitlab")}
                disabled={oauthBusy !== null}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 mb-3"
              >
                {oauthBusy === "gitlab" ? <Loader2 size={16} className="animate-spin" /> : <GitBranch size={16} />}
                GitLab ile bağlan
              </button>
              <div className="rounded-xl border border-line p-3.5 bg-bgsoft/50">
                <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">veya token ile ekle</div>
                <div className="grid gap-2">
                  <input value={glUser} onChange={(e) => setGlUser(e.target.value)} placeholder="Kullanıcı adı" className="input-mono" />
                  <input type="password" value={glToken} onChange={(e) => setGlToken(e.target.value)} placeholder="GitLab token (glpat-...)" className="input-mono" />
                  <button onClick={submitGitlab} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors"><Plus size={15} /> Hesap Ekle</button>
                </div>
              </div>
            </div>

            {/* CLI Mode */}
            <div>
              <h4 className="text-sm font-bold mb-2">CLI Modu</h4>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={config.cliMode} onChange={() => saveConfig({ ...config, cliMode: !config.cliMode })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Otomatik bağlantı</div>
                    <div className="text-xs text-muted mt-0.5">Coder sekmesi açılınca aktif depoyu otomatik olarak bağlar.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={config.autoTerminal} onChange={() => saveConfig({ ...config, autoTerminal: !config.autoTerminal })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Terminal panelini otomatik aç</div>
                    <div className="text-xs text-muted mt-0.5">Kapalıyken terminal yalnızca arkaplanda çalışır; komutlar ve çıktıları sohbette &quot;Terminal&quot; todo kutusunda görünür. Açıksa görünür panel de otomatik açılır.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={config.inlineCompletion !== false} onChange={() => saveConfig({ ...config, inlineCompletion: config.inlineCompletion === false })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Satır içi AI tamamlama</div>
                    <div className="text-xs text-muted mt-0.5">Editörde yazarken ghost-text önerisi (Tab ile kabul). Aktif modelin API kotasını kullanır.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-amber-400/50 transition-colors">
                  <input type="checkbox" checked={!!config.safeMode} onChange={() => saveConfig({ ...config, safeMode: !config.safeMode })} className="accent-amber-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Güvenli Mod (salt-okunur)</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken ajan HİÇBİR değişiklik yapamaz: yazma, silme, yeniden adlandırma, dal/PR ve komut araçları tamamen devre dışı. Yalnızca okuma, arama ve analiz. Değişiklik gerekirse kod bloğu olarak önerir. Composer&apos;daki ⋯ menüsünden de açılır.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.requireWriteApproval} onChange={() => saveConfig({ ...config, requireWriteApproval: !config.requireWriteApproval })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Yazma için onay iste</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken ajan dosyaları doğrudan commit etmez; değişiklikleri kod bloğu olarak önerir, sen commit arayüzüyle uygularsın.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.autoRunCommands} onChange={() => saveConfig({ ...config, autoRunCommands: !config.autoRunCommands })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Güvenli oto-çalıştır</div>
                    <div className="text-xs text-muted mt-0.5">AI&apos;nın önerdiği SADECE izin listesindeki komutlar (npm test, lint vb.) otomatik çalışır; çıktı AI&apos;ya beslenir → kendi hatasını düzeltir. Diğer komutlar elle.</div>
                  </div>
                </label>
                {config.autoRunCommands && (
                  <div className="ml-7 -mt-1">
                    <div className="text-xs text-muted mb-1">İzinli komutlar (her satıra bir önek):</div>
                    <textarea
                      value={(config.commandAllowlist ?? []).join("\n")}
                      onChange={(e) => saveConfig({ ...config, commandAllowlist: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                      rows={4}
                      className="input-mono !text-xs leading-relaxed w-full"
                      placeholder="npm test&#10;npm run lint&#10;npx tsc"
                    />
                  </div>
                )}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-amber-400/50 transition-colors">
                  <input type="checkbox" checked={config.commandGuard !== false} onChange={() => saveConfig({ ...config, commandGuard: config.commandGuard === false })} className="accent-amber-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Tehlikeli komut kalkanı</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken (varsayılan) ajanın çalıştırmak istediği <b>katastrofik</b> komutlar (<code>rm -rf /</code>, fork bomb, <code>mkfs</code>, <code>curl | sh</code>, sistem kapatma…) çalıştırılmadan engellenir ve ajana geri bildirilir. Normal komutlar (<code>npm test</code>, <code>rm -rf node_modules</code>…) etkilenmez.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.planApprovalMode} onChange={() => saveConfig({ ...config, planApprovalMode: !config.planApprovalMode })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Plan onay modu</div>
                    <div className="text-xs text-muted mt-0.5">Ajan önce bir plan sunar ve durur; değişiklik yapmaz. Sen &quot;Onayla &amp; Uygula&quot; deyince uygulamaya başlar.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input type="checkbox" checked={!!config.blockNetworkTools} onChange={() => saveConfig({ ...config, blockNetworkTools: !config.blockNetworkTools })} className="accent-brand mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Ağ erişimini engelle</div>
                    <div className="text-xs text-muted mt-0.5">Açıkken ajan internet araçlarını (web arama / sayfa okuma) kullanamaz. Gizlilik/güvenlik için.</div>
                  </div>
                </label>
                <ToolPermissions />
              </div>
            </div>

            {/* .rules dosyası */}
            <div>
              <h4 className="text-sm font-bold mb-1">.rules — Proje Kuralları</h4>
              <p className="text-xs text-muted mb-2">
                Coder&apos;da her istekte sistem promptuna eklenir. Teknoloji tercihlerin, kod stili, kısıtlamalar.
              </p>
              <textarea
                value={rulesFileDraft}
                onChange={(e) => setRulesFileDraft(e.target.value)}
                onBlur={() => saveConfig({ ...config, rulesFile: rulesFileDraft })}
                rows={5}
                placeholder={"Örn:\n- TypeScript strict mode kullan\n- Tailwind CSS tercih et\n- Yorum satırı yazma\n- Her fonksiyon max 20 satır"}
                className="input-mono !text-xs leading-relaxed w-full"
              />
            </div>
          </section>
        )}

        {/* GENEL */}
        {tab === "general" && (
          <section className="flex flex-col gap-5">
            {/* ✦ Otomatik Pilot — en başta: "her şeyi benim yerime hallet" anahtarı.
               Admin dışı hesaplarda HER ZAMAN açık (kapatma anahtarı yok — Claude
               gibi tam otomatik); yalnız admin Ayarlar'dan kapatıp elle yönetebilir. */}
            <div>
              <h4 className="text-sm font-bold mb-2">Otomatik Pilot</h4>
              {isAdmin ? (
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-brand/30 bg-brand/8 hover:border-brand/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.autoPilot !== false}
                    onChange={() => saveConfig({ ...config, autoPilot: config.autoPilot === false })}
                    className="accent-brand"
                  />
                  <div>
                    <div className="text-sm font-semibold">✦ Otomatik Pilot <span className="text-[10px] font-bold uppercase tracking-wider text-brand/70">önerilen</span></div>
                    <div className="text-xs text-muted mt-0.5 leading-relaxed">
                      Craft; ne kadar düşüneceğine, internette arama yapıp yapmayacağına ve kalite
                      turuna mesajına bakarak kendisi karar verir. Hiçbir ayara dokunmana gerek kalmaz.
                      Sen bir modu elle açarsan o her zaman öncelikli olur.
                    </div>
                  </div>
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-brand/30 bg-brand/8">
                  <Check size={16} className="text-brand shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">✦ Otomatik Pilot her zaman açık</div>
                    <div className="text-xs text-muted mt-0.5 leading-relaxed">
                      Craft; ne kadar düşüneceğine, internette arama yapıp yapmayacağına ve kalite
                      turuna mesajına bakarak kendisi karar verir. Hiçbir ayara dokunmana gerek yok.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ajan Davranışı — her gün etkileyen davranış anahtarları (açıklamalı) */}
            <div>
              <h4 className="text-sm font-bold mb-2">Davranış</h4>
              <div className="flex flex-col gap-2">
                {[
                  { on: config.webSearch, toggle: () => saveConfig({ ...config, webSearch: !config.webSearch }),
                    title: "İnternette arama", desc: "Güncel bilgi gereken sorularda (döviz, haber, fiyat…) en yeni veriyi internetten çeker." },
                  { on: config.autoMemory !== false, toggle: () => saveConfig({ ...config, autoMemory: config.autoMemory === false }),
                    title: "Otomatik hatırlama", desc: "Tercihlerini (ör. hangi dili sevdiğin) kendiliğinden not eder, sonraki sohbetlerde hatırlar." },
                  { on: config.qualityMode, toggle: () => saveConfig({ ...config, qualityMode: !config.qualityMode }),
                    title: "Kalite modu", desc: "Yanıtı önce taslak, sonra öz-eleştiri ve düzeltmeyle üretir — daha doğru, biraz daha yavaş." },
                  { on: config.autoContinue !== false, toggle: () => saveConfig({ ...config, autoContinue: config.autoContinue === false }),
                    title: "Kesilince otomatik sürdür", desc: "Uzun yanıt sınıra takılıp yarıda kalırsa kaldığı yerden kendiliğinden devam eder." },
                  { on: config.agentsUseStrongestModel !== false, toggle: () => saveConfig({ ...config, agentsUseStrongestModel: config.agentsUseStrongestModel === false }),
                    title: "Zor işlerde en güçlü modeli kullan", desc: "Ajan ekibi çalışırken en yetenekli (anahtarı olan) modeli seçer — daha iyi sonuç, biraz daha maliyet." },
                  { on: !!config.learningMode, toggle: () => saveConfig({ ...config, learningMode: !config.learningMode }),
                    title: "Öğrenme Modu", desc: "Yanıtlar adım adım, kavramları açıklayarak verilir — üniversite/öğrenme amaçlı kullanım için." },
                ].map((it) => (
                  <label key={it.title} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                    <input type="checkbox" checked={!!it.on} onChange={it.toggle} className="accent-brand mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="text-sm font-semibold block">{it.title}</span>
                      <span className="text-xs text-muted mt-0.5 leading-relaxed block">{it.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Görünüm — tema + vurgu rengi + yazı boyutu tek grupta */}
            {/* Tema */}
            <div>
              <h4 className="text-sm font-bold mb-2">Tema</h4>
              <button onClick={toggleTheme} disabled={!!config.autoTheme} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm disabled:opacity-50 w-full">
                {config.theme === "dark" ? <><Moon size={15} /> Koyu tema</> : <><Sun size={15} /> Açık tema</>}
                <span className="text-muted ml-auto text-xs">Değiştir</span>
              </button>
              <label className="flex items-center gap-2 mt-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={!!config.autoTheme} onChange={() => saveConfig({ ...config, autoTheme: !config.autoTheme })} className="accent-brand" />
                Sistem temasını izle (işletim sistemine göre otomatik)
              </label>
            </div>

            {/* Vurgu rengi */}
            <div>
              <h4 className="text-sm font-bold mb-2">Vurgu Rengi</h4>
              <div className="flex gap-2">
                {([
                  { k: "amber",  label: "Amber",   color: "bg-[#c8a87e]" },
                  { k: "green",  label: "Yeşil",   color: "bg-[#3ddc84]" },
                  { k: "orange", label: "Turuncu", color: "bg-[#f97316]" },
                ] as { k: "amber" | "green" | "orange"; label: string; color: string }[]).map(({ k, label, color }) => (
                  <button
                    key={k}
                    onClick={() => {
                      saveConfig({ ...config, accentColor: k });
                      const cls = document.documentElement.classList;
                      cls.remove("accent-amber", "accent-green", "accent-orange");
                      cls.add(`accent-${k}`);
                    }}
                    className={`flex-1 py-2 rounded-lg border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                      config.accentColor === k ? "border-branddim bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Yazı tipi boyutu */}
            <div>
              <h4 className="text-sm font-bold mb-2">Yazı Boyutu</h4>
              <div className="flex gap-2">
                {(["sm", "base", "lg"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      saveConfig({ ...config, fontScale: s });
                      document.documentElement.className = document.documentElement.className
                        .replace(/font-\w+/g, "")
                        .concat(` font-${s}`);
                    }}
                    className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                      config.fontScale === s ? "border-branddim bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {s === "sm" ? "Küçük" : s === "base" ? "Normal" : "Büyük"}
                  </button>
                ))}
              </div>
            </div>

            {/* Bildirimler */}
            <div>
              <h4 className="text-sm font-bold mb-2">Bildirimler</h4>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.soundEnabled}
                    onChange={() => saveConfig({ ...config, soundEnabled: !config.soundEnabled })}
                    className="accent-brand"
                  />
                  <div>
                    <div className="text-sm font-semibold">Ses bildirimi</div>
                    <div className="text-xs text-muted mt-0.5">Yanıt tamamlanınca kısa bir bip sesi çalar.</div>
                  </div>
                </label>
                <button
                  onClick={async () => {
                    if (!("Notification" in window)) { addToast("Bu tarayıcı bildirimleri desteklemiyor.", "error"); return; }
                    const perm = await Notification.requestPermission();
                    if (perm === "granted") addToast("Bildirimler açık — sekme arka plandayken uyarı alacaksın.", "success");
                    else addToast("Bildirim izni verilmedi.", "error");
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-line bg-bgsoft hover:border-brand/40 text-sm text-left transition-colors"
                >
                  <span className="text-lg">🔔</span>
                  <div>
                    <div className="text-sm font-semibold">Tarayıcı bildirimi aç</div>
                    <div className="text-xs text-muted mt-0.5">Sekme arka planda iken yanıt hazır olunca bildirim gelir.</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Yedekle / geri yükle */}
            <div>
              <h4 className="text-sm font-bold mb-2">Yedek</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const s = useStore.getState();
                    const data = JSON.stringify({ version: 1, exportedAt: Date.now(), config: s.config, chats: s.chats }, null, 2);
                    const blob = new Blob([data], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `craftcoder-yedek-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click(); URL.revokeObjectURL(url);
                    addToast("Yedek indirildi (ayarlar + sohbetler)", "success");
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm"
                >
                  <Download size={14} /> Yedek indir
                </button>
                <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm cursor-pointer">
                  <Upload size={14} /> Geri yükle
                  <input
                    type="file" accept="application/json" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const data = JSON.parse(await file.text());
                        if (!confirm("Bu yedek MEVCUT ayarlarının ve sohbetlerinin yerine geçecek. Devam edilsin mi?")) { e.target.value = ""; return; }
                        useStore.getState().importBackup({ config: data.config, chats: data.chats });
                        addToast("Yedek geri yüklendi ✓", "success");
                      } catch { addToast("Geçersiz yedek dosyası", "error"); }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted/60 mt-1.5">API anahtarları da dahil — dosyayı güvende tut.</p>
            </div>

            {/* Yanıt stili */}
            <div>
              <h4 className="text-sm font-bold mb-2">Yanıt Stili</h4>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.entries(STYLE_LABELS) as [ResponseStyle, typeof STYLE_LABELS.normal][]).map(([k, v]) => (
                  <button key={k} onClick={() => saveConfig({ ...config, style: k, activeCustomStyleId: null })} className={`text-xs px-3 py-2 rounded-lg border ${config.style === k && !config.activeCustomStyleId ? "border-branddim bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>{v.label}</button>
                ))}
              </div>
              {/* Özel stiller */}
              {(config.customStyles ?? []).length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {(config.customStyles ?? []).map((cs) => (
                    <div key={cs.id} className={`group relative text-xs px-3 py-2 rounded-lg border cursor-pointer ${config.activeCustomStyleId === cs.id ? "border-branddim bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}
                      onClick={() => saveConfig({ ...config, activeCustomStyleId: cs.id, style: "normal" })} title={cs.instructions}>
                      <span className="truncate block pr-3">{cs.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = (config.customStyles ?? []).filter((s) => s.id !== cs.id);
                          saveConfig({ ...config, customStyles: next, activeCustomStyleId: config.activeCustomStyleId === cs.id ? null : config.activeCustomStyleId });
                        }}
                        className="absolute top-1 right-1 text-muted/50 hover:text-red opacity-0 group-hover:opacity-100" title="Stili sil"
                      ><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
              {!styleFormOpen ? (
                <button onClick={() => setStyleFormOpen(true)} className="text-xs text-brand hover:underline mt-2">+ Kendi stilini oluştur</button>
              ) : (
                <div className="mt-2 p-3 rounded-lg border border-line bg-bgsoft/50 flex flex-col gap-2">
                  <input value={styleName} onChange={(e) => setStyleName(e.target.value)} placeholder="Stil adı (ör. 'Samimi & Kısa')" className="input-mono !py-1.5 text-xs" />
                  <textarea value={styleInstr} onChange={(e) => setStyleInstr(e.target.value)} rows={3} placeholder="Stil talimatları (ör. 'Kısa cümleler, samimi ton, teknik jargondan kaçın, emoji kullan')" className="input-mono !text-xs" />
                  <details className="text-[11px] text-muted">
                    <summary className="cursor-pointer hover:text-ink">Örnek metinden AI ile türet</summary>
                    <textarea value={styleSample} onChange={(e) => setStyleSample(e.target.value)} rows={3} placeholder="Kendi yazım tarzından bir örnek metin yapıştır…" className="input-mono !text-xs mt-1.5" />
                    <button
                      disabled={deriving || !styleSample.trim()}
                      onClick={async () => {
                        if (!styleSample.trim() || deriving) return;
                        setDeriving(true);
                        try {
                          const out = await quickComplete(
                            styleSample.slice(0, 4000),
                            "Sen bir yazı stili analistisin. Kullanıcının örnek metnindeki yazım stilini (ton, cümle uzunluğu, biçimsellik, kelime seçimi, emoji/biçim kullanımı) çıkar ve bir AI'nın AYNI stilde yazması için KISA ve net maddeli TALİMATLAR yaz. Yalnızca talimatları döndür — başka açıklama yazma. Türkçe yaz.",
                          );
                          if (out.trim()) setStyleInstr(out.trim());
                          else addToast("Stil türetilemedi — tekrar dene.", "error");
                        } catch (e) { addToast(`Türetme hatası: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error"); }
                        finally { setDeriving(false); }
                      }}
                      className="mt-1.5 text-xs px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink disabled:opacity-40 flex items-center gap-1.5"
                    >{deriving ? <Loader2 size={12} className="animate-spin" /> : "✨"} Örnekten türet</button>
                  </details>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setStyleFormOpen(false); setStyleName(""); setStyleInstr(""); setStyleSample(""); }} className="text-xs px-3 py-1.5 rounded-lg text-muted hover:text-ink">İptal</button>
                    <button
                      onClick={() => {
                        const name = styleName.trim(); const instr = styleInstr.trim();
                        if (!name || !instr) { addToast("İsim ve talimat gerekli.", "error"); return; }
                        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                        saveConfig({ ...config, customStyles: [...(config.customStyles ?? []), { id, name, instructions: instr }], activeCustomStyleId: id, style: "normal" });
                        setStyleFormOpen(false); setStyleName(""); setStyleInstr(""); setStyleSample("");
                        addToast("Özel stil kaydedildi ve etkinleştirildi.", "success");
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white font-semibold"
                    >Kaydet</button>
                  </div>
                </div>
              )}
            </div>

            {/* Bellek */}
            <div>
              <h4 className="text-sm font-bold mb-1">Bellek</h4>
              <p className="text-xs text-muted mb-2">Sohbetler arası hatırlanmasını istediğin bilgileri ekle.</p>
              {config.memories.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {config.memories.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bgsoft border border-line text-xs">
                      <Brain size={12} className="text-brand shrink-0" />
                      <span className="flex-1 truncate">{m.content}</span>
                      <button onClick={() => removeMemory(m.id)} className="text-muted hover:text-red"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={memInput} onChange={(e) => setMemInput(e.target.value)} placeholder="Örn: Python tercih ederim" className="input-mono !py-1.5 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter") { if (memInput.trim()) { addMemory(memInput.trim()); setMemInput(""); } } }} />
                <button onClick={() => { if (memInput.trim()) { addMemory(memInput.trim()); setMemInput(""); } }} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white font-semibold shrink-0">Ekle</button>
              </div>
              {/* Otomatik hatırlananlar: ajanın konuşmalardan damıttığı kalıcı bilgiler (düzenle/sil). */}
              {(() => {
                const facts = ((config.skills ?? []).find((s) => s.id === "auto_memory")?.content ?? "")
                  .split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim()).filter(Boolean);
                if (facts.length === 0) return null;
                return (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-muted/80 mb-1.5 flex items-center gap-1"><Brain size={11} className="text-brand" /> Otomatik hatırlananlar ({facts.length})</p>
                    <div className="flex flex-col gap-1">
                      {facts.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bgsoft/60 border border-line/60 text-xs">
                          <span className="flex-1 truncate" title={f}>{f}</span>
                          <button onClick={() => setAutoMemoryFacts(facts.filter((_, j) => j !== i))} className="text-muted hover:text-red shrink-0" title="Sil"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Proje promptu */}
            {activeProj && (
              <div>
                <h4 className="text-sm font-bold mb-1">Proje Promptu: {activeProj.name}</h4>
                <textarea value={activeProj.systemPrompt} onChange={(e) => updateProject(activeProj.id, { systemPrompt: e.target.value })} rows={3} className="input-mono !text-xs" placeholder="Bu projenin için özel sistem promptu..." />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <label className="text-xs">
                    <span className="text-muted block mb-1">Model</span>
                    <select
                      value={activeProj.modelId ?? ""}
                      onChange={(e) => updateProject(activeProj.id, { modelId: e.target.value || undefined })}
                      className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="">Varsayılan</option>
                      {config.models.map((m) => (
                        <option key={m.id} value={m.id}>{m.label || m.model}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="text-muted block mb-1">Sıcaklık</span>
                    <input
                      type="number" min={0} max={2} step={0.1}
                      value={activeProj.temperature ?? ""}
                      onChange={(e) => updateProject(activeProj.id, { temperature: e.target.value === "" ? undefined : Number(e.target.value) })}
                      placeholder="varsayılan"
                      className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted block mb-1">Max token</span>
                    <input
                      type="number" min={1} step={256}
                      value={activeProj.maxTokens ?? ""}
                      onChange={(e) => updateProject(activeProj.id, { maxTokens: e.target.value === "" ? undefined : Number(e.target.value) })}
                      placeholder="varsayılan"
                      className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Sistem promptu */}
            <div>
              <h4 className="text-sm font-bold mb-1">Sistem Promptu</h4>
              <textarea value={systemPromptDraft} onChange={(e) => setSystemPromptDraft(e.target.value)} onBlur={() => saveConfig({ ...config, systemPrompt: systemPromptDraft })} rows={4} className="input-mono !text-xs leading-relaxed" />
              <button onClick={() => { saveConfig({ ...config, systemPrompt: DEFAULT_SYSTEM_PROMPT }); setSystemPromptDraft(DEFAULT_SYSTEM_PROMPT); }} className="text-xs text-muted hover:text-brand mt-1">Varsayılana sıfırla</button>
            </div>

            {/* Bağlam limiti */}
            <div>
              <h4 className="text-sm font-bold mb-1">Bağlam Penceresi</h4>
              <p className="text-xs text-muted mb-2 leading-relaxed">Modelin bir seferde ne kadar geçmişi (token) hatırlayacağı. Yükseği daha fazla bağlam demektir ama maliyeti artırır; modelin gerçek sınırının üstüne çıkmak fark etmez. Emin değilsen varsayılanda bırak.</p>
              <select value={config.maxContext} onChange={(e) => saveConfig({ ...config, maxContext: Number(e.target.value) })} className="input-mono text-xs">
                {[4096, 8192, 16384, 32768, 65536, 131072, 200000, 400000, 1000000, 2000000].map((n) => (
                  <option key={n} value={n}>{n >= 1000000 ? `${(n / 1000000).toFixed(0)}M token` : `${(n / 1024).toFixed(0)}K token`}</option>
                ))}
              </select>
            </div>

            {/* Kısayollar */}
            <div>
              <h4 className="text-sm font-bold mb-2">Klavye Kısayolları</h4>
              <div className="grid gap-1.5 text-xs">
                {[["Ctrl + N", "Yeni sohbet"], ["Ctrl + Shift + N", "Gizli sohbet"], ["Ctrl + ,", "Ayarlar"]].map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-3">
                    <kbd className="px-2 py-0.5 rounded bg-bgsoft border border-line font-mono text-[11px] text-muted">{key}</kbd>
                    <span className="text-muted">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* GELİŞMİŞ */}
        {tab === "advanced" && (
          <section className="flex flex-col gap-5">
            {/* Hata-sıfır programı: bu oturumda yakalanan istemci hataları
               (yalnız cihazda, telemetri yok) — teşhis için kopyala/temizle. */}
            <div>
              <h4 className="text-sm font-bold mb-2">Son hatalar (bu oturum)</h4>
              {(() => {
                const errs = readErrors();
                if (errs.length === 0) {
                  return <p className="text-xs text-muted/60">✓ Bu oturumda yakalanan istemci hatası yok.</p>;
                }
                return (
                  <div className="rounded-xl border border-line bg-bgsoft/50 p-2 space-y-1 max-h-48 overflow-y-auto">
                    {errs.map((e, i) => (
                      <div key={i} className="text-[11px] font-mono text-red/90 break-words">
                        <span className="text-muted/50">{new Date(e.ts).toLocaleTimeString("tr-TR")} {e.source ? `[${e.source}] ` : ""}</span>
                        {e.message}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { navigator.clipboard.writeText(JSON.stringify(errs, null, 2)).catch(() => { /* yok */ }); addToast("Hatalar panoya kopyalandı.", "success"); }}
                        className="text-[11px] px-2 py-1 rounded-lg border border-line text-muted hover:text-ink"
                      >Kopyala</button>
                      <button
                        onClick={() => { clearErrors(); addToast("Hata günlüğü temizlendi.", "success"); setErrTick((t) => t + 1); }}
                        className="text-[11px] px-2 py-1 rounded-lg border border-line text-muted hover:text-red"
                      >Temizle</button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Guest mode */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestMode}
                  onChange={(e) => {
                    setGuestModeState(e.target.checked);
                    setGuestMode(e.target.checked);
                    addToast(
                      e.target.checked
                        ? "Misafir mod açık — anahtarlar sekme kapanınca silinir. Yenile."
                        : "Misafir mod kapalı — yenile.",
                      "info",
                    );
                  }}
                  className="accent-brand mt-0.5"
                />
                <span>
                  <span className="text-sm font-semibold block">Misafir mod</span>
                  <span className="text-xs text-muted/70 leading-relaxed">
                    Açıkken API anahtarları ve GitHub token&apos;ları yalnızca bu sekmede saklanır
                    (sessionStorage), sekme kapanınca silinir. Paylaşılan bilgisayarlarda öner.
                    Değişiklikten sonra sayfayı yenile.
                  </span>
                </span>
              </label>
            </div>

            {/* WebContainer API key — yalnız admin */}
            {isAdmin && (
            <div>
              <h4 className="text-sm font-bold mb-1">WebContainer API Key</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Gerçek terminal için gerekli. <strong className="text-muted">localhost&apos;ta gerekmez</strong>;
                production domain&apos;de (Vercel vb.){" "}
                <a href="https://webcontainer.io/enterprise" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  webcontainer.io
                </a>
                {" "}üzerinden bireysel/OSS hesaplara ücretsiz verilen key&apos;i buraya yapıştır.
                Key tarayıcında saklanır, sunucuya gönderilmez.
              </p>
              <input
                type="password"
                value={config.webcontainerApiKey}
                onChange={(e) => saveConfig({ ...config, webcontainerApiKey: e.target.value })}
                placeholder="wc_..."
                className="input-mono w-full"
                autoComplete="off"
              />
            </div>
            )}

            {/* Hassas sunucu/terminal ayarları — yalnız admin görür (yeni kullanıcılar gizli) */}
            {isAdmin && (
            <>
            {/* Hibrit Sunucu — tek adres hem terminal hem dosya sistemi kurar */}
            <div>
              <h4 className="text-sm font-bold mb-1 flex items-center gap-1.5">🔗 Hibrit Sunucu <span className="text-[10px] font-normal text-brand/80 bg-brand/10 px-1.5 py-0.5 rounded">tek adres</span></h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Oracle/sunucu kurulumunun verdiği{" "}
                <code className="text-brand/80 bg-bgsoft px-1 rounded text-[11px]">wss://…/?token=…</code>{" "}
                adresini buraya yapıştır → <strong className="text-muted">terminal + gerçek dosya sistemi</strong> birlikte kurulur (aşağıdaki alanlar otomatik dolar).
                <br />
                <span className="text-muted/50 text-[11px]">Kurulum: <code className="bg-bgsoft px-1 rounded">deploy/oracle/setup.sh</code> — repo bağlamadan, mobil Safari/Firefox dahil çalışır.</span>
              </p>
              <input
                type="text"
                value={config.terminalWsUrl ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  let host = "", token = "", ws = "wss", http = "https";
                  try {
                    const u = new URL(v);
                    host = u.host;
                    token = u.searchParams.get("token") || "";
                    if (u.protocol === "ws:" || u.protocol === "http:") { ws = "ws"; http = "http"; }
                  } catch { /* tam URL değil — yalnızca terminal alanına yaz */ }
                  if (host) {
                    saveConfig({ ...config, terminalWsUrl: `${ws}://${host}/${token ? "?token=" + token : ""}`, localMode: true, localBridgeUrl: `${http}://${host}`, localBridgeToken: token });
                  } else {
                    saveConfig({ ...config, terminalWsUrl: v });
                  }
                }}
                placeholder="wss://<alan>.sslip.io/?token=..."
                className="input-mono w-full"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Bağlantı testi — /health ucuna vurup terminal + dosya sistemi hazır mı gösterir */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={testBridge}
                  disabled={bridgeTest.status === "testing"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-brand text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {bridgeTest.status === "testing"
                    ? <><Loader2 size={12} className="animate-spin" /> Test ediliyor…</>
                    : <><Play size={12} /> Bağlantıyı test et</>}
                </button>
                {bridgeTest.status === "ok" && (
                  <span className="flex items-center gap-1.5 text-xs text-green">
                    <Check size={13} /> Bağlı{bridgeTest.terminal ? " — terminal + dosya sistemi hazır" : ""}
                    {bridgeTest.root && <code className="text-[10px] text-muted/60 bg-bgsoft px-1 rounded">{bridgeTest.root}</code>}
                  </span>
                )}
                {bridgeTest.status === "fail" && (
                  <span className="flex items-center gap-1.5 text-xs text-red">
                    <X size={13} /> {bridgeTest.message}
                  </span>
                )}
              </div>
            </div>

            {/* Terminal WebSocket URL */}
            <div>
              <h4 className="text-sm font-bold mb-1">Terminal Sunucusu (WebSocket)</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Kendi Linux sunucunu veya Oracle Cloud ücretsiz VM&apos;ini bağla.{" "}
                <strong className="text-muted">Boş bırakırsan</strong> WebContainer sandbox kullanılır.
                <br />
                Örnek:{" "}
                <code className="text-brand/80 bg-bgsoft px-1 rounded text-[11px]">wss://sunucu-ip:7071?token=SIFRE</code>
                <br />
                <span className="text-muted/50 text-[11px]">
                  Kendi bilgisayarın için hazır ücretsiz köprü:{" "}
                  <code className="bg-bgsoft px-1 rounded">scripts/terminal-bridge/</code> (README&apos;ye bak) →{" "}
                  <code className="bg-bgsoft px-1 rounded text-[11px]">ws://localhost:7777/?token=...</code>
                </span>
              </p>
              <input
                type="text"
                value={config.terminalWsUrl ?? ""}
                onChange={(e) => saveConfig({ ...config, terminalWsUrl: e.target.value.trim() })}
                placeholder="ws://localhost:7777/?token=..."
                className="input-mono w-full"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Otomasyon: bağlanınca çalışacak kurulum komutu (SessionStart) */}
              <h4 className="text-sm font-bold mt-4 mb-1">Bağlanınca kurulum komutu</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Terminal her bağlandığında otomatik çalışır (Claude Code&apos;un SessionStart&apos;ı gibi).
                Örn. <code className="text-brand/80 bg-bgsoft px-1 rounded text-[11px]">npm install &amp;&amp; npm run dev</code>.
                Boş bırakırsan hiçbir şey çalışmaz.
              </p>
              <input
                type="text"
                value={config.terminalSetupCommand ?? ""}
                onChange={(e) => saveConfig({ ...config, terminalSetupCommand: e.target.value })}
                placeholder="npm install && npm run dev"
                className="input-mono w-full"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            </>
            )}

            {/* Otomasyonlar (olaya bağlı komutlar — Claude Code hooks benzeri) */}
            <div>
              <h4 className="text-sm font-bold mb-1 flex items-center gap-1.5"><Zap size={14} className="text-brand" /> Otomasyonlar</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Belirli bir olayda terminalde otomatik komut çalıştır.{" "}
                <strong className="text-muted">Dosya yazınca</strong> = ajan kod yazdığında,{" "}
                <strong className="text-muted">Yanıttan sonra</strong> = her yanıtın ardından. Terminal bağlı olmalı.
                {" "}<strong className="text-amber-400">Dikkat:</strong> buraya yazdığın komutlar gerçekten çalışır — yalnızca güvendiğin komutları ekle.
              </p>
              <div className="space-y-2">
                {(config.automations ?? []).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 bg-bgsoft border border-line/60 rounded-lg px-2 py-2">
                    <input
                      type="checkbox"
                      checked={a.enabled}
                      onChange={(e) => saveConfig({ ...config, automations: (config.automations ?? []).map((x) => x.id === a.id ? { ...x, enabled: e.target.checked } : x) })}
                      className="accent-brand shrink-0"
                      title="Etkin"
                    />
                    <select
                      value={a.event}
                      onChange={(e) => saveConfig({ ...config, automations: (config.automations ?? []).map((x) => x.id === a.id ? { ...x, event: e.target.value as import("@/lib/types").Automation["event"] } : x) })}
                      className="bg-bg border border-line rounded-md px-1.5 py-1 text-xs outline-none shrink-0"
                    >
                      <option value="afterWrite">Dosya yazınca</option>
                      <option value="afterResponse">Yanıttan sonra</option>
                      <option value="preToolUse">Araç öncesi</option>
                      <option value="postToolUse">Araç sonrası</option>
                      <option value="onStop">Tur bitince</option>
                    </select>
                    <input
                      value={a.command}
                      onChange={(e) => saveConfig({ ...config, automations: (config.automations ?? []).map((x) => x.id === a.id ? { ...x, command: e.target.value } : x) })}
                      placeholder="npm test"
                      className="input-mono flex-1 min-w-0 text-xs py-1"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      onClick={() => saveConfig({ ...config, automations: (config.automations ?? []).filter((x) => x.id !== a.id) })}
                      className="text-muted hover:text-red p-1 shrink-0"
                      title="Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => saveConfig({ ...config, automations: [...(config.automations ?? []), { id: crypto.randomUUID(), name: "Otomasyon", event: "afterWrite", command: "", enabled: true }] })}
                className="mt-2 flex items-center justify-center gap-1.5 py-2 w-full rounded-xl border border-line hover:border-brand text-sm font-semibold transition-colors"
              >
                <Plus size={15} /> Otomasyon Ekle
              </button>
            </div>

            {isAdmin && (
            <>
            {/* Yerel Mod (Local Bridge) */}
            <div>
              <h4 className="text-sm font-bold mb-1">🖥️ Yerel Mod (Local Bridge)</h4>
              <p className="text-xs text-muted/70 mb-2 leading-relaxed">
                Açıkken ajan GitHub/GitLab API yerine{" "}
                <strong className="text-muted">gerçek dosya sistemine ve kabuğa</strong>{" "}
                erişir (Claude Code gibi). İki yol:
                <br />
                • <strong className="text-muted">Hibrit sunucu</strong> (Oracle/VPS): yukarıdaki tek adresi yapıştırınca otomatik dolar — mobil dahil her yerden çalışır.
                <br />
                • <strong className="text-muted">Kendi bilgisayarın</strong> (yerelde):{" "}
                <code className="text-brand/80 bg-bgsoft px-1 rounded text-[11px]">cd local-bridge &amp;&amp; BRIDGE_TOKEN=gizli WORK_DIR=/proje node server.js</code>
                <br />
                <span className="text-muted/50 text-[11px]">Token her zaman zorunlu. Public sunucuda HTTPS (Caddy) arkasında çalıştır.</span>
              </p>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={!!config.localMode}
                  onChange={(e) => saveConfig({ ...config, localMode: e.target.checked })}
                  className="accent-brand"
                />
                <span className="text-sm">Yerel Mod&apos;u etkinleştir (repo işlemleri köprüye gider)</span>
              </label>
              <input
                type="text"
                value={config.localBridgeUrl ?? ""}
                onChange={(e) => saveConfig({ ...config, localBridgeUrl: e.target.value.trim() })}
                placeholder="http://localhost:4319"
                className="input-mono w-full mb-2"
                autoComplete="off"
                spellCheck={false}
              />
              <input
                type="password"
                value={config.localBridgeToken ?? ""}
                onChange={(e) => saveConfig({ ...config, localBridgeToken: e.target.value })}
                placeholder="Köprü token'ı (BRIDGE_TOKEN)"
                className="input-mono w-full"
                autoComplete="off"
              />
            </div>
            </>
            )}

            {/* İstatistikler */}
            <div>
              <h4 className="text-sm font-bold mb-2">İstatistikler & Harcama</h4>
              {(() => {
                const totalIn = chats.reduce((n, c) => n + (c.totalInTokens ?? 0), 0);
                const totalOut = chats.reduce((n, c) => n + (c.totalOutTokens ?? 0), 0);
                const activeModel = config.models.find((m) => m.id === config.activeModelId);
                const totalCost = activeModel ? calculateCost(activeModel.model, totalIn, totalOut) : null;
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Toplam Oturum", value: chats.length },
                      { label: "Toplam Mesaj", value: chats.reduce((n, c) => n + c.messages.length, 0) },
                      { label: "Giriş Token", value: totalIn.toLocaleString() },
                      { label: "Çıkış Token", value: totalOut.toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-bgsoft border border-line rounded-xl px-3 py-2.5">
                        <div className="text-xs text-muted">{label}</div>
                        <div className="text-lg font-bold mt-0.5">{value}</div>
                      </div>
                    ))}
                    {totalCost !== null && (
                      <div className="col-span-2 bg-brand/5 border border-brand/20 rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted">Tahmini API Maliyeti</div>
                          <div className="text-xs text-muted/60 mt-0.5">(aktif model · tüm oturumlar)</div>
                        </div>
                        <div className="text-xl font-bold text-brand">{formatCost(totalCost)}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {/* MCP */}
        {tab === "mcp" && (
          <section className="space-y-5">
            <div>
              <h4 className="text-sm font-bold mb-1">MCP Sunucuları</h4>
              <p className="text-xs text-muted mb-3">Model Context Protocol — AI&apos;ya harici araçlar bağla (veritabanı, dosya sistemi, API vb.). Sunucu JSON-RPC 2.0 üzerinden HTTP ile erişilebilir olmalı.</p>

              {(config.mcpServers ?? []).length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  {(config.mcpServers ?? []).map((srv) => (
                    <div key={srv.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-bgsoft">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{srv.name}</div>
                        <div className="text-xs text-muted font-mono truncate">{srv.url}</div>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={srv.enabled}
                          onChange={() => updateMcpServer(srv.id, { enabled: !srv.enabled })}
                          className="accent-brand"
                        />
                        Aktif
                      </label>
                      <button
                        onClick={async () => {
                          setMcpTesting(srv.id);
                          try {
                            const res = await fetch("/api/mcp", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "list", server: { url: srv.url, headers: srv.headers } }),
                            });
                            const data = await res.json() as { tools?: { name: string }[]; error?: string };
                            if (data.tools) addToast(`${data.tools.length} araç bulundu`, "success");
                            else addToast(data.error ?? "Bağlanamadı", "error");
                          } catch { addToast("Bağlantı hatası", "error"); }
                          finally { setMcpTesting(null); }
                        }}
                        disabled={mcpTesting === srv.id}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-brand hover:border-brand transition-colors disabled:opacity-50"
                      >
                        {mcpTesting === srv.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      </button>
                      <button onClick={() => removeMcpServer(srv.id)} className="text-muted hover:text-red/80 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border border-line/60 rounded-xl p-3 bg-bgsoft/40">
                <div className="text-xs font-semibold text-muted mb-2">Yeni Sunucu Ekle</div>
                <input value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="Sunucu adı (örn. My DB Tools)" className="input-mono w-full" />
                <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="URL (örn. http://localhost:3001)" className="input-mono w-full" />
                <div className="flex gap-2">
                  <input value={mcpHeaderKey} onChange={(e) => setMcpHeaderKey(e.target.value)} placeholder="Header adı (opsiyonel)" className="input-mono flex-1" />
                  <input value={mcpHeaderVal} onChange={(e) => setMcpHeaderVal(e.target.value)} placeholder="Değer" className="input-mono flex-1" />
                </div>
                <button
                  onClick={() => {
                    if (!mcpName.trim() || !mcpUrl.trim()) { addToast("Ad ve URL zorunlu.", "error"); return; }
                    const headers: Record<string, string> = {};
                    if (mcpHeaderKey.trim()) headers[mcpHeaderKey.trim()] = mcpHeaderVal.trim();
                    addMcpServer({ name: mcpName.trim(), url: mcpUrl.trim(), headers: Object.keys(headers).length ? headers : undefined, enabled: true });
                    setMcpName(""); setMcpUrl(""); setMcpHeaderKey(""); setMcpHeaderVal("");
                    addToast("MCP sunucusu eklendi.", "success");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-branddim transition-colors"
                >
                  <Plus size={14} /> Ekle
                </button>
              </div>
            </div>

            <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl text-xs text-muted space-y-1.5">
              <div className="font-semibold text-brand">MCP nedir?</div>
              <p>Model Context Protocol, Anthropic tarafından geliştirilen bir standarttır. Kendi araçlarını (veritabanı sorgu, dosya okuma, API çağrısı vb.) Craft&apos;a bağlayarak AI&apos;ın bunları otomatik kullanmasını sağlar.</p>
              <p>Aktif sunucuların araçları, araç kullanımı açıkken her sohbette AI&apos;a sunulur.</p>
            </div>
          </section>
        )}

        {/* Hooks — olay kancaları */}
        {tab === "hooks" && (
          <section className="space-y-5">
            <div>
              <h4 className="text-sm font-bold mb-1">Olay Kancaları</h4>
              <p className="text-xs text-muted mb-3">Ajan bir turu bitirince otomatik kabuk komutu çalıştır. <b>Düzenleme sonrası</b> kancalarının çıktısı ajana geri beslenir → lint/test/tip hatalarını kendi kendine düzeltir (Claude Code &quot;hooks&quot; mantığı). <b>Bitişte</b> ve <b>Hata olunca</b> kancaları yalnız bildirir (geri besleme yok; Yerel Mod köprüsü gerekir).</p>

              {(config.hooks ?? []).length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  {(config.hooks ?? []).map((h) => (
                    <div key={h.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-bgsoft">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${h.event === "afterEdit" ? "bg-brand/15 text-brand" : h.event === "onError" ? "bg-red/15 text-red" : "bg-amber/15 text-amber"}`}>
                            {h.event === "afterEdit" ? "Düzenleme sonrası" : h.event === "onError" ? "Hata olunca" : "Bitişte"}
                          </span>
                          {h.label && <span className="text-sm font-semibold truncate">{h.label}</span>}
                        </div>
                        <div className="text-xs text-muted font-mono truncate mt-0.5">{h.command}</div>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={() => updateHook(h.id, { enabled: !h.enabled })}
                          className="accent-brand"
                        />
                        Aktif
                      </label>
                      <button onClick={() => removeHook(h.id)} className="text-muted hover:text-red/80 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border border-line/60 rounded-xl p-3 bg-bgsoft/40">
                <div className="text-xs font-semibold text-muted mb-2">Yeni Kanca Ekle</div>
                <div className="flex gap-2">
                  <select value={hookEvent} onChange={(e) => setHookEvent(e.target.value as "afterEdit" | "onFinish" | "onError")} className="input-mono">
                    <option value="afterEdit">Düzenleme sonrası</option>
                    <option value="onFinish">Bitişte</option>
                    <option value="onError">Hata olunca</option>
                  </select>
                  <input value={hookLabel} onChange={(e) => setHookLabel(e.target.value)} placeholder="Etiket (opsiyonel)" className="input-mono flex-1" />
                </div>
                <input value={hookCommand} onChange={(e) => setHookCommand(e.target.value)} placeholder="Komut (örn. npm run lint, npm test)" className="input-mono w-full" />
                <button
                  onClick={() => {
                    if (!hookCommand.trim()) { addToast("Komut zorunlu.", "error"); return; }
                    addHook({ label: hookLabel.trim() || undefined, event: hookEvent, command: hookCommand.trim(), enabled: true });
                    setHookLabel(""); setHookCommand("");
                    addToast("Kanca eklendi.", "success");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-branddim transition-colors"
                >
                  <Plus size={14} /> Ekle
                </button>
              </div>
            </div>

            <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl text-xs text-muted space-y-1.5">
              <div className="font-semibold text-brand">Nasıl çalışır?</div>
              <p><b>Düzenleme sonrası</b>: ajan dosya yazdığı her turdan sonra komut çalışır, çıktı ajana geri beslenir (en çok 3 tur). Örn. <span className="font-mono">npm run lint</span> → hatalar ajana gider, düzeltir.</p>
              <p><b>Bitişte</b>: ajan tamamen durunca komut çalışır (yalnız bildirim). Örn. <span className="font-mono">npm test</span>.</p>
              <p className="text-amber">Komutlar Yerel Mod köprüsünde çalışır. Köprü kapalıyken &quot;Düzenleme sonrası&quot; kancaları yerleşik terminale düşer; &quot;Bitişte&quot; kancaları yalnız Yerel Mod&apos;da çalışır.</p>
            </div>
          </section>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Granüler araç-izin tablosu: her aracı kategori bazında allow/deny yapar.
   Reddedilenler (toolPermissions[name] === false) ajana hiç sunulmaz. */
function ToolPermissions() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const perms = config.toolPermissions ?? {};
  const isAllowed = (name: string) => perms[name] !== false;
  const setPerm = (names: string[], allowed: boolean) => {
    const next = { ...perms };
    for (const n of names) { if (allowed) delete next[n]; else next[n] = false; }
    saveConfig({ ...config, toolPermissions: next });
  };

  const categories: string[] = [];
  for (const t of ALL_TOOL_CATALOG) if (!categories.includes(t.category)) categories.push(t.category);
  const riskColor: Record<string, string> = { low: "bg-muted/40", medium: "bg-amber-400", high: "bg-red" };
  const riskLabel: Record<string, string> = { low: "düşük", medium: "orta", high: "yüksek" };
  const deniedCount = ALL_TOOL_CATALOG.filter((t) => !isAllowed(t.name)).length;

  return (
    <div className="rounded-xl border border-line bg-bgsoft overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line/60">
        <div className="flex-1">
          <div className="text-sm font-semibold">Araç izinleri</div>
          <div className="text-xs text-muted mt-0.5">
            Ajanın kullanabileceği araçları tek tek aç/kapat. Kapatılan araç ajana hiç sunulmaz.
            {deniedCount > 0 && <span className="text-amber-400"> · {deniedCount} araç kapalı</span>}
          </div>
        </div>
        {deniedCount > 0 && (
          <button
            onClick={() => saveConfig({ ...config, toolPermissions: {} })}
            className="text-xs text-brand hover:underline shrink-0"
          >
            Tümünü aç
          </button>
        )}
      </div>
      <div className="divide-y divide-line/40">
        {categories.map((cat) => {
          const tools = ALL_TOOL_CATALOG.filter((t) => t.category === cat);
          const allOn = tools.every((t) => isAllowed(t.name));
          return (
            <div key={cat} className="px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted/60 flex-1">{cat}</span>
                <button
                  onClick={() => setPerm(tools.map((t) => t.name), !allOn)}
                  className="text-[10px] text-muted/60 hover:text-brand transition-colors"
                >
                  {allOn ? "kategoriyi kapat" : "kategoriyi aç"}
                </button>
              </div>
              <div className="space-y-0.5">
                {tools.map((t) => {
                  const on = isAllowed(t.name);
                  return (
                    <label key={t.name} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                      <input type="checkbox" checked={on} onChange={() => setPerm([t.name], !on)} className="accent-brand" />
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${riskColor[t.risk]}`} title={`Risk: ${riskLabel[t.risk]}`} />
                      <span className={`text-xs flex-1 ${on ? "text-ink" : "text-muted/40 line-through"}`}>{t.label}</span>
                      <span className="text-[10px] font-mono text-muted/40">{t.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
