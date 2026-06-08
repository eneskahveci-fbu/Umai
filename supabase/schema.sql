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

-- ─── Hesaba bağlı yapılandırma (modeller, API anahtarları, GitHub token'ları,
-- skill'ler, tercihler). Kullanıcı her tarayıcıdan aynı hesapla girince aynı
-- ayarlara erişir. Satır RLS ile korunur: yalnızca kullanıcının kendisi okur/yazar.
create table if not exists public.user_configs (
  user_id     uuid primary key references auth.users on delete cascade,
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_configs enable row level security;

drop policy if exists "kendi config - select" on public.user_configs;
create policy "kendi config - select"
  on public.user_configs for select using (auth.uid() = user_id);

drop policy if exists "kendi config - insert" on public.user_configs;
create policy "kendi config - insert"
  on public.user_configs for insert with check (auth.uid() = user_id);

drop policy if exists "kendi config - update" on public.user_configs;
create policy "kendi config - update"
  on public.user_configs for update using (auth.uid() = user_id);
