-- ============================================================
-- MIGRATION 012 — Vues (security_invoker = true)
-- Les vues utilisent security_invoker pour respecter la RLS
-- de l'utilisateur appelant. Elles n'élèvent pas les droits.
-- Créées en dernier car elles agrègent toutes les tables Core.
-- ============================================================

-- ------------------------------------------------------------
-- VUE : profiles_public
-- Champs non sensibles lisibles par les membres d'un séjour commun.
-- Exclut l'email pour éviter l'exposition de données personnelles.
-- ------------------------------------------------------------
create or replace view public.profiles_public
with (security_invoker = true)
as
  select
    id,
    first_name,
    last_name,
    avatar_url,
    created_at
  from public.profiles;

comment on view public.profiles_public is
  'Champs publics du profil. Exclut l''email. Respecte la RLS de profiles. Core SaaS.';

-- ------------------------------------------------------------
-- VUE : stays_summary
-- Séjours avec compteurs agrégés.
-- Utilisée pour la liste des séjours et le tableau de bord.
-- security_invoker = true : la RLS de stays s'applique.
-- ------------------------------------------------------------
create or replace view public.stays_summary
with (security_invoker = true)
as
  select
    s.id,
    s.owner_id,
    s.title,
    s.description,
    s.status,
    s.start_date,
    s.end_date,
    s.location_name,
    s.timezone,
    s.archived_at,
    s.created_at,
    s.updated_at,
    -- Nombre de membres actifs
    (
      select count(*)::int
      from public.stay_members sm
      where sm.stay_id = s.id and sm.status = 'active'
    ) as active_member_count,
    -- Nombre d'invités actifs (non refusés, non annulés)
    (
      select count(*)::int
      from public.guests g
      where g.stay_id = s.id
        and g.status not in ('declined', 'cancelled')
    ) as guest_count,
    -- Nombre d'invités confirmés
    (
      select count(*)::int
      from public.guests g
      where g.stay_id = s.id and g.status = 'confirmed'
    ) as confirmed_guest_count,
    -- Alertes critiques ouvertes
    (
      select count(*)::int
      from public.alerts a
      where a.stay_id = s.id
        and a.status = 'open'
        and a.severity = 'critical'
    ) as critical_alerts_count,
    -- Total des alertes ouvertes
    (
      select count(*)::int
      from public.alerts a
      where a.stay_id = s.id and a.status = 'open'
    ) as open_alerts_count
  from public.stays s;

comment on view public.stays_summary is
  'Séjours avec compteurs agrégés. security_invoker : RLS de stays appliquée. Core SaaS.';

-- ------------------------------------------------------------
-- VUE : guests_summary
-- Récapitulatif des invités avec infos calculées.
-- La fiche invité EST un récapitulatif — elle ne stocke pas
-- les données des modules (couchage, repas, dépenses).
-- Ces informations sont lues depuis les modules via leurs APIs.
-- ------------------------------------------------------------
create or replace view public.guests_summary
with (security_invoker = true)
as
  select
    g.id,
    g.stay_id,
    g.linked_user_id,
    g.managed_by_user_id,
    g.first_name,
    g.last_name,
    g.category,
    g.status,
    g.color,
    g.arrival_at,
    g.departure_at,
    g.food_preferences,
    g.notes,
    g.created_at,
    g.updated_at,
    -- Durée de présence calculée (en heures, null si dates manquantes)
    case
      when g.arrival_at is not null and g.departure_at is not null
        then round(
          extract(epoch from (g.departure_at - g.arrival_at)) / 3600.0,
          1
        )
      else null
    end as presence_hours,
    -- Avatar du compte lié (si disponible)
    p.avatar_url  as linked_user_avatar_url,
    p.first_name  as linked_user_first_name,
    p.last_name   as linked_user_last_name
  from public.guests g
  left join public.profiles p on p.id = g.linked_user_id;

comment on view public.guests_summary is
  'Récapitulatif des invités. Ne duplique pas les données des modules. security_invoker. Core SaaS.';

-- ------------------------------------------------------------
-- VUE : my_stays
-- Séjours de l'utilisateur courant avec son rôle.
-- Utilisée pour la page d'accueil de l'application.
-- ------------------------------------------------------------
create or replace view public.my_stays
with (security_invoker = true)
as
  select
    ss.*,
    sm.role          as my_role,
    sm.status        as my_member_status
  from public.stays_summary ss
  join public.stay_members sm
    on sm.stay_id = ss.id
   and sm.user_id  = auth.uid()
  where sm.status in ('active', 'pending')
  order by ss.created_at desc;

comment on view public.my_stays is
  'Séjours de l''utilisateur courant avec son rôle. Filtre automatique par auth.uid(). Core SaaS.';

-- ------------------------------------------------------------
-- VUE : stay_open_alerts
-- Alertes ouvertes par séjour (critique en premier).
-- Utilisée par le dashboard et le bandeau d'alertes.
-- ------------------------------------------------------------
create or replace view public.stay_open_alerts
with (security_invoker = true)
as
  select *
  from public.alerts
  where status = 'open'
  order by
    case severity
      when 'critical' then 1
      when 'warning'  then 2
      when 'info'     then 3
    end,
    created_at desc;

comment on view public.stay_open_alerts is
  'Alertes ouvertes, triées par sévérité. security_invoker. Core SaaS.';
