-- ============================================================
-- Migration 033 — Photo de couverture séjour
-- Ajoute les métadonnées de couverture dans les vues de séjour.
-- Le fichier reste stocké dans Supabase Storage / files.
-- ============================================================

ALTER TABLE public.stays
  ADD COLUMN IF NOT EXISTS cover_image_file_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stays_cover_image_file_id_fk'
  ) THEN
    ALTER TABLE public.stays
      ADD CONSTRAINT stays_cover_image_file_id_fk
      FOREIGN KEY (cover_image_file_id)
      REFERENCES public.files(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- my_stays dépend de stays_summary : on la recrée après.
DROP VIEW IF EXISTS public.my_stays;

CREATE OR REPLACE VIEW public.stays_summary
WITH (security_invoker = true)
AS
  SELECT
    s.id,
    s.owner_id,
    s.title,
    s.description,
    s.status,
    s.start_date,
    s.end_date,
    s.location_name,
    s.timezone,
    s.archived_at,
    s.created_at,
    s.updated_at,
    (
      SELECT count(*)::int
      FROM public.stay_members sm
      WHERE sm.stay_id = s.id AND sm.status = 'active'
    ) AS active_member_count,
    (
      SELECT count(*)::int
      FROM public.guests g
      WHERE g.stay_id = s.id
        AND g.status NOT IN ('declined', 'cancelled')
    ) AS guest_count,
    (
      SELECT count(*)::int
      FROM public.guests g
      WHERE g.stay_id = s.id AND g.status = 'confirmed'
    ) AS confirmed_guest_count,
    (
      SELECT count(*)::int
      FROM public.alerts a
      WHERE a.stay_id = s.id
        AND a.status = 'open'
        AND a.severity = 'critical'
    ) AS critical_alerts_count,
    (
      SELECT count(*)::int
      FROM public.alerts a
      WHERE a.stay_id = s.id AND a.status = 'open'
    ) AS open_alerts_count,
    s.cover_image_file_id,
    f.bucket       AS cover_image_bucket,
    f.storage_path AS cover_image_path
  FROM public.stays s
  LEFT JOIN public.files f ON f.id = s.cover_image_file_id;

CREATE OR REPLACE VIEW public.my_stays
WITH (security_invoker = true)
AS
  SELECT
    ss.*,
    sm.role   AS my_role,
    sm.status AS my_member_status
  FROM public.stays_summary ss
  JOIN public.stay_members sm
    ON sm.stay_id = ss.id
   AND sm.user_id = auth.uid()
  WHERE sm.status IN ('active', 'pending')
  ORDER BY ss.created_at DESC;
