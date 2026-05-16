-- ============================================================
-- 027_delete_stay_rpc.sql
-- Suppression définitive d'un séjour
-- Owner uniquement
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_stay(
  p_stay_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.stay_members
    WHERE stay_id = p_stay_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only_owner_can_delete_stay';
  END IF;

  DELETE FROM public.stays
  WHERE id = p_stay_id;
END;
$$;