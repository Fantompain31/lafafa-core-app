-- ============================================================
-- MIGRATION 006 — Fonctions d’accès minimales
-- Ces fonctions sont les seules créées avant les tables transversales.
-- Elles sont utilisées par les policies RLS et évitent les récursions.
-- Toutes incluent set search_path pour éviter les injections de schema.
-- ============================================================

-- ------------------------------------------------------------
-- Fonctions d'accès aux séjours
-- Utilisées dans la majorité des policies du Core et des modules.
-- Elles lisent stay_members directement sans passer par les RLS
-- (security definer contourne les policies sur la table lue).
-- Cela évite la récursion infinie dans les policies de stay_members.
-- ------------------------------------------------------------

-- Vérifier si l'utilisateur courant est membre actif d'un séjour
create or replace function public.is_stay_member(p_stay_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.stay_members sm
    where sm.stay_id = p_stay_id
      and sm.user_id = auth.uid()
      and sm.status  = 'active'
  );
$$;

-- Vérifier si l'utilisateur courant est organisateur actif (owner ou co_organizer)
create or replace function public.is_stay_organizer(p_stay_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.stay_members sm
    where sm.stay_id = p_stay_id
      and sm.user_id = auth.uid()
      and sm.status  = 'active'
      and sm.role in ('owner', 'co_organizer')
  );
$$;

-- Vérifier si l'utilisateur courant est le owner actif d'un séjour
create or replace function public.is_stay_owner(p_stay_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.stay_members sm
    where sm.stay_id = p_stay_id
      and sm.user_id = auth.uid()
      and sm.status  = 'active'
      and sm.role    = 'owner'
  );
$$;

-- Vérifier si l'utilisateur courant partage au moins un séjour avec un autre utilisateur.
-- Utilisée pour limiter la lecture des profils (voir RLS de profiles).
create or replace function public.shares_any_stay_with(p_other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.stay_members a
    join public.stay_members b
      on b.stay_id = a.stay_id
    where a.user_id = auth.uid()
      and b.user_id = p_other_user_id
      and a.status  = 'active'
      and b.status  = 'active'
  );
$$;



-- Extraire un stay_id depuis un chemin Supabase Storage.
-- Convention : {stay_id}/{kind}/{file_id}.ext
-- Retourne null au lieu de provoquer une erreur si le premier segment n'est pas un UUID valide.
create or replace function public.storage_path_stay_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_first_segment text;
begin
  v_first_segment := split_part(p_name, '/', 1);

  if v_first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_first_segment::uuid;
  end if;

  return null;
end;
$$;
