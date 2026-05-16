-- ============================================================
-- 020_logistics_module.sql
-- Module Logistique — La Fafa
-- Compatible module Organisation via source_type/source_id
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: logistics_sections
-- Une section = un bloc logistique à organiser
-- Exemples : Repas midi 15, Apéro terrasse, Couchage, Matériel
-- ============================================================

CREATE TABLE IF NOT EXISTS public.logistics_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'autre',
  notes TEXT,
  source_type TEXT,
  source_id UUID,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Si une ancienne version de la table existe, on ajoute les colonnes manquantes.
ALTER TABLE public.logistics_sections
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- On remplace le CHECK pour accepter les types Organisation + quelques types logistiques purs.
ALTER TABLE public.logistics_sections
  DROP CONSTRAINT IF EXISTS logistics_sections_section_type_check;

ALTER TABLE public.logistics_sections
  ADD CONSTRAINT logistics_sections_section_type_check
  CHECK (section_type IN (
    'repas', 'apero', 'activite', 'transport', 'arrivee', 'depart', 'menage', 'temps_libre', 'autre',
    'shopping', 'equipment', 'sleeping', 'cleaning',
    'meal', 'aperitif'
  ));

CREATE INDEX IF NOT EXISTS idx_logistics_sections_stay_id
  ON public.logistics_sections(stay_id);

CREATE INDEX IF NOT EXISTS idx_logistics_sections_source
  ON public.logistics_sections(stay_id, source_type, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_logistics_sections_unique_source
  ON public.logistics_sections(stay_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- ============================================================
-- TABLE: logistics_items
-- Un item = une chose à prévoir dans une section
-- Exemples : chips, matelas 2 places, bouilloire, enceinte connectée
-- ============================================================

CREATE TABLE IF NOT EXISTS public.logistics_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.logistics_sections(id) ON DELETE CASCADE,
  stay_id UUID NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  assigned_guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES public.profiles(id),
  checked_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colonnes manquantes si une ancienne version existe.
ALTER TABLE public.logistics_items
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS quantity TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS assigned_guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_checked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Compatibilité si une version temporaire avait nommé la colonne "title" / "assigned_to" / "is_done".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'logistics_items' AND column_name = 'title'
  ) THEN
    EXECUTE 'UPDATE public.logistics_items SET label = COALESCE(label, title) WHERE label IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'logistics_items' AND column_name = 'is_done'
  ) THEN
    EXECUTE 'UPDATE public.logistics_items SET is_checked = COALESCE(is_checked, is_done)';
  END IF;
END $$;

UPDATE public.logistics_items SET label = 'Élément sans nom' WHERE label IS NULL;

ALTER TABLE public.logistics_items
  ALTER COLUMN label SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_items_section_id
  ON public.logistics_items(section_id);

CREATE INDEX IF NOT EXISTS idx_logistics_items_stay_id
  ON public.logistics_items(stay_id);

CREATE INDEX IF NOT EXISTS idx_logistics_items_assigned_guest_id
  ON public.logistics_items(assigned_guest_id);

CREATE INDEX IF NOT EXISTS idx_logistics_items_checked
  ON public.logistics_items(stay_id, is_checked);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_sections_updated_at ON public.logistics_sections;
CREATE TRIGGER trg_logistics_sections_updated_at
  BEFORE UPDATE ON public.logistics_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_logistics_items_updated_at ON public.logistics_items;
CREATE TRIGGER trg_logistics_items_updated_at
  BEFORE UPDATE ON public.logistics_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- Tous les membres du séjour peuvent collaborer sur la logistique.
-- ============================================================

ALTER TABLE public.logistics_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logistics_sections_select" ON public.logistics_sections;
CREATE POLICY "logistics_sections_select"
ON public.logistics_sections
FOR SELECT
TO authenticated
USING (is_stay_member(stay_id));

DROP POLICY IF EXISTS "logistics_sections_insert" ON public.logistics_sections;
CREATE POLICY "logistics_sections_insert"
ON public.logistics_sections
FOR INSERT
TO authenticated
WITH CHECK (is_stay_member(stay_id));

DROP POLICY IF EXISTS "logistics_sections_update" ON public.logistics_sections;
CREATE POLICY "logistics_sections_update"
ON public.logistics_sections
FOR UPDATE
TO authenticated
USING (is_stay_member(stay_id))
WITH CHECK (is_stay_member(stay_id));

DROP POLICY IF EXISTS "logistics_sections_delete" ON public.logistics_sections;
CREATE POLICY "logistics_sections_delete"
ON public.logistics_sections
FOR DELETE
TO authenticated
USING (is_stay_member(stay_id));

DROP POLICY IF EXISTS "logistics_items_select" ON public.logistics_items;
CREATE POLICY "logistics_items_select"
ON public.logistics_items
FOR SELECT
TO authenticated
USING (is_stay_member(stay_id));

DROP POLICY IF EXISTS "logistics_items_insert" ON public.logistics_items;
CREATE POLICY "logistics_items_insert"
ON public.logistics_items
FOR INSERT
TO authenticated
WITH CHECK (is_stay_member(stay_id));

DROP POLICY IF EXISTS "logistics_items_update" ON public.logistics_items;
CREATE POLICY "logistics_items_update"
ON public.logistics_items
FOR UPDATE
TO authenticated
USING (is_stay_member(stay_id))
WITH CHECK (is_stay_member(stay_id));

DROP POLICY IF EXISTS "logistics_items_delete" ON public.logistics_items;
CREATE POLICY "logistics_items_delete"
ON public.logistics_items
FOR DELETE
TO authenticated
USING (is_stay_member(stay_id));

