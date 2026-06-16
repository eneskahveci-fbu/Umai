-- ════════════════════════════════════════════════════════════════════════
-- craft.ai — Supabase şema + RLS (Row Level Security)
-- ════════════════════════════════════════════════════════════════════════
-- Supabase Dashboard → SQL Editor'de bir kez çalıştır.
--
-- NEDEN GEREKLİ: Uygulama giriş yapınca aşağıdaki tabloları kullanır. Bu
-- tablolar + politikalar YOKSA; giriş, bulut senkron, Stripe aboneliği ve
-- sohbet paylaşımı SESSİZCE çalışmaz (uygulama BYOK/yerel modda devam eder,
-- ama hesaba bağlı özellikler boş döner). Bu betik tabloları kodun beklediği
-- adlar/sütunlarla oluşturur ve güvenli RLS politikalarını kurar.
--
-- GÜVENLİK MODELİ:
--   • Tüm tablolarda RLS AÇIK → istemci yalnızca KENDİ verisine erişir.
--   • Stripe webhook'u SUPABASE_SERVICE_ROLE_KEY ile çalışır; service-role
--     RLS'i AŞAR, bu yüzden 'subscriptions' tablosuna yazma politikası YOK
--     (istemciden plan yükseltilemez → "banka düzeyi" güven).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) user_config — kullanıcı ayarları (cihazlar arası senkron) ──────────
create table if not exists public.user_config (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  config     jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_config enable row level security;
drop policy if exists "user_config sahibi" on public.user_config;
create policy "user_config sahibi" on public.user_config
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2) chats — kullanıcının sohbetleri (giriş yapınca buluta senkronlanır) ─
create table if not exists public.chats (
  id         text primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  title      text,
  messages   jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chats enable row level security;
create index if not exists chats_user_id_idx on public.chats(user_id);
drop policy if exists "chats sahibi" on public.chats;
create policy "chats sahibi" on public.chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3) subscriptions — Stripe abonelik durumu (Pro plan gating) ───────────
-- YAZMA yalnızca service-role (webhook) tarafından yapılır → write politikası yok.
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text,                          -- active | trialing | canceled | past_due | ...
  plan                   text        not null default 'free',  -- 'pro' | 'free'
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions sahibi okur" on public.subscriptions;
-- Kullanıcı yalnızca KENDİ planını okuyabilir (Pro mu? kontrolü). İstemciden
-- INSERT/UPDATE yapılamaz; planı yalnızca Stripe webhook'u (service-role) yazar.
create policy "subscriptions sahibi okur" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ── 4) shared_chats — herkese açık paylaşım linkleri (/share/<id>) ─────────
create table if not exists public.shared_chats (
  id         text primary key,
  user_id    uuid        references auth.users(id) on delete set null,
  title      text,
  messages   jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.shared_chats enable row level security;
drop policy if exists "shared_chats herkes okur" on public.shared_chats;
drop policy if exists "shared_chats sahibi ekler" on public.shared_chats;
-- Linke sahip HERKES okuyabilir (public read — paylaşımın amacı bu).
create policy "shared_chats herkes okur" on public.shared_chats
  for select using (true);
-- Yalnızca giriş yapan kullanıcı KENDİ adına paylaşım oluşturabilir (güvenli
-- varsayılan). Anonim (girişsiz) paylaşıma izin vermek istersen aşağıdaki
-- politikayı "with check (true)" yap — paylaşım route'u zaten rate-lim'li (10/dk).
create policy "shared_chats sahibi ekler" on public.shared_chats
  for insert with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- KURULUM SONRASI: Authentication → Providers'dan Google/GitHub/GitLab OAuth'u
-- etkinleştir ve Redirect URL'e  <SITE_URL>/auth/callback  ekle.
-- Gerekli env değişkenleri için .env.example dosyasına bak.
-- ════════════════════════════════════════════════════════════════════════
