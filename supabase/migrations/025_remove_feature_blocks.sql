-- ============================================================
-- 025_remove_feature_blocks.sql
-- La Fafa : tous les modules sont toujours activés
-- On supprime les blocages par feature flag dans les RPC.
-- ============================================================

-- Sécurité globale : si du code appelle encore is_feature_enabled,
-- on retourne toujours true.
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_stay_id UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TRUE;
$$;


-- ============================================================
-- Organisation : create_organization_event sans feature check
-- Signature avec end_date, utilisée par ton service actuel.
-- ============================================================

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO public.organization_events (
    stay_id,
    created_by,
    title,
    event_type,
    event_date,
    start_time,
    end_time,
    end_date,
    location,
    description,
    status
  )
  VALUES (
    p_stay_id,
    auth.uid(),
    trim(p_title),
    p_event_type,
    p_event_date,
    p_start_time,
    p_end_time,
    p_end_date,
    p_location,
    p_description,
    COALESCE(p_status, 'confirmed')
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;


-- ============================================================
-- Logistique : section liée à Organisation sans feature check
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_logistics_section_for_source(
  p_stay_id      UUID,
  p_title        TEXT,
  p_section_type TEXT,
  p_source_type  TEXT,
  p_source_id    UUID,
  p_notes        TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_id UUID;
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF p_source_type IS NULL OR length(trim(p_source_type)) = 0 OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'source_required';
  END IF;

  SELECT id
  INTO v_section_id
  FROM public.logistics_sections
  WHERE stay_id = p_stay_id
    AND source_type = p_source_type
    AND source_id = p_source_id
  LIMIT 1;

  IF v_section_id IS NOT NULL THEN
    UPDATE public.logistics_sections
    SET is_hidden = false
    WHERE id = v_section_id;

    RETURN v_section_id;
  END IF;

  INSERT INTO public.logistics_sections (
    stay_id,
    title,
    section_type,
    notes,
    source_type,
    source_id,
    created_by
  )
  VALUES (
    p_stay_id,
    trim(p_title),
    COALESCE(NULLIF(trim(p_section_type), ''), 'autre'),
    p_notes,
    trim(p_source_type),
    p_source_id,
    auth.uid()
  )
  RETURNING id INTO v_section_id;

  RETURN v_section_id;
END;
$$;


-- ============================================================
-- Logistique : création manuelle sans feature check
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_manual_logistics_section(
  p_stay_id      UUID,
  p_title        TEXT,
  p_section_type TEXT DEFAULT 'autre',
  p_notes        TEXT DEFAULT NULL
)
RETURNS public.logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section public.logistics_sections;
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  INSERT INTO public.logistics_sections (
    stay_id,
    title,
    section_type,
    notes,
    created_by
  )
  VALUES (
    p_stay_id,
    trim(p_title),
    COALESCE(NULLIF(trim(p_section_type), ''), 'autre'),
    p_notes,
    auth.uid()
  )
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;


-- ============================================================
-- RPC appelée par ton front après création d'un séjour.
-- Elle reste utile, mais ne doit jamais bloquer.
-- On met les deux noms : organisation et organization
-- car ton ancienne RPC create_stay utilisait "organization".
-- ============================================================

CREATE OR REPLACE FUNCTION public.enable_all_features_for_stay(
  p_stay_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO public.stay_enabled_features (stay_id, feature_key, is_enabled)
  VALUES
    (p_stay_id, 'guests', true),
    (p_stay_id, 'organisation', true),
    (p_stay_id, 'organization', true),
    (p_stay_id, 'logistics', true),
    (p_stay_id, 'budget', true),
    (p_stay_id, 'memories', true),
    (p_stay_id, 'souvenirs', true)
  ON CONFLICT (stay_id, feature_key)
  DO UPDATE SET is_enabled = true;
END;
$$;


-- ============================================================
-- Nettoyage pour les séjours déjà existants.
-- ============================================================

INSERT INTO public.stay_enabled_features (stay_id, feature_key, is_enabled)
SELECT s.id, f.feature_key, true
FROM public.stays s
CROSS JOIN (
  VALUES
    ('guests'),
    ('organisation'),
    ('organization'),
    ('logistics'),
    ('budget'),
    ('memories'),
    ('souvenirs')
) AS f(feature_key)
ON CONFLICT (stay_id, feature_key)
DO UPDATE SET is_enabled = true;