-- ============================================================
-- 022_enable_all_stay_features.sql
-- Active tous les modules pour tous les séjours
-- ============================================================

-- 1. Activer tous les modules pour les séjours déjà existants
INSERT INTO public.stay_enabled_features (stay_id, feature_key, is_enabled)
SELECT s.id, feature_key, true
FROM public.stays s
CROSS JOIN (
  VALUES
    ('guests'),
    ('organisation'),
    ('logistics'),
    ('budget'),
    ('memories')
) AS features(feature_key)
ON CONFLICT (stay_id, feature_key)
DO UPDATE SET is_enabled = true;


-- 2. Fonction pour activer tous les modules à la création d'un nouveau séjour
CREATE OR REPLACE FUNCTION public.enable_all_features_for_new_stay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stay_enabled_features (stay_id, feature_key, is_enabled)
  VALUES
    (NEW.id, 'guests', true),
    (NEW.id, 'organisation', true),
    (NEW.id, 'logistics', true),
    (NEW.id, 'budget', true),
    (NEW.id, 'memories', true)
  ON CONFLICT (stay_id, feature_key)
  DO UPDATE SET is_enabled = true;

  RETURN NEW;
END;
$$;


-- 3. Trigger sur les nouveaux séjours
DROP TRIGGER IF EXISTS trg_enable_all_features_for_new_stay ON public.stays;

CREATE TRIGGER trg_enable_all_features_for_new_stay
AFTER INSERT ON public.stays
FOR EACH ROW
EXECUTE FUNCTION public.enable_all_features_for_new_stay();