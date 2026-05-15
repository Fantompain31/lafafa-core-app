-- ============================================================
-- MIGRATION 002 — Table : profiles
-- Profils publics des utilisateurs connectés.
-- Liée à auth.users via trigger.
-- PAS de policies ici — elles sont dans 011_rls_policies.sql.
-- ============================================================

create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  first_name  text,
  last_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription.
-- security definer + search_path pour éviter les injections de schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on table public.profiles is
  'Profils publics des utilisateurs. Créé automatiquement à l''inscription. Core SaaS.';
comment on column public.profiles.email is
  'Email de l''utilisateur. Lecture limitée — voir RLS dans 011_rls_policies.sql.';
