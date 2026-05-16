-- ============================================================
-- 022_logistics_hide_section.sql
-- Permet de masquer / réafficher une section logistique
-- ============================================================

CREATE OR REPLACE FUNCTION public.hide_logistics_section(
  p_section_id UUID,
  p_is_hidden BOOLEAN
)
RETURNS public.logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_section public.logistics_sections;
BEGIN
  SELECT stay_id
  INTO v_stay_id
  FROM public.logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'logistics_section_not_found';
  END IF;

  IF NOT public.is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  UPDATE public.logistics_sections
  SET is_hidden = p_is_hidden
  WHERE id = p_section_id
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;