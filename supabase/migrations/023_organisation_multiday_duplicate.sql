-- ============================================================
-- Migration 019 — Organisation : end_date multi-jours + duplicate
-- La Fafa — mai 2026
-- ============================================================

-- Ajout de la colonne end_date (nullable — NULL = événement sur 1 seul jour)
ALTER TABLE public.organization_events
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Contrainte : end_date >= event_date si renseignée
ALTER TABLE public.organization_events
  DROP CONSTRAINT IF EXISTS chk_end_date_after_start;
ALTER TABLE public.organization_events
  ADD CONSTRAINT chk_end_date_after_start
    CHECK (end_date IS NULL OR end_date >= event_date);

-- Mise à jour de la RPC create_organization_event
CREATE OR REPLACE FUNCTION public.create_organization_event(
  p_stay_id     UUID,
  p_title       TEXT,
  p_event_type  TEXT,
  p_event_date  DATE,
  p_start_time  TIME,
  p_end_time    TIME     DEFAULT NULL,
  p_end_date    DATE     DEFAULT NULL,
  p_location    TEXT     DEFAULT NULL,
  p_description TEXT     DEFAULT NULL,
  p_status      TEXT     DEFAULT 'confirmed'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF NOT is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stay_enabled_features
    WHERE stay_id = p_stay_id AND feature_key = 'organisation' AND is_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;

  INSERT INTO organization_events (
    stay_id, created_by, title, event_type,
    event_date, start_time, end_time, end_date,
    location, description, status
  )
  VALUES (
    p_stay_id, auth.uid(), p_title, p_event_type,
    p_event_date, p_start_time, p_end_time, p_end_date,
    p_location, p_description, p_status
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Mise à jour de la RPC update_organization_event
CREATE OR REPLACE FUNCTION public.update_organization_event(
  p_event_id    UUID,
  p_title       TEXT,
  p_event_type  TEXT,
  p_event_date  DATE,
  p_start_time  TIME,
  p_end_time    TIME     DEFAULT NULL,
  p_end_date    DATE     DEFAULT NULL,
  p_location    TEXT     DEFAULT NULL,
  p_description TEXT     DEFAULT NULL,
  p_status      TEXT     DEFAULT 'confirmed'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
BEGIN
  SELECT stay_id INTO v_stay_id FROM organization_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF NOT (
    (SELECT created_by FROM organization_events WHERE id = p_event_id) = auth.uid()
    OR is_stay_organizer(v_stay_id)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE organization_events SET
    title       = p_title,
    event_type  = p_event_type,
    event_date  = p_event_date,
    start_time  = p_start_time,
    end_time    = p_end_time,
    end_date    = p_end_date,
    location    = p_location,
    description = p_description,
    status      = p_status
  WHERE id = p_event_id;
END;
$$;

-- RPC duplicate_organization_event
CREATE OR REPLACE FUNCTION public.duplicate_organization_event(
  p_event_id UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src organization_events%ROWTYPE;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_src FROM organization_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF NOT is_stay_member(v_src.stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO organization_events (
    stay_id, created_by, title, event_type,
    event_date, start_time, end_time, end_date,
    location, description, status
  )
  VALUES (
    v_src.stay_id, auth.uid(),
    v_src.title || ' (copie)',
    v_src.event_type,
    v_src.event_date, v_src.start_time, v_src.end_time, v_src.end_date,
    v_src.location, v_src.description, v_src.status
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
