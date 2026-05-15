-- ============================================================
-- MIGRATION 004 — Table : stay_members
-- Membres d'un séjour (utilisateurs avec compte ayant accès).
-- Inclut un champ status pour gérer les invitations en attente
-- et les membres désactivés sans supprimer leur enregistrement.
-- PAS de policies ici — elles sont dans 011_rls_policies.sql.
-- ============================================================

create table if not exists public.stay_members (
  id         uuid        primary key default gen_random_uuid(),
  stay_id    uuid        not null references public.stays(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  role       text        not null default 'guest',
  -- status : gère le cycle de vie de l'invitation
  -- pending  → invitation envoyée, pas encore acceptée
  -- active   → membre actif avec accès complet selon son rôle
  -- inactive → membre désactivé (accès révoqué, données conservées)
  status     text        not null default 'pending',
  invited_by uuid        null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (stay_id, user_id),

  constraint stay_members_role_check check (
    role in ('owner', 'co_organizer', 'guest', 'viewer')
  ),
  constraint stay_members_status_check check (
    status in ('pending', 'active', 'inactive')
  )
);

create index if not exists stay_members_stay_id_idx    on public.stay_members (stay_id);
create index if not exists stay_members_user_id_idx    on public.stay_members (user_id);
create index if not exists stay_members_role_idx       on public.stay_members (role);
-- Index partiel : membres actifs uniquement (usage courant dans les fonctions helper)
create index if not exists stay_members_active_idx     on public.stay_members (stay_id, user_id)
  where status = 'active';

create trigger stay_members_updated_at
  before update on public.stay_members
  for each row execute function public.set_updated_at();

-- Trigger : création automatique du membre owner lors de la création d'un séjour.
-- Le owner est immédiatement actif (pas de pending).
create or replace function public.handle_stay_owner_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.stay_members (stay_id, user_id, role, status, invited_by)
  values (new.id, new.owner_id, 'owner', 'active', new.owner_id);
  return new;
end;
$$;

create trigger on_stay_created_add_owner
  after insert on public.stays
  for each row execute function public.handle_stay_owner_created();

comment on table public.stay_members is
  'Membres d''un séjour. Lie un profil à un séjour avec un rôle et un statut. Core SaaS.';
comment on column public.stay_members.status is
  'pending | active | inactive. pending = invitation envoyée. inactive = accès révoqué.';
comment on column public.stay_members.role is
  'owner | co_organizer | guest | viewer.';
comment on column public.stay_members.invited_by is
  'Profil ayant envoyé l''invitation. Conservé même si ce profil est supprimé (set null).';
