"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

interface AdminUserRow {
  id: string;
  email: string | null;
  username: string | null;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  email: "E-posta",
  github: "GitHub",
  gitlab: "GitLab",
  google: "Google",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

/* Admin-only "Superadmin" paneli — kim hangi hesapla (e-posta/kullanıcı adı +
   hangi sağlayıcı ile) kayıtlı, ne zaman katılmış, en son ne zaman giriş
   yapmış. AdminAnalytics.tsx ile AYNI desen: servis anahtarı sunucuda yoksa
   (501) ya da admin değilse (403) sessizce bilgilendirici bir not gösterir.

   Silme özelliği: bir GitHub/GitLab kimliği eski/test bir hesaba takılı
   kaldığında ("Identity is already linked to another user" hatası — bkz.
   OAuth bağlama akışı) Supabase'in yönetici API'sinde TEK bir kimliği o
   kullanıcıdan ayırma uç noktası YOK; yalnızca kullanıcının TAMAMINI silmek
   mümkün. Bu yüzden buradaki "Sil" o kişinin hesabını (sohbetler, ayarlar,
   varsa abonelik dahil) KALICI ve GERİ ALINAMAZ şekilde siler — kazara
   tıklamaya karşı kullanıcı adını YAZARAK onaylaması istenir. */
export function AdminUsers() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ok"; users: AdminUserRow[] }
  >({ status: "loading" });
  const [confirmTarget, setConfirmTarget] = useState<AdminUserRow | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const addToast = useStore((s) => s.addToast);

  /* `reloadKey`: ilk yükleme useEffect içinde kalır (React kuralına uygun,
     mount'ta setState doğrudan çağrılmaz); silme sonrası tazeleme bu sayacı
     artırarak AYNI efekti tekrar tetikler — mantık iki yerde tekrarlanmaz. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    /* İlk montajda state zaten "loading" (useState başlangıç değeri) —
       silme sonrası tazelemede tekrar "loading"a döndürmüyoruz (senkron
       setState kuralına takılır); liste sessizce güncellenir, kabul
       edilebilir bir davranış — spinner'a gerek yok. */
    (async () => {
      const sb = createClient();
      if (!sb) { if (!cancelled) setState({ status: "error", message: "Kimlik doğrulama yapılandırılmamış." }); return; }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { if (!cancelled) setState({ status: "error", message: "Oturum bulunamadı." }); return; }
      try {
        const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setState({ status: "error", message: json.error || `Hata (${res.status})` }); return; }
        setState({ status: "ok", users: json.users ?? [] });
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "bilinmeyen hata" });
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const expectedConfirm = confirmTarget ? (confirmTarget.username || confirmTarget.email || confirmTarget.id) : "";
  const canConfirm = confirmTarget !== null && confirmText.trim() === expectedConfirm;

  const doDelete = async () => {
    if (!confirmTarget || !canConfirm) return;
    setDeleting(true);
    try {
      const sb = createClient();
      const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) { addToast("Oturum bulunamadı.", "error"); return; }
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: confirmTarget.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { addToast(json.error || `Silme başarısız (${res.status})`, "error"); return; }
      addToast(`Hesap silindi: ${expectedConfirm}`, "success");
      setConfirmTarget(null);
      setConfirmText("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Silme başarısız.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-3 pt-2 border-t border-line/60">
      <div>
        <h4 className="text-sm font-bold flex items-center gap-2"><ShieldAlert size={16} className="text-brand" /> Superadmin — Kayıtlı Kullanıcılar</h4>
        <p className="text-xs text-muted/70 mt-1 leading-relaxed">
          Kim hangi hesapla (e-posta/kullanıcı adı + sağlayıcı) kayıt olmuş, ne zaman katılmış ve en son ne zaman giriş yapmış.
          Bir GitHub/GitLab hesabı eski bir kayda takılıp bağlanamıyorsa, o kaydı silerek serbest bırakabilirsin.
        </p>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-muted/60 py-3">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor…
        </div>
      )}

      {state.status === "error" && (
        <p className="text-xs text-muted/60 py-2">{state.message}</p>
      )}

      {state.status === "ok" && (
        <div className="premium-card rounded-xl divide-y divide-line/40 max-h-96 overflow-y-auto">
          {state.users.length === 0 && (
            <p className="text-xs text-muted/60 p-3">Henüz kayıtlı kullanıcı yok.</p>
          )}
          {state.users.map((u) => (
            <div key={u.id} className="p-3 text-xs space-y-1 group">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink/90 truncate">{u.username || u.email || u.id}</span>
                {u.providers.map((p) => (
                  <span key={p} className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md border border-line/60 text-muted/70">
                    {PROVIDER_LABELS[p] ?? p}
                  </span>
                ))}
                <button
                  onClick={() => { setConfirmTarget(u); setConfirmText(""); }}
                  title="Bu hesabı kalıcı sil"
                  className="ml-auto shrink-0 p-1 rounded-md text-muted/40 hover:text-red hover:bg-red/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {u.username && u.email && (
                <div className="text-muted/60 truncate">{u.email}</div>
              )}
              <div className="text-[10px] text-muted/50 flex items-center gap-2">
                <span>Katıldı: {fmtDate(u.createdAt)}</span>
                <span>·</span>
                <span>Son giriş: {fmtDate(u.lastSignInAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Silme onayı — yazarak doğrulama, yanlışlıkla tıklamaya karşı. */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" onClick={() => !deleting && setConfirmTarget(null)}>
          <div className="premium-card rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-bold text-red flex items-center gap-1.5"><ShieldAlert size={15} /> Hesabı kalıcı sil</h5>
              <button onClick={() => setConfirmTarget(null)} disabled={deleting} className="text-muted/50 hover:text-ink"><X size={16} /></button>
            </div>
            <p className="text-xs text-muted/80 leading-relaxed">
              <strong className="text-ink">{expectedConfirm}</strong> hesabı, sohbetleri ve ayarları KALICI silinecek. Bu işlem GERİ ALINAMAZ.
            </p>
            <p className="text-xs text-muted/60">Onaylamak için hesap adını aynen yaz:</p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedConfirm}
              className="input-mono w-full"
              onKeyDown={(e) => { if (e.key === "Enter" && canConfirm && !deleting) doDelete(); }}
            />
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setConfirmTarget(null)} disabled={deleting} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-ink transition-colors">Vazgeç</button>
              <button
                onClick={doDelete}
                disabled={!canConfirm || deleting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {deleting ? <><Loader2 size={12} className="animate-spin" /> Siliniyor…</> : "Kalıcı Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
