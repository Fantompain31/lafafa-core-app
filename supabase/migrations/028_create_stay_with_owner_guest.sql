-- ============================================================
-- 027_create_stay_with_owner_guest.sql
-- Création de séjour + fiche invité automatique du créateur
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_stay(
  p_name TEXT,
  p_destination TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT 'sand'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_user_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_email TEXT;
  v_guest_first_name TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'stay_name_required';
  END IF;

  -- Récupération du profil utilisateur pour pré-remplir la fiche invité
  SELECT first_name, last_name, email
  INTO v_first_name, v_last_name, v_email
  FROM public.profiles
  WHERE id = v_user_id;

  v_guest_first_name := NULLIF(trim(COALESCE(v_first_name, '')), '');

  -- Fallback si le profil n'a pas encore de prénom
  IF v_guest_first_name IS NULL THEN
    v_guest_first_name := split_part(COALESCE(v_email, 'Créateur'), '@', 1);
  END IF;

  -- 1. Création du séjour
  INSERT INTO public.stays (
    title,
    location_name,
    start_date,
    end_date,
    description,
    owner_id,
    status
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_destination, '')), ''),
    p_start_date,
    p_end_date,
    NULLIF(trim(COALESCE(p_description, '')), ''),
    v_user_id,
    'confirmed'
  )
  RETURNING id INTO v_stay_id;

  -- 2. Le trigger on_stay_created_add_owner crée déjà stay_members owner.
  -- Donc on ne réinsère pas stay_members ici.

  -- 3. Activation des modules actuels/futurs connus
  INSERT INTO public.stay_enabled_features (stay_id, feature_key, is_enabled)
  VALUES
    (v_stay_id, 'guests', true),
    (v_stay_id, 'organisation', true),
    (v_stay_id, 'organization', true),
    (v_stay_id, 'logistics', true),
    (v_stay_id, 'budget', true),
    (v_stay_id, 'memories', true),
    (v_stay_id, 'souvenirs', true)
  ON CONFLICT (stay_id, feature_key)
  DO UPDATE SET is_enabled = true;

  -- 4. Création automatique de la fiche invité du créateur
  INSERT INTO public.guests (
    stay_id,
    linked_user_id,
    first_name,
    last_name,
    category,
    status,
    color,
    food_preferences,
    notes
  )
  VALUES (
    v_stay_id,
    v_user_id,
    v_guest_first_name,
    NULLIF(trim(COALESCE(v_last_name, '')), ''),
    'adult',
    'confirmed',
    NULLIF(trim(COALESCE(p_color, '')), ''),
    '{}'::jsonb,
    NULL
  )
  ON CONFLICT DO NOTHING;

  -- 5. Log activité si la fonction existe
  BEGIN
    PERFORM public.log_activity(
      v_stay_id,
      'stay_created',
      'stay',
      v_stay_id,
      '{}'::jsonb
    );
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  RETURN v_stay_id;
END;
$$;