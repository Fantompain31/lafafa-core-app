-- ============================================================
-- MIGRATION 003 — Table : stays
-- Table centrale des séjours.
-- PAS de policies ici — elles sont dans 011_rls_policies.sql.
-- La FK cover_image_file_id est ajoutée dans 007_files_storage.sql
-- après création de la table files.
-- ============================================================

create table if not exists public.stays (
  id                  uuid        primary key default gen_random_uuid(),
  owner_id            uuid        not null references public.profiles(id) on delete restrict,
  title               text        not null,
  description         text,
  -- cover_image_file_id : FK ajoutée après création de files (migration 008)
  cover_image_file_id uuid        null,
  status              text        not null default 'draft',
  start_date          date        null,
  end_date            date        null,
  location_name       text,
  location_address    text,
  location_url        text,
  timezone            text        not null default 'Europe/Paris',
  theme               jsonb       not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz null,

  constraint stays_status_check check (
    status in ('draft', 'polling', 'confirmed', 'in_progress', 'completed', 'archived')
  ),
  constraint stays_dates_check check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create index if not exists stays_owner_id_idx   on public.stays (owner_id);
create index if not exists stays_status_idx     on public.stays (status);
create index if not exists stays_start_date_idx on public.stays (start_date);
-- Index partiel : séjours non archivés (usage courant)
create index if not exists stays_active_idx     on public.stays (owner_id, status)
  where archived_at is null;

create trigger stays_updated_at
  before update on public.stays
  for each row execute function public.set_updated_at();

comment on table public.stays is
  'Séjours. Table centrale du Core SaaS.';
comment on column public.stays.status is
  'draft | polling | confirmed | in_progress | completed | archived';
comment on column public.stays.cover_image_file_id is
  'FK vers files(id). Contrainte ajoutée dans 007_files_storage.sql.';
comment on column public.stays.owner_id is
  'Propriétaire du séjour. Ne peut pas être modifié directement — utiliser transfer_stay_ownership().';

-- Protection : owner_id ne peut pas être modifié directement.
-- Seule la fonction transfer_stay_ownership() peut temporairement lever ce verrou
-- via set_config('app.allow_owner_transfer', 'true', true).
create or replace function public.prevent_direct_stay_owner_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'id d''un séjour ne peut pas être modifié.';
  end if;

  if new.owner_id is distinct from old.owner_id
     and coalesce(current_setting('app.allow_owner_transfer', true), 'false') <> 'true' then
    raise exception 'owner_id ne peut pas être modifié directement. Utiliser transfer_stay_ownership().';
  end if;
  return new;
end;
$$;

create trigger stays_prevent_direct_owner_change
  before update on public.stays
  for each row execute function public.prevent_direct_stay_owner_change();
