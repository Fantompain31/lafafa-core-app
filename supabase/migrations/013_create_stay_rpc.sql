CREATE OR REPLACE FUNCTION create_stay(
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO stays (title, location_name, start_date, end_date, description, owner_id, status)
  VALUES (p_name, p_destination, p_start_date, p_end_date, p_description, v_user_id, 'confirmed')
  RETURNING id INTO v_stay_id;

  INSERT INTO stay_enabled_features (stay_id, feature_key)
  VALUES
    (v_stay_id, 'guests'),
    (v_stay_id, 'organization');

  PERFORM log_activity(v_stay_id, 'stay_created', 'stay', v_stay_id, '{}'::jsonb);

  RETURN v_stay_id;
END;
$$;