CREATE OR REPLACE FUNCTION public.sync_guest_arrival_event(
  p_guest_id UUID,
  p_stay_id UUID,
  p_guest_name TEXT,
  p_arrival_date DATE,
  p_arrival_time TIME
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_title TEXT;
  v_time TIME;
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  SELECT id
  INTO v_event_id
  FROM public.organization_events
  WHERE stay_id = p_stay_id
    AND source_type = 'guest'
    AND source_id = p_guest_id
  LIMIT 1;

  IF p_arrival_date IS NULL THEN
    IF v_event_id IS NOT NULL THEN
      DELETE FROM public.organization_events
      WHERE id = v_event_id;
    END IF;

    RETURN NULL;
  END IF;

  v_title := 'Arrivée de ' || p_guest_name;
  v_time := COALESCE(p_arrival_time, '00:00:00'::TIME);

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
      'arrivee',
      p_arrival_date,
      v_time,
      'confirmed',
      'guest',
      p_guest_id
    )
    RETURNING id INTO v_event_id;
  ELSE
    UPDATE public.organization_events
    SET
      title = v_title,
      event_date = p_arrival_date,
      start_time = v_time
    WHERE id = v_event_id;
  END IF;

  RETURN v_event_id;
END;
$$;