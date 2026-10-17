-- ForeverScout accounts schema. Paste into Supabase Dashboard > SQL Editor > Run. Safe to re-run.

-- Progress: one row per user. done = {"item-slug": 1, ...} (same shape as localStorage 'fq-done').
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  done       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Profiles: display info. battletag is null for email/Google users.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  battletag   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Placeholder for later: characters pulled from the Battle.net profile API (wow.profile scope).
create table if not exists public.battlenet_characters (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  region        text not null default 'us',
  realm_slug    text not null,
  name          text not null,
  class         text,
  level         int,
  equipment     jsonb,
  opt_in_public boolean not null default false,   -- show next to rare items only if the player opts in
  fetched_at    timestamptz,
  unique (user_id, region, realm_slug, name)
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before update on public.progress for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Row Level Security: users can only see and change their own rows.
alter table public.progress enable row level security;
alter table public.profiles enable row level security;
alter table public.battlenet_characters enable row level security;

drop policy if exists "own progress select" on public.progress;
drop policy if exists "own progress insert" on public.progress;
drop policy if exists "own progress update" on public.progress;
create policy "own progress select" on public.progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "own progress insert" on public.progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own progress update" on public.progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own profile select" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
-- battletag comes from Battle.net via the trigger below; users may not edit it themselves.
revoke update on public.profiles from anon, authenticated;

drop policy if exists "own characters select" on public.battlenet_characters;
create policy "own characters select" on public.battlenet_characters for select to authenticated using ((select auth.uid()) = user_id);
-- writes to battlenet_characters will come from a server-side job later (service role bypasses RLS).

grant select, insert, update on public.progress to authenticated;
grant select on public.profiles, public.battlenet_characters to authenticated;

-- Create/refresh a profile whenever a user signs up or their identity metadata changes.
-- Battle.net returns the BattleTag as "battletag" (userinfo) / "battle_tag" (id_token); Supabase may nest it under custom_claims.
create or replace function public.sync_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); bt text;
begin
  bt := coalesce(m->>'battletag', m->>'battle_tag', m->'custom_claims'->>'battletag', m->'custom_claims'->>'battle_tag');
  insert into public.profiles (id, battletag) values (new.id, bt)
  on conflict (id) do update set battletag = coalesce(excluded.battletag, public.profiles.battletag);
  return new;
end $$;
drop trigger if exists on_auth_user_sync_profile on auth.users;
create trigger on_auth_user_sync_profile after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile();

-- Backfill any users created before this script ran.
insert into public.profiles (id) select id from auth.users on conflict do nothing;
