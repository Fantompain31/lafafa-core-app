-- ============================================================
-- Migration 032 — La Fafa
-- Sync départ membre + nettoyage centralisé des attributions
-- + quitter séjour + suppression membre par owner
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Départ membre → événement Planning/Organisation
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_guest_departure_event(
  p_guest_id       UUID,
  p_stay_id        UUID,
  p_guest_name     TEXT,
  p_departure_date DATE,
  p_departure_time TIME DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_title    TEXT;
  v_time     TIME;
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  -- Sécurité : l'événement ne peut être synchronisé que pour une fiche du séjour.
  IF NOT EXISTS (
    SELECT 1
    FROM public.guests g
    WHERE g.id = p_guest_id
      AND g.stay_id = p_stay_id
  ) THEN
    RAISE EXCEPTION 'guest_not_found';
  END IF;

  SELECT oe.id INTO v_event_id
  FROM public.organization_events oe
  WHERE oe.stay_id = p_stay_id
    AND oe.source_type = 'guest_departure'
    AND oe.source_id = p_guest_id
  LIMIT 1;

  -- Date supprimée → suppression de l'événement automatique lié.
  IF p_departure_date IS NULL THEN
    IF v_event_id IS NOT NULL THEN
      DELETE FROM public.organization_events
      WHERE id = v_event_id;
    END IF;

    RETURN NULL;
  END IF;

  v_title := 'Départ de ' || COALESCE(NULLIF(TRIM(p_guest_name), ''), 'un membre');
  v_time := COALESCE(p_departure_time, '00:00:00'::TIME);

  IF v_event_id IS NULL THEN
    INSERT INTO public.organization_events (
      stay_id,
      created_by,
      title,
      event_type,
      event_date,
      start_time,
      status,
      source_type,
      source_id
    )
    VALUES (
      p_stay_id,
      auth.uid(),
      v_title,
      'depart',
      p_departure_date,
      v_time,
      'confirmed',
      'guest_departure',
      p_guest_id
    )
    RETURNING id INTO v_event_id;
  ELSE
    UPDATE public.organization_events
    SET title = v_title,
        event_date = p_departure_date,
        start_time = v_time
    WHERE id = v_event_id;
  END IF;

  RETURN v_event_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. Nettoyage centralisé des attributions d'un membre
-- ─────────────────────────────────────────────────────────────
-- Cette fonction ne supprime pas les objets du séjour.
-- Elle retire uniquement le guest_id des attributions connues.
-- Les futurs modules devront ajouter leur nettoyage ici.

CREATE OR REPLACE FUNCTION public.unassign_guest_everywhere(
  p_guest_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_linked_user UUID;
BEGIN
  SELECT g.stay_id, g.linked_user_id
  INTO v_stay_id, v_linked_user
  FROM public.guests g
  WHERE g.id = p_guest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_not_found';
  END IF;

  -- Sécurité : l'owner peut libérer n'importe quelle fiche du séjour.
  -- Le membre lié à la fiche peut libérer uniquement sa propre fiche.
  IF NOT (
    public.is_stay_owner(v_stay_id)
    OR (
      v_linked_user IS NOT NULL
      AND v_linked_user = auth.uid()
      AND public.is_stay_member(v_stay_id)
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Logistique : les items restent dans le séjour, ils repassent en non attribué.
  IF to_regclass('public.logistics_items') IS NOT NULL THEN
    UPDATE public.logistics_items
    SET assigned_guest_id = NULL
    WHERE assigned_guest_id = p_guest_id;
  END IF;

  -- Couchage : modèle avec table d'assignations.
  -- On supprime seulement les assignations du membre, pas les pièces/couchages.
  IF to_regclass('public.accommodation_assignments') IS NOT NULL THEN
    DELETE FROM public.accommodation_assignments
    WHERE guest_id = p_guest_id;
  END IF;

  -- Couchage : fallback si le modèle contient une colonne assigned_guest_id directement.
  IF to_regclass('public.accommodation_beds') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'accommodation_beds'
         AND column_name = 'assigned_guest_id'
     ) THEN
    UPDATE public.accommodation_beds
    SET assigned_guest_id = NULL
    WHERE assigned_guest_id = p_guest_id;
  END IF;

  -- Futurs modules : ajouter ici les nettoyages centralisés.
  -- Exemple : UPDATE meal_tasks SET assigned_guest_id = NULL WHERE assigned_guest_id = p_guest_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 3. Quitter un séjour
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.leave_stay(
  p_stay_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
  v_member_role TEXT;
BEGIN
  SELECT sm.role
  INTO v_member_role
  FROM public.stay_members sm
  WHERE sm.stay_id = p_stay_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF v_member_role = 'owner' THEN
    RAISE EXCEPTION 'owner_cannot_leave';
  END IF;

  SELECT g.id
  INTO v_guest_id
  FROM public.guests g
  WHERE g.stay_id = p_stay_id
    AND g.linked_user_id = auth.uid()
  LIMIT 1;

  IF v_guest_id IS NOT NULL THEN
    -- Événements automatiques arrivée/départ liés à cette fiche.
    DELETE FROM public.organization_events
    WHERE stay_id = p_stay_id
      AND source_type IN ('guest', 'guest_arrival', 'guest_departure')
      AND source_id = v_guest_id;

    -- Attributions de tous les modules connus.
    PERFORM public.unassign_guest_everywhere(v_guest_id);

    -- La fiche reste comme trace du séjour, mais elle est détachée et sans horaires.
    UPDATE public.guests
    SET arrival_at = NULL,
        departure_at = NULL,
        status = 'cancelled',
        linked_user_id = NULL
    WHERE id = v_guest_id;
  END IF;

  UPDATE public.stay_members
  SET status = 'inactive'
  WHERE stay_id = p_stay_id
    AND user_id = auth.uid();
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4. Supprimer un membre du séjour par l'owner
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.remove_guest_from_stay(
  p_guest_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_linked_user UUID;
BEGIN
  SELECT g.stay_id, g.linked_user_id
  INTO v_stay_id, v_linked_user
  FROM public.guests g
  WHERE g.id = p_guest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_not_found';
  END IF;

  IF NOT public.is_stay_owner(v_stay_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- On ne supprime pas la fiche liée au propriétaire du séjour.
  IF v_linked_user IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.stay_members sm
    WHERE sm.stay_id = v_stay_id
      AND sm.user_id = v_linked_user
      AND sm.role = 'owner'
      AND sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'owner_guest_cannot_be_removed';
  END IF;

  DELETE FROM public.organization_events
  WHERE stay_id = v_stay_id
    AND source_type IN ('guest', 'guest_arrival', 'guest_departure')
    AND source_id = p_guest_id;

  PERFORM public.unassign_guest_everywhere(p_guest_id);

  IF v_linked_user IS NOT NULL THEN
    UPDATE public.stay_members
    SET status = 'inactive'
    WHERE stay_id = v_stay_id
      AND user_id = v_linked_user;
  END IF;

  IF to_regclass('public.stay_invitations') IS NOT NULL THEN
    UPDATE public.stay_invitations
    SET status = 'revoked'
    WHERE stay_id = v_stay_id
      AND guest_id = p_guest_id
      AND status = 'pending';
  END IF;

  IF to_regclass('public.guest_access_links') IS NOT NULL THEN
    UPDATE public.guest_access_links
    SET is_active = FALSE
    WHERE stay_id = v_stay_id
      AND guest_id = p_guest_id;
  END IF;

  DELETE FROM public.guests
  WHERE id = p_guest_id;
END;
$$;
