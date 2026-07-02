"use client";

import { useEffect, useState } from "react";
import { Database, KeyRound, Loader2, LogOut, Mail, MessageSquare, Image as ImageIcon, Palette, ShieldAlert, UserCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { isAdminEmail } from "@/lib/admin";

/* Hesap ayarları — modüler panel. Şifre/e-posta/görünen ad değiştirme, oturum
   yönetimi (tüm cihazlardan çık), kullanım istatistikleri ve hesabı kalıcı silme.
   Tüm kimlik işlemleri Supabase üzerinden; silme sunucu rotasıyla (servis anahtarı
   sunucuda kalır). Supabase yoksa ilgili işlemler nazikçe devre dışı. */
export function AccountSettings() {
  const userEmail = useStore((s) => s.userEmail);
  const plan = useStore((s) => s.plan);
  const config = useStore((s) => s.config);
  const snippets = useStore((s) => s.snippets);
  const storeUserId = useStore((s) => s.userId);
  const chats = useStore((s) => s.chats);
  const addToast = useStore((s) => s.addToast);
  const isAdmin = isAdminEmail(userEmail);

  const [displayName, setDisplayName] = useState("");
  const [loadedName, setLoadedName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [signingOutAll, setSigningOutAll] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delText, setDelText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const sb = createClient();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata?.display_name as string | undefined) ?? "";
      setDisplayName(n); setLoadedName(n);
    });
  }, []);

  const msgCount = chats.reduce((a, c) => a + c.messages.length, 0);
  const designCount = config.savedDesigns?.length ?? 0;
  const skillCount = config.skills?.length ?? 0;

  const signOut = async () => {
    const sb = createClient();
    if (sb) await sb.auth.signOut();
    useStore.getState().setUser(null, null);
    window.location.href = "/login";
  };

  const saveName = async () => {
    const sb = createClient();
    if (!sb) { addToast("Supabase bağlı değil.", "error"); return; }
    setSavingName(true);
    const { error } = await sb.auth.updateUser({ data: { display_name: displayName.trim() } });
    setSavingName(false);
    if (error) addToast(`Ad kaydedilemedi: ${error.message}`, "error");
    else { setLoadedName(displayName.trim()); addToast("Görünen ad güncellendi.", "success"); }
  };

  const changeEmail = async () => {
    const e = newEmail.trim();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) { addToast("Geçerli bir e-posta gir.", "error"); return; }
    const sb = createClient();
    if (!sb) { addToast("Supabase bağlı değil.", "error"); return; }
    setSavingEmail(true);
    const { error } = await sb.auth.updateUser({ email: e });
    setSavingEmail(false);
    if (error) addToast(`E-posta değiştirilemedi: ${error.message}`, "error");
    else { setNewEmail(""); addToast("Onay e-postası gönderildi — yeni adresi doğrula.", "success"); }
  };

  const changePassword = async () => {
    if (pw1.length < 6) { addToast("Şifre en az 6 karakter olmalı.", "error"); return; }
    if (pw1 !== pw2) { addToast("Şifreler eşleşmiyor.", "error"); return; }
    const sb = createClient();
    if (!sb) { addToast("Supabase bağlı değil.", "error"); return; }
    setSavingPw(true);
    const { error } = await sb.auth.updateUser({ password: pw1 });
    setSavingPw(false);
    if (error) addToast(`Şifre değiştirilemedi: ${error.message}`, "error");
    else { setPw1(""); setPw2(""); addToast("Şifre güncellendi.", "success"); }
  };

  const signOutAll = async () => {
    const sb = createClient();
    if (!sb) { addToast("Supabase bağlı değil.", "error"); return; }
    setSigningOutAll(true);
    const { error } = await sb.auth.signOut({ scope: "global" });
    setSigningOutAll(false);
    if (error) { addToast(`Çıkış yapılamadı: ${error.message}`, "error"); return; }
    useStore.getState().setUser(null, null);
    window.location.href = "/login";
  };

  const deleteAccount = async () => {
    const sb = createClient();
    if (!sb) { addToast("Supabase bağlı değil.", "error"); return; }
    setDeleting(true);
    try {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Oturum bulunamadı — tekrar giriş yap.");
      const res = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Hata ${res.status}`);
      await sb.auth.signOut();
      useStore.getState().setUser(null, null);
      addToast("Hesabın silindi.", "success");
      window.location.href = "/login";
    } catch (e) {
      addToast(`Hesap silinemedi: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setDeleting(false); }
  };

  if (!userEmail) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-bold">Hesap</h4>
        <div className="premium-card rounded-xl p-4 text-sm text-muted/70">
          Giriş yapılmadı. <a href="/login" className="text-brand hover:underline font-semibold">Giriş / Kayıt ol</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h4 className="text-sm font-bold">Hesap</h4>

      {/* Profil kartı */}
      <div className="premium-card rounded-xl p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-brand/15 border border-brand/20 grid place-items-center text-brand font-bold text-lg shrink-0">
          {(loadedName || userEmail)[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{loadedName || userEmail}</div>
          <div className="text-[11px] text-muted/60 flex items-center gap-1.5">
            {loadedName && <span className="truncate">{userEmail} · </span>}
            <span>Plan: {plan === "pro" ? "Pro" : "Ücretsiz"}</span>
            {isAdmin && <span className="text-brand/80 font-bold">· Admin</span>}
          </div>
        </div>
        <button onClick={signOut} className="px-3 py-1.5 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold text-muted hover:text-ink transition-colors shrink-0 flex items-center gap-1.5">
          <LogOut size={13} /> Çıkış
        </button>
      </div>

      {/* Kullanım istatistikleri */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Kullanım</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: MessageSquare, n: chats.length, l: "Sohbet" },
            { icon: Palette, n: designCount, l: "Tasarım" },
            { icon: ImageIcon, n: skillCount, l: "Skill" },
          ].map(({ icon: I, n, l }) => (
            <div key={l} className="premium-card rounded-xl p-3 text-center">
              <I size={15} className="text-brand/70 mx-auto mb-1" />
              <div className="text-lg font-bold leading-none">{n}</div>
              <div className="text-[10px] text-muted/55 mt-1">{l}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted/45 mt-1.5">Toplam {msgCount} mesaj.</p>
      </div>

      {/* Verilerim — neyin nerede saklandığı tek bakışta (şeffaflık). */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><Database size={11} /> Verilerim</div>
        <div className="premium-card rounded-xl divide-y divide-line/40 text-xs">
          {(() => {
            const signedIn = !!storeUserId;
            const synced = signedIn ? "Cihaz + hesap senkron" : "Yalnız bu cihaz";
            const rows: { l: string; n: number; loc: string; cloud: boolean }[] = [
              { l: "Sohbetler", n: chats.length, loc: synced, cloud: signedIn },
              { l: "Stüdyo projeleri", n: config.studioProjects?.length ?? 0, loc: synced, cloud: signedIn },
              { l: "Kayıtlı tasarımlar", n: config.savedDesigns?.length ?? 0, loc: synced, cloud: signedIn },
              { l: "Snippet'ler", n: snippets.length, loc: "Yalnız bu cihaz", cloud: false },
              { l: "API anahtarları", n: config.models.length, loc: "Bu cihazda şifreli", cloud: false },
            ];
            return rows.map((r) => (
              <div key={r.l} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 min-w-0 truncate text-ink/85 font-medium">{r.l}</span>
                <span className="text-muted/60 font-mono">{r.n}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md border shrink-0 ${r.cloud ? "border-brand/30 bg-brand/10 text-brand/90" : "border-line/60 text-muted/60"}`}>{r.loc}</span>
              </div>
            ));
          })()}
        </div>
        <p className="text-[10px] text-muted/45 mt-1.5">Tam yedek indirmek/geri yüklemek için: Ayarlar → Temel → Yedek.</p>
      </div>

      {/* Görünen ad */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><UserCircle size={11} /> Görünen ad</div>
        <div className="flex gap-2">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Adın" className="flex-1 bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50" />
          <button onClick={saveName} disabled={savingName || displayName.trim() === loadedName} className="px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold disabled:opacity-40 transition-colors">
            {savingName ? <Loader2 size={14} className="animate-spin" /> : "Kaydet"}
          </button>
        </div>
      </div>

      {/* E-posta değiştir */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><Mail size={11} /> E-posta değiştir</div>
        <div className="flex gap-2">
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="yeni@eposta.com" className="flex-1 bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50" />
          <button onClick={changeEmail} disabled={savingEmail || !newEmail.trim()} className="px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold disabled:opacity-40 transition-colors">
            {savingEmail ? <Loader2 size={14} className="animate-spin" /> : "Gönder"}
          </button>
        </div>
        <p className="text-[10px] text-muted/45 mt-1">Yeni adrese onay bağlantısı gönderilir.</p>
      </div>

      {/* Şifre değiştir */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><KeyRound size={11} /> Şifre değiştir</div>
        <div className="space-y-2">
          <input value={pw1} onChange={(e) => setPw1(e.target.value)} type="password" placeholder="Yeni şifre (en az 6)" className="w-full bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50" />
          <div className="flex gap-2">
            <input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" placeholder="Yeni şifre (tekrar)" className="flex-1 bg-bgsoft border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50" />
            <button onClick={changePassword} disabled={savingPw || !pw1 || !pw2} className="px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold disabled:opacity-40 transition-colors">
              {savingPw ? <Loader2 size={14} className="animate-spin" /> : "Değiştir"}
            </button>
          </div>
        </div>
      </div>

      {/* Oturum yönetimi */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Oturum yönetimi</div>
        <button onClick={signOutAll} disabled={signingOutAll} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors disabled:opacity-50">
          {signingOutAll ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Tüm cihazlardan çıkış yap
        </button>
      </div>

      {/* Tehlikeli bölge */}
      <div className="rounded-xl border border-red/25 bg-red/5 p-3.5">
        <div className="text-[11px] font-bold text-red/90 flex items-center gap-1.5 mb-1"><ShieldAlert size={13} /> Tehlikeli bölge</div>
        {!confirmDel ? (
          <>
            <p className="text-[11px] text-muted/60 mb-2 leading-relaxed">Hesabını ve tüm verilerini (sohbet, ayar, tasarım) kalıcı olarak siler. Geri alınamaz.</p>
            <button onClick={() => setConfirmDel(true)} className="px-3 py-1.5 rounded-lg border border-red/40 text-xs font-semibold text-red hover:bg-red/10 transition-colors">Hesabı sil</button>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted/70">Onaylamak için <b className="text-red">SIL</b> yaz:</p>
            <input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="SIL" className="w-full bg-bgsoft border border-red/30 rounded-lg px-3 py-2 text-sm outline-none focus:border-red/60" />
            <div className="flex gap-2">
              <button onClick={deleteAccount} disabled={delText.trim().toUpperCase() !== "SIL" || deleting} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red text-white text-xs font-bold disabled:opacity-40 transition-opacity">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : "Kalıcı olarak sil"}
              </button>
              <button onClick={() => { setConfirmDel(false); setDelText(""); }} className="px-3 py-2 rounded-lg border border-line text-xs font-semibold text-muted hover:text-ink transition-colors">Vazgeç</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted/50 leading-relaxed">
        Sohbetlerin, ayarların, kayıtlı tasarımların ve git hesapların yalnızca senin hesabına özeldir; başka kullanıcılar erişemez (Supabase RLS).
      </p>
    </div>
  );
}