-- ============================================================
-- RPC CLEANUP
-- On droppe les anciennes signatures éventuelles pour éviter les conflits de RETURN TYPE.
-- ============================================================

DROP FUNCTION IF EXISTS public.ensure_logistics_section_for_source(UUID, TEXT, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.ensure_logistics_section_for_source(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_logistics_section(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_logistics_section(UUID, TEXT, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_logistics_section(UUID, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_manual_logistics_section(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_logistics_section(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.hide_logistics_section(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.delete_logistics_section(UUID);
DROP FUNCTION IF EXISTS public.create_logistics_item(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.update_logistics_item(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.assign_logistics_item(UUID, UUID);
DROP FUNCTION IF EXISTS public.toggle_logistics_item(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.delete_logistics_item(UUID);

-- ============================================================
-- RPC: ensure_logistics_section_for_source
-- Contrat demandé par Organisation / Claude.
-- Retourne UUID = id de la section logistique.
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
  IF NOT is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stay_enabled_features
    WHERE stay_id = p_stay_id AND feature_key = 'logistics' AND is_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF p_source_type IS NULL OR length(trim(p_source_type)) = 0 OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'source_required';
  END IF;

  SELECT id INTO v_section_id
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
  ) VALUES (
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

-- Alias de compatibilité si un ancien code appelle create_logistics_section.
CREATE OR REPLACE FUNCTION public.create_logistics_section(
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
BEGIN
  RETURN public.ensure_logistics_section_for_source(
    p_stay_id,
    p_title,
    p_section_type,
    p_source_type,
    p_source_id,
    p_notes
  );
END;
$$;

-- ============================================================
-- RPC: create_manual_logistics_section
-- Section créée directement depuis la page Logistique.
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
  IF NOT is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stay_enabled_features
    WHERE stay_id = p_stay_id AND feature_key = 'logistics' AND is_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
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
  ) VALUES (
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
-- RPC: update / hide / delete section
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_logistics_section(
  p_section_id   UUID,
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
  v_stay_id UUID;
  v_section public.logistics_sections;
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  UPDATE public.logistics_sections
  SET title = trim(p_title),
      section_type = COALESCE(NULLIF(trim(p_section_type), ''), 'autre'),
      notes = p_notes
  WHERE id = p_section_id
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

CREATE OR REPLACE FUNCTION public.hide_logistics_section(
  p_section_id UUID,
  p_is_hidden BOOLEAN DEFAULT true
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
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  UPDATE public.logistics_sections
  SET is_hidden = p_is_hidden
  WHERE id = p_section_id
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_logistics_section(
  p_section_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  DELETE FROM public.logistics_sections
  WHERE id = p_section_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- RPC: items
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_logistics_item(
  p_section_id        UUID,
  p_label             TEXT,
  p_quantity          TEXT DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_assigned_guest_id UUID DEFAULT NULL
)
RETURNS public.logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item public.logistics_items;
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_sections
  WHERE id = p_section_id AND is_hidden = false;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'section_not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RAISE EXCEPTION 'label_required';
  END IF;

  IF p_assigned_guest_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE id = p_assigned_guest_id AND stay_id = v_stay_id
  ) THEN
    RAISE EXCEPTION 'assigned_guest_not_in_stay';
  END IF;

  INSERT INTO public.logistics_items (
    section_id,
    stay_id,
    label,
    quantity,
    notes,
    assigned_guest_id,
    created_by
  ) VALUES (
    p_section_id,
    v_stay_id,
    trim(p_label),
    p_quantity,
    p_notes,
    p_assigned_guest_id,
    auth.uid()
  )
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_logistics_item(
  p_item_id           UUID,
  p_label             TEXT,
  p_quantity          TEXT DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_assigned_guest_id UUID DEFAULT NULL
)
RETURNS public.logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item public.logistics_items;
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RAISE EXCEPTION 'label_required';
  END IF;

  IF p_assigned_guest_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE id = p_assigned_guest_id AND stay_id = v_stay_id
  ) THEN
    RAISE EXCEPTION 'assigned_guest_not_in_stay';
  END IF;

  UPDATE public.logistics_items
  SET label = trim(p_label),
      quantity = p_quantity,
      notes = p_notes,
      assigned_guest_id = p_assigned_guest_id
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_logistics_item(
  p_item_id UUID,
  p_assigned_guest_id UUID DEFAULT NULL
)
RETURNS public.logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item public.logistics_items;
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_assigned_guest_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE id = p_assigned_guest_id AND stay_id = v_stay_id
  ) THEN
    RAISE EXCEPTION 'assigned_guest_not_in_stay';
  END IF;

  UPDATE public.logistics_items
  SET assigned_guest_id = p_assigned_guest_id
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_logistics_item(
  p_item_id UUID,
  p_is_checked BOOLEAN
)
RETURNS public.logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item public.logistics_items;
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  UPDATE public.logistics_items
  SET is_checked = p_is_checked,
      checked_by = CASE WHEN p_is_checked THEN auth.uid() ELSE NULL END,
      checked_at = CASE WHEN p_is_checked THEN now() ELSE NULL END
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_logistics_item(
  p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
BEGIN
  SELECT stay_id INTO v_stay_id
  FROM public.logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  DELETE FROM public.logistics_items
  WHERE id = p_item_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- Feature flag facultatif pour les séjours existants
-- À lancer manuellement si tu veux activer Logistique partout :
-- INSERT INTO stay_enabled_features (stay_id, feature_key, is_enabled)
-- SELECT id, 'logistics', true FROM stays
-- ON CONFLICT (stay_id, feature_key) DO NOTHING;
-- ============================================================
