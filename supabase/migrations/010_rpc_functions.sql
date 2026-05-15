-- ============================================================
-- MIGRATION 010 — Fonctions RPC et fonctions métier Core
-- Créée après toutes les tables Core.
-- Contient les fonctions qui dépendent de files, guest_access_links,
-- alerts, notifications, activity_logs, stay_settings et feature flags.
-- ============================================================

-- ------------------------------------------------------------
-- Fonctions de gestion des membres (RPC protégées)
-- Ces fonctions encapsulent la logique métier sensible.
-- Le frontend ne doit PAS modifier stay_members directement.
-- ------------------------------------------------------------

-- Inviter un utilisateur dans un séjour (crée un membre en statut pending)
create or replace function public.invite_member(
  p_stay_id uuid,
  p_user_id uuid,
  p_role    text default 'guest'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
begin
  -- Vérifier que l'appelant est organisateur
  if not public.is_stay_organizer(p_stay_id) then
    raise exception 'Permission refusée : vous devez être organisateur pour inviter.';
  end if;

  -- Vérifier le rôle demandé
  if p_role not in ('co_organizer', 'guest', 'viewer') then
    raise exception 'Rôle invalide : %.', p_role;
  end if;

  insert into public.stay_members (stay_id, user_id, role, status, invited_by)
  values (p_stay_id, p_user_id, p_role, 'pending', auth.uid())
  on conflict (stay_id, user_id) do update
    set role       = excluded.role,
        status     = 'pending',
        invited_by = excluded.invited_by,
        updated_at = now()
  returning id into v_member_id;

  return v_member_id;
end;
$$;

-- Accepter une invitation (passe de pending à active)
create or replace function public.accept_invitation(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.stay_members
  set status     = 'active',
      updated_at = now()
  where stay_id = p_stay_id
    and user_id  = auth.uid()
    and status   = 'pending';

  if not found then
    raise exception 'Aucune invitation en attente pour ce séjour.';
  end if;
end;
$$;

-- Changer le rôle d'un membre (organisateur uniquement, avec protection du owner)
create or replace function public.change_member_role(
  p_stay_id   uuid,
  p_user_id   uuid,
  p_new_role  text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Vérifier que l'appelant est organisateur
  if not public.is_stay_organizer(p_stay_id) then
    raise exception 'Permission refusée : vous devez être organisateur.';
  end if;

  -- Vérifier le rôle cible
  if p_new_role not in ('co_organizer', 'guest', 'viewer') then
    raise exception 'Rôle invalide : %.', p_new_role;
  end if;

  -- Ne pas permettre de dégrader le owner via cette fonction
  if exists (
    select 1 from public.stay_members
    where stay_id = p_stay_id and user_id = p_user_id and role = 'owner'
  ) then
    raise exception 'Impossible de changer le rôle du owner — utiliser transfer_stay_ownership().';
  end if;

  update public.stay_members
  set role       = p_new_role,
      updated_at = now()
  where stay_id = p_stay_id
    and user_id  = p_user_id
    and status   = 'active';
end;
$$;

-- Supprimer un membre du séjour (organisateur uniquement)
-- Un owner ne peut pas être retiré — utiliser transfer_stay_ownership() d'abord.
create or replace function public.remove_member(
  p_stay_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_stay_organizer(p_stay_id) then
    raise exception 'Permission refusée : vous devez être organisateur.';
  end if;

  -- Protéger le owner
  if exists (
    select 1 from public.stay_members
    where stay_id = p_stay_id and user_id = p_user_id
      and role = 'owner' and status = 'active'
  ) then
    raise exception 'Impossible de retirer le owner — utiliser transfer_stay_ownership() d''abord.';
  end if;

  update public.stay_members
  set status     = 'inactive',
      updated_at = now()
  where stay_id = p_stay_id
    and user_id  = p_user_id;
end;
$$;

-- Quitter un séjour (l'utilisateur lui-même)
-- Un owner ne peut pas quitter sans transférer la propriété.
create or replace function public.leave_stay(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Vérifier que l'utilisateur est membre actif
  if not public.is_stay_member(p_stay_id) then
    raise exception 'Vous n''êtes pas membre actif de ce séjour.';
  end if;

  -- Protéger le owner
  if public.is_stay_owner(p_stay_id) then
    raise exception 'Le owner ne peut pas quitter le séjour — utiliser transfer_stay_ownership() d''abord.';
  end if;

  update public.stay_members
  set status     = 'inactive',
      updated_at = now()
  where stay_id = p_stay_id
    and user_id  = auth.uid();
end;
$$;

-- Transférer la propriété d'un séjour (owner uniquement)
-- Un séjour doit toujours avoir exactement un owner actif.
create or replace function public.transfer_stay_ownership(
  p_stay_id      uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_stay_owner(p_stay_id) then
    raise exception 'Seul le owner peut transférer la propriété.';
  end if;

  -- Vérifier que le nouveau owner est membre actif
  if not exists (
    select 1 from public.stay_members
    where stay_id = p_stay_id and user_id = p_new_owner_id and status = 'active'
  ) then
    raise exception 'Le nouveau owner doit être membre actif du séjour.';
  end if;

  -- Rétrograder l'ancien owner en co_organizer
  update public.stay_members
  set role       = 'co_organizer',
      updated_at = now()
  where stay_id = p_stay_id
    and user_id  = auth.uid();

  -- Promouvoir le nouveau owner
  update public.stay_members
  set role       = 'owner',
      updated_at = now()
  where stay_id = p_stay_id
    and user_id  = p_new_owner_id;

  -- Autoriser explicitement la modification de owner_id par cette fonction seulement
  perform set_config('app.allow_owner_transfer', 'true', true);

  -- Mettre à jour owner_id sur stays
  update public.stays
  set owner_id   = p_new_owner_id,
      updated_at = now()
  where id = p_stay_id;

  -- Réinitialiser immédiatement pour ne pas laisser la config active
  perform set_config('app.allow_owner_transfer', 'false', true);
end;
$$;

-- ------------------------------------------------------------
-- Fonctions RPC pour stays (actions sensibles encapsulées)
-- ------------------------------------------------------------

-- Archiver un séjour (owner uniquement)
create or replace function public.archive_stay(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_stay_owner(p_stay_id) then
    raise exception 'Seul le owner peut archiver un séjour.';
  end if;

  update public.stays
  set status      = 'archived',
      archived_at = now(),
      updated_at  = now()
  where id = p_stay_id;
end;
$$;

-- ------------------------------------------------------------
-- Fonctions utilitaires de lecture (stables, sans écriture)
-- ------------------------------------------------------------

-- Vérifier si une feature est activée pour un séjour
create or replace function public.is_feature_enabled(p_stay_id uuid, p_feature_key text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select is_enabled
      from public.stay_enabled_features
      where stay_id    = p_stay_id
        and feature_key = p_feature_key
      limit 1
    ),
    false
  );
$$;

-- Obtenir le rôle de l'utilisateur courant dans un séjour (null si non membre)
create or replace function public.get_my_role(p_stay_id uuid)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select role
  from public.stay_members
  where stay_id = p_stay_id
    and user_id  = auth.uid()
    and status   = 'active'
  limit 1;
$$;

-- Enregistrer une action dans le journal d'activité
-- Utilisée par le backend et les autres fonctions — jamais directement par le frontend.
create or replace function public.log_activity(
  p_stay_id     uuid,
  p_action      text,
  p_entity_type text  default null,
  p_entity_id   uuid  default null,
  p_metadata    jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_log_id uuid;
begin
  insert into public.activity_logs (
    stay_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  values (
    p_stay_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

-- Créer une notification pour un utilisateur (backend uniquement)
create or replace function public.create_notification(
  p_stay_id     uuid,
  p_user_id     uuid,
  p_type        text,
  p_title       text,
  p_message     text  default null,
  p_entity_type text  default null,
  p_entity_id   uuid  default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notif_id uuid;
begin
  insert into public.notifications (
    stay_id, user_id, type, title, message, entity_type, entity_id
  )
  values (
    p_stay_id, p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id
  )
  returning id into v_notif_id;

  return v_notif_id;
end;
$$;

-- Résoudre une alerte (membres actifs du séjour)
create or replace function public.resolve_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stay_id uuid;
begin
  select stay_id into v_stay_id
  from public.alerts
  where id = p_alert_id;

  if not public.is_stay_member(v_stay_id) then
    raise exception 'Permission refusée.';
  end if;

  update public.alerts
  set status      = 'resolved',
      resolved_at = now(),
      resolved_by = auth.uid()
  where id     = p_alert_id
    and status  = 'open';
end;
$$;

-- Ignorer une alerte
create or replace function public.ignore_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stay_id uuid;
begin
  select stay_id into v_stay_id
  from public.alerts
  where id = p_alert_id;

  if not public.is_stay_member(v_stay_id) then
    raise exception 'Permission refusée.';
  end if;

  update public.alerts
  set status      = 'ignored',
      resolved_at = now(),
      resolved_by = auth.uid()
  where id     = p_alert_id
    and status  = 'open';
end;
$$;

-- Marquer toutes les notifications d'un séjour comme lues
create or replace function public.mark_notifications_read(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.notifications
  set is_read  = true,
      read_at  = now()
  where stay_id = p_stay_id
    and user_id  = auth.uid()
    and is_read  = false;
end;
$$;

-- Score de préparation d'un séjour (0-100)
create or replace function public.get_preparation_score(p_stay_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_score             integer := 0;
  v_total_guests      integer;
  v_confirmed_guests  integer;
begin
  if not public.is_stay_member(p_stay_id) then
    return 0;
  end if;

  -- +20 : date confirmée
  if exists (
    select 1 from public.stays
    where id = p_stay_id and start_date is not null and end_date is not null
  ) then
    v_score := v_score + 20;
  end if;

  -- +20 : lieu confirmé
  if exists (
    select 1 from public.stays
    where id = p_stay_id and location_name is not null
  ) then
    v_score := v_score + 20;
  end if;

  -- +20 : au moins un invité confirmé
  select count(*) into v_confirmed_guests
  from public.guests
  where stay_id = p_stay_id and status = 'confirmed';

  if v_confirmed_guests > 0 then
    v_score := v_score + 20;
  end if;

  -- +20 : taux de confirmation >= 80%
  select count(*) into v_total_guests
  from public.guests
  where stay_id = p_stay_id and status not in ('declined', 'cancelled');

  if v_total_guests > 0 and (v_confirmed_guests::float / v_total_guests) >= 0.8 then
    v_score := v_score + 20;
  end if;

  -- +20 : aucune alerte critique ouverte
  if not exists (
    select 1 from public.alerts
    where stay_id = p_stay_id and status = 'open' and severity = 'critical'
  ) then
    v_score := v_score + 20;
  end if;

  return least(v_score, 100);
end;
$$;


-- Fonction de résolution d'un token invité.
-- Le backend génère un token aléatoire, calcule son SHA-256, l'envoie par email.
-- Ici on reçoit le token en clair, on le hache, on cherche le hash.
-- On met à jour last_used_at à chaque accès valide.
create or replace function public.resolve_guest_access_token(p_token text)
returns table (
  guest_id    uuid,
  stay_id     uuid,
  permissions jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
begin
  -- Calculer le SHA-256 du token reçu (encode en hex)
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Mettre à jour last_used_at si le token est valide
  update public.guest_access_links
  set last_used_at = now()
  where token_hash = v_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  -- Retourner les infos si le token est valide
  return query
    select
      gal.guest_id,
      gal.stay_id,
      gal.permissions
    from public.guest_access_links gal
    where gal.token_hash = v_hash
      and gal.revoked_at is null
      and (gal.expires_at is null or gal.expires_at > now())
    limit 1;
end;
$$;



-- ------------------------------------------------------------
-- Permissions d'exécution explicites
-- Par défaut PostgreSQL donne EXECUTE à PUBLIC sur les fonctions.
-- On retire ces droits puis on réattribue seulement ce qui est nécessaire.
-- ------------------------------------------------------------

-- Fonctions appelables par le frontend authentifié
revoke execute on function public.invite_member(uuid, uuid, text) from public, anon;
grant execute on function public.invite_member(uuid, uuid, text) to authenticated;

revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

revoke execute on function public.change_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.change_member_role(uuid, uuid, text) to authenticated;

revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

revoke execute on function public.leave_stay(uuid) from public, anon;
grant execute on function public.leave_stay(uuid) to authenticated;

revoke execute on function public.transfer_stay_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_stay_ownership(uuid, uuid) to authenticated;

revoke execute on function public.archive_stay(uuid) from public, anon;
grant execute on function public.archive_stay(uuid) to authenticated;

revoke execute on function public.is_feature_enabled(uuid, text) from public, anon;
grant execute on function public.is_feature_enabled(uuid, text) to authenticated;

revoke execute on function public.get_my_role(uuid) from public, anon;
grant execute on function public.get_my_role(uuid) to authenticated;

revoke execute on function public.resolve_alert(uuid) from public, anon;
grant execute on function public.resolve_alert(uuid) to authenticated;

revoke execute on function public.ignore_alert(uuid) from public, anon;
grant execute on function public.ignore_alert(uuid) to authenticated;

revoke execute on function public.mark_notifications_read(uuid) from public, anon;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

revoke execute on function public.get_preparation_score(uuid) from public, anon;
grant execute on function public.get_preparation_score(uuid) to authenticated;

-- Accès token invité : peut être appelé depuis un endpoint backend ou un flux anon contrôlé.
-- Ne retourne que guest_id, stay_id et permissions, jamais le token/hash.
revoke execute on function public.resolve_guest_access_token(text) from public;
grant execute on function public.resolve_guest_access_token(text) to anon, authenticated;

-- Fonctions internes : backend/service_role uniquement.
-- Le frontend ne doit pas pouvoir créer de faux logs ou notifications.
revoke execute on function public.log_activity(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.log_activity(uuid, text, text, uuid, jsonb) to service_role;

revoke execute on function public.create_notification(uuid, uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, uuid, text, text, text, text, uuid) to service_role;
