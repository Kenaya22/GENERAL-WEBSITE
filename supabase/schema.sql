-- ============================================================================
-- Tara — online accounts, synced trips and shared reviews (Supabase)
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- ============================================================================

-- Each traveler's private data: profile, saved trips and saved places.
create table if not exists public.user_data (
  id          uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "read own data"   on public.user_data;
drop policy if exists "insert own data" on public.user_data;
drop policy if exists "update own data" on public.user_data;
create policy "read own data"   on public.user_data for select using (auth.uid() = id);
create policy "insert own data" on public.user_data for insert with check (auth.uid() = id);
create policy "update own data" on public.user_data for update using (auth.uid() = id) with check (auth.uid() = id);

-- Reviews: everyone can read them; only the author can edit or delete theirs.
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  place_id      text not null,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name   text not null default 'Traveler',
  author_photo  text,
  rating        int  not null check (rating between 1 and 5),
  body          text not null default '' check (char_length(body) <= 3000),
  photos        jsonb not null default '[]'::jsonb,
  discount      boolean not null default false,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz
);

create index if not exists reviews_place_idx on public.reviews (place_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "anyone can read reviews" on public.reviews;
drop policy if exists "post own review"         on public.reviews;
drop policy if exists "edit own review"         on public.reviews;
drop policy if exists "delete own review"       on public.reviews;
create policy "anyone can read reviews" on public.reviews for select using (true);
create policy "post own review"   on public.reviews for insert with check (auth.uid() = user_id);
create policy "edit own review"   on public.reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own review" on public.reviews for delete using (auth.uid() = user_id);
