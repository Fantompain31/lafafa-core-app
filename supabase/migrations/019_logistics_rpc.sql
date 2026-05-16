-- =====================================================
-- 019_logistics_rpc.sql
-- RPC sécurisées du module Logistique
-- =====================================================

-- =====================================================
-- create_logistics_section
-- Crée une section logistique libre
-- =====================================================

CREATE OR REPLACE FUNCTION create_logistics_section(
  p_stay_id UUID,
  p_title TEXT,
  p_section_type TEXT DEFAULT 'other',
  p_notes TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section logistics_sections;
BEGIN
  IF NOT is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can create logistics sections';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF p_section_type NOT IN (
    'meal',
    'aperitif',
    'shopping',
    'equipment',
    'sleeping',
    'transport',
    'cleaning',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid logistics section type';
  END IF;

  INSERT INTO logistics_sections (
    stay_id,
    title,
    section_type,
    notes,
    source_type,
    source_id,
    created_by
  )
  VALUES (
    p_stay_id,
    trim(p_title),
    p_section_type,
    p_notes,
    p_source_type,
    p_source_id,
    auth.uid()
  )
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

-- =====================================================
-- ensure_logistics_section_for_source
-- Crée ou retourne une section liée à un autre module.
-- Claude pourra l'utiliser depuis Organisation.
-- =====================================================

CREATE OR REPLACE FUNCTION ensure_logistics_section_for_source(
  p_stay_id UUID,
  p_title TEXT,
  p_section_type TEXT DEFAULT 'other',
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section logistics_sections;
BEGIN
  IF NOT is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can create logistics sections';
  END IF;

  IF p_source_type IS NULL OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'source_type and source_id are required';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF p_section_type NOT IN (
    'meal',
    'aperitif',
    'shopping',
    'equipment',
    'sleeping',
    'transport',
    'cleaning',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid logistics section type';
  END IF;

  SELECT *
  INTO v_section
  FROM logistics_sections
  WHERE stay_id = p_stay_id
    AND source_type = p_source_type
    AND source_id = p_source_id
  LIMIT 1;

  IF v_section.id IS NOT NULL THEN
    RETURN v_section;
  END IF;

  INSERT INTO logistics_sections (
    stay_id,
    title,
    section_type,
    notes,
    source_type,
    source_id,
    created_by
  )
  VALUES (
    p_stay_id,
    trim(p_title),
    p_section_type,
    p_notes,
    p_source_type,
    p_source_id,
    auth.uid()
  )
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

-- =====================================================
-- update_logistics_section
-- =====================================================

CREATE OR REPLACE FUNCTION update_logistics_section(
  p_section_id UUID,
  p_title TEXT,
  p_section_type TEXT DEFAULT 'other',
  p_notes TEXT DEFAULT NULL
)
RETURNS logistics_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_section logistics_sections;
BEGIN
  SELECT stay_id
  INTO v_stay_id
  FROM logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Logistics section not found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can update logistics sections';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF p_section_type NOT IN (
    'meal',
    'aperitif',
    'shopping',
    'equipment',
    'sleeping',
    'transport',
    'cleaning',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid logistics section type';
  END IF;

  UPDATE logistics_sections
  SET
    title = trim(p_title),
    section_type = p_section_type,
    notes = p_notes
  WHERE id = p_section_id
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

-- =====================================================
-- delete_logistics_section
-- =====================================================

CREATE OR REPLACE FUNCTION delete_logistics_section(
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
  SELECT stay_id
  INTO v_stay_id
  FROM logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Logistics section not found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can delete logistics sections';
  END IF;

  DELETE FROM logistics_sections
  WHERE id = p_section_id;

  RETURN TRUE;
END;
$$;

-- =====================================================
-- create_logistics_item
-- =====================================================

CREATE OR REPLACE FUNCTION create_logistics_item(
  p_section_id UUID,
  p_label TEXT,
  p_quantity TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_assigned_guest_id UUID DEFAULT NULL
)
RETURNS logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item logistics_items;
BEGIN
  SELECT stay_id
  INTO v_stay_id
  FROM logistics_sections
  WHERE id = p_section_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Logistics section not found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can create logistics items';
  END IF;

  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RAISE EXCEPTION 'Label is required';
  END IF;

  IF p_assigned_guest_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM guests
       WHERE id = p_assigned_guest_id
         AND stay_id = v_stay_id
     ) THEN
    RAISE EXCEPTION 'Assigned guest does not belong to this stay';
  END IF;

  INSERT INTO logistics_items (
    section_id,
    stay_id,
    label,
    quantity,
    notes,
    assigned_guest_id,
    created_by
  )
  VALUES (
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

-- =====================================================
-- update_logistics_item
-- =====================================================

CREATE OR REPLACE FUNCTION update_logistics_item(
  p_item_id UUID,
  p_label TEXT,
  p_quantity TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_assigned_guest_id UUID DEFAULT NULL
)
RETURNS logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item logistics_items;
BEGIN
  SELECT stay_id
  INTO v_stay_id
  FROM logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Logistics item not found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can update logistics items';
  END IF;

  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RAISE EXCEPTION 'Label is required';
  END IF;

  IF p_assigned_guest_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM guests
       WHERE id = p_assigned_guest_id
         AND stay_id = v_stay_id
     ) THEN
    RAISE EXCEPTION 'Assigned guest does not belong to this stay';
  END IF;

  UPDATE logistics_items
  SET
    label = trim(p_label),
    quantity = p_quantity,
    notes = p_notes,
    assigned_guest_id = p_assigned_guest_id
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- =====================================================
-- assign_logistics_item
-- Attribue un item à une fiche invité
-- =====================================================

CREATE OR REPLACE FUNCTION assign_logistics_item(
  p_item_id UUID,
  p_assigned_guest_id UUID DEFAULT NULL
)
RETURNS logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item logistics_items;
BEGIN
  SELECT stay_id
  INTO v_stay_id
  FROM logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Logistics item not found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can assign logistics items';
  END IF;

  IF p_assigned_guest_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM guests
       WHERE id = p_assigned_guest_id
         AND stay_id = v_stay_id
     ) THEN
    RAISE EXCEPTION 'Assigned guest does not belong to this stay';
  END IF;

  UPDATE logistics_items
  SET assigned_guest_id = p_assigned_guest_id
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- =====================================================
-- toggle_logistics_item
-- Coche / décoche un item
-- =====================================================

CREATE OR REPLACE FUNCTION toggle_logistics_item(
  p_item_id UUID,
  p_is_checked BOOLEAN
)
RETURNS logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
  v_item logistics_items;
BEGIN
  SELECT stay_id
  INTO v_stay_id
  FROM logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Logistics item not found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can update logistics items';
  END IF;

  UPDATE logistics_items
  SET
    is_checked = p_is_checked,
    checked_by = CASE WHEN p_is_checked THEN auth.uid() ELSE NULL END,
    checked_at = CASE WHEN p_is_checked THEN now() ELSE NULL END
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- =====================================================
-- delete_logistics_item
-- =====================================================

CREATE OR REPLACE FUNCTION delete_logistics_item(
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
  SELECT stay_id
  INTO v_stay_id
  FROM logistics_items
  WHERE id = p_item_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Logistics item not found';
  END IF;

  IF NOT is_stay_member(v_stay_id) THEN
    RAISE EXCEPTION 'Only stay members can delete logistics items';
  END IF;

  DELETE FROM logistics_items
  WHERE id = p_item_id;

  RETURN TRUE;
END;
$$;