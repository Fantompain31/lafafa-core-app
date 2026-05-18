-- ============================================================
-- 036_fix_logistics_section_type_rpc.sql
-- Corrige l'erreur "Invalid logistics section type" quand on modifie
-- une section logistique avec les nouveaux types utilisés par le front.
-- ============================================================


-- 0) PostgreSQL ne permet pas de changer le type de retour d'une fonction avec
-- CREATE OR REPLACE FUNCTION. On supprime donc les anciennes signatures avant
-- de les recréer proprement plus bas.
DROP FUNCTION IF EXISTS public.ensure_logistics_section_for_source(uuid,text,text,text,uuid,text);
DROP FUNCTION IF EXISTS public.create_logistics_section(uuid,text,text,text);
DROP FUNCTION IF EXISTS public.create_logistics_section(uuid,text,text,text,text,uuid);
DROP FUNCTION IF EXISTS public.create_manual_logistics_section(uuid,text,text,text);
DROP FUNCTION IF EXISTS public.update_logistics_section(uuid,text,text,text);

-- 1) On élargit la contrainte SQL pour accepter les anciens et nouveaux types.
ALTER TABLE public.logistics_sections
  DROP CONSTRAINT IF EXISTS logistics_sections_section_type_check;

ALTER TABLE public.logistics_sections
  ADD CONSTRAINT logistics_sections_section_type_check
  CHECK (section_type IN (
    -- Types actuels UI La Fafa
    'repas', 'apero', 'shopping', 'equipment', 'sleeping', 'transport',
    'menage', 'activite', 'autre',

    -- Types organisation / anciens modules
    'arrivee', 'depart', 'temps_libre',

    -- Anciens types anglais encore présents dans certains templates / anciennes données
    'meal', 'aperitif', 'cleaning', 'other'
  ));

-- 2) Petite fonction interne pour valider les types sans casser les anciennes valeurs.
CREATE OR REPLACE FUNCTION public.is_valid_logistics_section_type(p_section_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(trim(p_section_type), ''), 'autre') IN (
    'repas', 'apero', 'shopping', 'equipment', 'sleeping', 'transport',
    'menage', 'activite', 'autre',
    'arrivee', 'depart', 'temps_libre',
    'meal', 'aperitif', 'cleaning', 'other'
  );
$$;

-- 3) Création libre de section.
CREATE OR REPLACE FUNCTION public.create_logistics_section(
  p_stay_id UUID,
  p_title TEXT,
  p_section_type TEXT DEFAULT 'autre',
  p_notes TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS public.logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section public.logistics_sections;
  v_section_type TEXT := COALESCE(NULLIF(trim(p_section_type), ''), 'autre');
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF NOT public.is_valid_logistics_section_type(v_section_type) THEN
    RAISE EXCEPTION 'Invalid logistics section type';
  END IF;

  INSERT INTO public.logistics_sections (
    stay_id,
    title,
    section_type,
    notes,
    source_type,
    source_id,
    created_by
  ) VALUES (
    p_stay_id,
    trim(p_title),
    v_section_type,
    p_notes,
    p_source_type,
    p_source_id,
    auth.uid()
  )
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

-- 4) Création / récupération d'une section liée à une source.
CREATE OR REPLACE FUNCTION public.ensure_logistics_section_for_source(
  p_stay_id UUID,
  p_title TEXT,
  p_section_type TEXT DEFAULT 'autre',
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section public.logistics_sections;
  v_section_type TEXT := COALESCE(NULLIF(trim(p_section_type), ''), 'autre');
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_source_type IS NULL OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'source_required';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF NOT public.is_valid_logistics_section_type(v_section_type) THEN
    RAISE EXCEPTION 'Invalid logistics section type';
  END IF;

  SELECT * INTO v_section
  FROM public.logistics_sections
  WHERE stay_id = p_stay_id
    AND source_type = p_source_type
    AND source_id = p_source_id
  LIMIT 1;

  IF v_section.id IS NOT NULL THEN
    RETURN v_section;
  END IF;

  INSERT INTO public.logistics_sections (
    stay_id,
    title,
    section_type,
    notes,
    source_type,
    source_id,
    created_by
  ) VALUES (
    p_stay_id,
    trim(p_title),
    v_section_type,
    p_notes,
    p_source_type,
    p_source_id,
    auth.uid()
  )
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

-- 5) Création manuelle depuis la page Logistique.
CREATE OR REPLACE FUNCTION public.create_manual_logistics_section(
  p_stay_id UUID,
  p_title TEXT,
  p_section_type TEXT DEFAULT 'autre',
  p_notes TEXT DEFAULT NULL
)
RETURNS public.logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section public.logistics_sections;
  v_section_type TEXT := COALESCE(NULLIF(trim(p_section_type), ''), 'autre');
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF NOT public.is_valid_logistics_section_type(v_section_type) THEN
    RAISE EXCEPTION 'Invalid logistics section type';
  END IF;

  INSERT INTO public.logistics_sections (
    stay_id,
    title,
    section_type,
    notes,
    created_by
  ) VALUES (
    p_stay_id,
    trim(p_title),
    v_section_type,
    p_notes,
    auth.uid()
  )
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

-- 6) Modification d'une section existante.
CREATE OR REPLACE FUNCTION public.update_logistics_section(
  p_section_id UUID,
  p_title TEXT,
  p_section_type TEXT DEFAULT 'autre',
  p_notes TEXT DEFAULT NULL
)
RETURNS public.logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_section public.logistics_sections;
  v_section_type TEXT := COALESCE(NULLIF(trim(p_section_type), ''), 'autre');
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT public.is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF NOT public.is_valid_logistics_section_type(v_section_type) THEN
    RAISE EXCEPTION 'Invalid logistics section type';
  END IF;

  UPDATE public.logistics_sections
  SET
    title = trim(p_title),
    section_type = v_section_type,
    notes = p_notes,
    updated_at = now()
  WHERE id = p_section_id
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;
