-- Phase 5: User display-name profiles
-- Run in Supabase SQL Editor after all previous phases.

-- 1. Create user_profiles table
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuse the existing set_updated_at_timestamp trigger function from phase 1
drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at_timestamp();

-- 2. Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles(user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 3. RLS policies
alter table public.user_profiles enable row level security;

-- Users can read profiles of anyone they share a board with
drop policy if exists "user_profiles_select_comembers" on public.user_profiles;
create policy "user_profiles_select_comembers"
on public.user_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.board_members me
    join public.board_members them on me.board_id = them.board_id
    where me.user_id = auth.uid()
      and them.user_id = user_profiles.user_id
  )
);

-- Users can update their own profile
drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Users can insert their own profile (safety net for the app-level upsert)
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

-- 4. Backfill profiles for every existing user
insert into public.user_profiles (user_id, display_name)
select
  id,
  coalesce(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    ''
  )
from auth.users
on conflict (user_id) do nothing;
