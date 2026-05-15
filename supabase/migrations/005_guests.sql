-- ============================================================
-- MIGRATION 005 — Table : guests
-- Participants au séjour.
-- Un guest n'est PAS forcément un utilisateur avec compte.
-- Enfants, bébés, personnes sans compte → guest sans linked_user_id.
-- PAS de policies ici — elles sont dans 011_rls_policies.sql.
-- ============================================================

create table if not exists public.guests (
  id                  uuid        primary key default gen_random_uuid(),
  stay_id             uuid        not null references public.stays(id) on delete cascade,
  -- Lien faible vers un utilisateur si le guest a un compte
  linked_user_id      uuid        null references public.profiles(id) on delete set null,
  -- Utilisateur gérant cet invité (ex : parent d'un enfant)
  managed_by_user_id  uuid        null references public.profiles(id) on delete set null,
  first_name          text        not null,
  last_name           text,
  category            text        not null default 'adult',
  status              text        not null default 'invited',
  color               text,
  arrival_at          timestamptz null,
  departure_at        timestamptz null,
  -- JSON : { allergies: [], diet: "vegetarian", notes: "" }
  food_preferences    jsonb       not null default '{}',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint guests_category_check check (
    category in ('adult', 'child', 'baby')
  ),
  constraint guests_status_check check (
    status in ('invited', 'confirmed', 'maybe', 'declined', 'cancelled')
  ),
  constraint guests_dates_check check (
    arrival_at is null or departure_at is null or departure_at >= arrival_at
  )
);

create index if not exists guests_stay_id_idx        on public.guests (stay_id);
create index if not exists guests_linked_user_id_idx on public.guests (linked_user_id)
  where linked_user_id is not null;
create index if not exists guests_status_idx         on public.guests (stay_id, status);
-- Index partiel : invités actifs (non refusés, non annulés)
create index if not exists guests_active_idx         on public.guests (stay_id)
  where status not in ('declined', 'cancelled');

create trigger guests_updated_at
  before update on public.guests
  for each row execute function public.set_updated_at();

comment on table public.guests is
  'Participants au séjour. Un guest peut ne pas avoir de compte utilisateur. Core SaaS.';
comment on column public.guests.linked_user_id is
  'Si le guest possède un compte, référence vers profiles. Lien facultatif.';
comment on column public.guests.managed_by_user_id is
  'Utilisateur responsable de cet invité (ex : parent gérant un enfant).';
comment on column public.guests.food_preferences is
  'JSON libre : allergies, régimes, préférences alimentaires.';
comment on column public.guests.status is
  'invited | confirmed | maybe | declined | cancelled. Préférer cancelled à la suppression.';

-- Protection : certains liens sensibles ne doivent pas être modifiés via update direct.
-- Pour lier/délier un compte ou changer le gestionnaire, créer plus tard des RPC dédiées.
create or replace function public.prevent_direct_guest_sensitive_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.stay_id is distinct from old.stay_id then
    raise exception 'stay_id d''un invité ne peut pas être modifié.';
  end if;

  if new.linked_user_id is distinct from old.linked_user_id then
    raise exception 'linked_user_id ne peut pas être modifié directement. Utiliser une RPC dédiée.';
  end if;

  if new.managed_by_user_id is distinct from old.managed_by_user_id then
    raise exception 'managed_by_user_id ne peut pas être modifié directement. Utiliser une RPC dédiée.';
  end if;

  return new;
end;
$$;

create trigger guests_prevent_direct_sensitive_change
  before update on public.guests
  for each row execute function public.prevent_direct_guest_sensitive_change();
