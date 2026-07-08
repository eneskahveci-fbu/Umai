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

-- ── chats: proje ilişkisi (sohbetin ait olduğu projenin cihazlar arası senkronu) ──
-- Uygulama bu sütunu okur/yazar; eski kurulumlarda idempotent olarak eklenir.
alter table public.chats
  add column if not exists project_id text;

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

-- ── Abonelikler (Stripe — Pro plan durumu) ──────────────────────────────────
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'free',  -- free | active | trialing | past_due | canceled
  plan                   text not null default 'free',  -- free | pro
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Kullanıcı yalnızca KENDİ abonelik durumunu OKUYABİLİR. Yazma yalnızca
-- service-role (Stripe webhook) tarafından yapılır → RLS yazmayı engeller.
drop policy if exists "kendi abonelik - select" on public.subscriptions;
create policy "kendi abonelik - select"
  on public.subscriptions for select using (auth.uid() = user_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- DASHBOARD AYARLARI (SQL değil — Supabase panelinden bir kez yapılır):
--   1) Authentication → Providers → E-posta'yı aç; ayrıca Google / GitHub / GitLab
--      sağlayıcılarını etkinleştir ve her birinin OAuth Client ID/Secret'ını gir.
--      (Google: console.cloud.google.com → OAuth consent ekranı + Credentials;
--       Authorized redirect URI: https://<proje>.supabase.co/auth/v1/callback)
--   2) Authentication → URL Configuration:
--        • Site URL = https://craft-coder.vercel.app  (kendi alan adın)
--        • Redirect URLs'e ekle: https://craft-coder.vercel.app/auth/callback
--   3) E-posta onayı kullanıyorsan SMTP'yi yapılandır (yoksa onay maili gitmez).
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- ARKA PLAN GÖREVLERİ (Otonom Ajan — sunucu-taraflı yürütme)
-- Görev sunucuda çalışır ve sonucu buraya yazılır → kullanıcı tarayıcıyı
-- kapatsa da iş tamamlanır; geri dönünce panelde hazır bulur.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.background_jobs (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  goal        text not null,
  title       text not null default 'Görev',
  status      text not null default 'running',  -- running | done | error
  result      text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists background_jobs_user_idx on public.background_jobs (user_id, created_at desc);

alter table public.background_jobs enable row level security;

drop policy if exists "kendi görevleri - select" on public.background_jobs;
create policy "kendi görevleri - select"
  on public.background_jobs for select using (auth.uid() = user_id);
drop policy if exists "kendi görevleri - insert" on public.background_jobs;
create policy "kendi görevleri - insert"
  on public.background_jobs for insert with check (auth.uid() = user_id);
drop policy if exists "kendi görevleri - update" on public.background_jobs;
create policy "kendi görevleri - update"
  on public.background_jobs for update using (auth.uid() = user_id);
drop policy if exists "kendi görevleri - delete" on public.background_jobs;
create policy "kendi görevleri - delete"
  on public.background_jobs for delete using (auth.uid() = user_id);

drop trigger if exists background_jobs_set_updated_at on public.background_jobs;
create trigger background_jobs_set_updated_at
  before update on public.background_jobs
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- YAYINLANAN ARTIFACT'LAR (/api/publish → /a/<id>)
-- Not: Bu tablo üretimde zaten kullanılıyordu ama şema dosyasında eksikti;
-- geleceğe dönük tam kaynak olması için eklendi (idempotent).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.published_artifacts (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete set null,
  title       text not null default 'Artifact',
  type        text not null default 'html',   -- html | svg | mermaid
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.published_artifacts enable row level security;

-- Herkes okuyabilir (paylaşım amaçlı, /a/<id> herkese açık).
drop policy if exists "yayın - select" on public.published_artifacts;
create policy "yayın - select"
  on public.published_artifacts for select using (true);
-- Girişli/girişsiz herkes yayınlayabilir (hız sınırı API katmanında).
drop policy if exists "yayın - insert" on public.published_artifacts;
create policy "yayın - insert"
  on public.published_artifacts for insert with check (true);
-- Yalnız sahibi silebilir.
drop policy if exists "yayın - delete" on public.published_artifacts;
create policy "yayın - delete"
  on public.published_artifacts for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- ÜRÜN ANALİTİĞİ (admin-only agregat görünüm — bkz. SettingsModal → Kullanım)
-- Kullanıcı yalnız KENDİ olayını YAZABİLİR (insert-only). Okuma politikası
-- YOK — istemciden hiç kimse (sahibi dahil) okuyamaz; agregatlar yalnızca
-- service-role ile (/api/admin/analytics, admin e-postasına kilitli) hesaplanır.
-- Kişisel kullanım panosu (AnalyticsSettings.tsx) zaten yerel sohbet
-- geçmişinden hesaplanıyor — bu tablo YALNIZ toplu ürün analitiği içindir.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  event_name  text not null,
  surface     text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_name_idx on public.analytics_events (event_name);

alter table public.analytics_events enable row level security;

drop policy if exists "analitik - insert" on public.analytics_events;
create policy "analitik - insert"
  on public.analytics_events for insert with check (auth.uid() = user_id);
