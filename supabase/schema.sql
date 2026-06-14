-- craft.ai · Supabase şeması
-- Supabase projenizde SQL Editor'a yapıştırıp çalıştırın.

create table if not exists public.chats (
  id          text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null default 'Yeni sohbet',
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists chats_user_id_idx on public.chats (user_id);
create index if not exists chats_updated_at_idx on public.chats (updated_at desc);

-- Row Level Security: herkes yalnızca kendi sohbetlerini görür/değiştirir.
alter table public.chats enable row level security;

drop policy if exists "kendi sohbetleri - select" on public.chats;
create policy "kendi sohbetleri - select"
  on public.chats for select using (auth.uid() = user_id);

drop policy if exists "kendi sohbetleri - insert" on public.chats;
create policy "kendi sohbetleri - insert"
  on public.chats for insert with check (auth.uid() = user_id);

drop policy if exists "kendi sohbetleri - update" on public.chats;
create policy "kendi sohbetleri - update"
  on public.chats for update using (auth.uid() = user_id);

drop policy if exists "kendi sohbetleri - delete" on public.chats;
create policy "kendi sohbetleri - delete"
  on public.chats for delete using (auth.uid() = user_id);

-- Paylaşılan sohbetler (herkese açık, salt okunur)
create table if not exists public.shared_chats (
  id          text primary key,
  title       text not null,
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.shared_chats enable row level security;

-- Herkes okuyabilir
drop policy if exists "shared_chats - select" on public.shared_chats;
create policy "shared_chats - select"
  on public.shared_chats for select using (true);

-- Giriş yapmış kullanıcılar oluşturabilir
drop policy if exists "shared_chats - insert" on public.shared_chats;
create policy "shared_chats - insert"
  on public.shared_chats for insert with check (auth.role() = 'authenticated' or auth.role() = 'anon');

-- ── Kullanıcı config senkronizasyonu (modeller, API anahtarları, skill'ler vb.) ──
create table if not exists public.user_config (
  user_id    uuid primary key references auth.users on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_config enable row level security;

drop policy if exists "kendi config - all" on public.user_config;
create policy "kendi config - all"
  on public.user_config for all using (auth.uid() = user_id);

-- ── shared_chats: sahiplik + silme (kullanıcı kendi paylaşımını kaldırabilsin) ──
-- (Idempotent: tekrar çalıştırmak güvenlidir.)
alter table public.shared_chats
  add column if not exists user_id uuid references auth.users on delete set null;

create index if not exists shared_chats_user_id_idx on public.shared_chats (user_id);
create index if not exists shared_chats_created_at_idx on public.shared_chats (created_at desc);

drop policy if exists "shared_chats - delete" on public.shared_chats;
create policy "shared_chats - delete"
  on public.shared_chats for delete using (auth.uid() = user_id);

-- ── updated_at otomatik güncelleme (uygulama unutsa bile DB tutarlı kalır) ──
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at
  before update on public.chats
  for each row execute function public.set_updated_at();

drop trigger if exists user_config_set_updated_at on public.user_config;
create trigger user_config_set_updated_at
  before update on public.user_config
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- DASHBOARD AYARLARI (SQL değil — Supabase panelinden bir kez yapılır):
--   1) Authentication → Providers → GitLab'i (ve istiyorsan GitHub'ı) etkinleştir;
--      OAuth App'in Client ID/Secret'ını gir.
--   2) Authentication → URL Configuration:
--        • Site URL = https://craft-coder.vercel.app  (kendi alan adın)
--        • Redirect URLs'e ekle: https://craft-coder.vercel.app/auth/callback
--   3) E-posta onayı kullanıyorsan SMTP'yi yapılandır (yoksa onay maili gitmez).
-- ─────────────────────────────────────────────────────────────────────────
