-- ============================================================
-- 026_create_my_guest_rpc.sql
-- Créer ou récupérer la fiche invitée liée à l'utilisateur connecté
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_my_guest(
  p_stay_id UUID,
  p_first_name TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'adult',
  p_status TEXT DEFAULT 'confirmed',
  p_color TEXT DEFAULT NULL,
  p_arrival_at TIMESTAMPTZ DEFAULT NULL,
  p_departure_at TIMESTAMPTZ DEFAULT NULL,
  p_food_preferences JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_guest_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_first_name IS NULL OR length(trim(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'first_name_required';
  END IF;

  -- Si une fiche est déjà liée à ce compte pour ce séjour, on la met à jour
  SELECT id
  INTO v_guest_id
  FROM public.guests
  WHERE stay_id = p_stay_id
    AND linked_user_id = v_user_id
  LIMIT 1;

  IF v_guest_id IS NOT NULL THEN
    UPDATE public.guests
    SET
      first_name = trim(p_first_name),
      last_name = NULLIF(trim(COALESCE(p_last_name, '')), ''),
      category = COALESCE(p_category, 'adult'),
      status = COALESCE(p_status, 'confirmed'),
      color = NULLIF(trim(COALESCE(p_color, '')), ''),
      arrival_at = p_arrival_at,
      departure_at = p_departure_at,
      food_preferences = COALESCE(p_food_preferences, '{}'::jsonb),
      notes = NULLIF(trim(COALESCE(p_notes, '')), '')
    WHERE id = v_guest_id;

    RETURN v_guest_id;
  END IF;

  -- Sinon on crée la fiche déjà liée au compte connecté
  INSERT INTO public.guests (
    stay_id,
    linked_user_id,
    first_name,
    last_name,
    category,
    status,
    color,
    arrival_at,
    departure_at,
    food_preferences,
    notes
  )
  VALUES (
    p_stay_id,
    v_user_id,
    trim(p_first_name),
    NULLIF(trim(COALESCE(p_last_name, '')), ''),
    COALESCE(p_category, 'adult'),
    COALESCE(p_status, 'confirmed'),
    NULLIF(trim(COALESCE(p_color, '')), ''),
    p_arrival_at,
    p_departure_at,
    COALESCE(p_food_preferences, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_guest_id;

  RETURN v_guest_id;
END;
$$;