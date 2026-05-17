-- ============================================================
-- 031_accommodation_module.sql
-- Module Couchage / Logement
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accommodation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accommodation_beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.accommodation_rooms(id) ON DELETE CASCADE,
  stay_id UUID NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  bed_type TEXT NOT NULL DEFAULT 'autre',
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0 AND capacity <= 10),
  needs_logistics BOOLEAN NOT NULL DEFAULT false,
  logistics_item_id UUID REFERENCES public.logistics_items(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accommodation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES public.accommodation_beds(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.accommodation_rooms(id) ON DELETE CASCADE,
  stay_id UUID NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bed_id, guest_id),
  UNIQUE (stay_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_accommodation_rooms_stay_id ON public.accommodation_rooms(stay_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_beds_stay_id ON public.accommodation_beds(stay_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_beds_room_id ON public.accommodation_beds(room_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_assignments_stay_id ON public.accommodation_assignments(stay_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_assignments_guest_id ON public.accommodation_assignments(guest_id);

ALTER TABLE public.accommodation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accommodation_rooms_select ON public.accommodation_rooms;
CREATE POLICY accommodation_rooms_select ON public.accommodation_rooms
FOR SELECT USING (public.is_stay_member(stay_id));

DROP POLICY IF EXISTS accommodation_beds_select ON public.accommodation_beds;
CREATE POLICY accommodation_beds_select ON public.accommodation_beds
FOR SELECT USING (public.is_stay_member(stay_id));

DROP POLICY IF EXISTS accommodation_assignments_select ON public.accommodation_assignments;
CREATE POLICY accommodation_assignments_select ON public.accommodation_assignments
FOR SELECT USING (public.is_stay_member(stay_id));

-- Les écritures passent par RPC SECURITY DEFINER.
DROP POLICY IF EXISTS accommodation_rooms_no_direct_write ON public.accommodation_rooms;
CREATE POLICY accommodation_rooms_no_direct_write ON public.accommodation_rooms
FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS accommodation_beds_no_direct_write ON public.accommodation_beds;
CREATE POLICY accommodation_beds_no_direct_write ON public.accommodation_beds
FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS accommodation_assignments_no_direct_write ON public.accommodation_assignments;
CREATE POLICY accommodation_assignments_no_direct_write ON public.accommodation_assignments
FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.touch_accommodation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accommodation_rooms_updated_at ON public.accommodation_rooms;
CREATE TRIGGER trg_accommodation_rooms_updated_at
BEFORE UPDATE ON public.accommodation_rooms
FOR EACH ROW EXECUTE FUNCTION public.touch_accommodation_updated_at();

DROP TRIGGER IF EXISTS trg_accommodation_beds_updated_at ON public.accommodation_beds;
CREATE TRIGGER trg_accommodation_beds_updated_at
BEFORE UPDATE ON public.accommodation_beds
FOR EACH ROW EXECUTE FUNCTION public.touch_accommodation_updated_at();

-- Helper : vérifie que le couchage est accessible au membre.
CREATE OR REPLACE FUNCTION public.get_accommodation_bed_stay(p_bed_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stay_id FROM public.accommodation_beds WHERE id = p_bed_id;
$$;

-- Crée / met à jour l'item Logistique lié à un couchage.
CREATE OR REPLACE FUNCTION public.sync_accommodation_bed_logistics(
  p_bed_id UUID,
  p_needs_logistics BOOLEAN
)
RETURNS public.accommodation_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bed public.accommodation_beds;
  v_room public.accommodation_rooms;
  v_section_id UUID;
  v_item_id UUID;
  v_label TEXT;
BEGIN
  SELECT * INTO v_bed FROM public.accommodation_beds WHERE id = p_bed_id;
  IF v_bed.id IS NULL THEN
    RAISE EXCEPTION 'bed_not_found';
  END IF;

  IF NOT public.is_stay_member(v_bed.stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  SELECT * INTO v_room FROM public.accommodation_rooms WHERE id = v_bed.room_id;
  v_label := v_bed.label || ' — ' || COALESCE(v_room.name, 'Couchage');

  IF p_needs_logistics IS FALSE THEN
    IF v_bed.logistics_item_id IS NOT NULL THEN
      DELETE FROM public.logistics_items WHERE id = v_bed.logistics_item_id;
    END IF;

    UPDATE public.accommodation_beds
    SET needs_logistics = false,
        logistics_item_id = NULL
    WHERE id = p_bed_id
    RETURNING * INTO v_bed;

    RETURN v_bed;
  END IF;

  SELECT id INTO v_section_id
  FROM public.logistics_sections
  WHERE stay_id = v_bed.stay_id
    AND source_type = 'accommodation'
    AND source_id = v_bed.stay_id
  LIMIT 1;

  IF v_section_id IS NULL THEN
    INSERT INTO public.logistics_sections (
      stay_id,
      title,
      section_type,
      notes,
      source_type,
      source_id,
      created_by
    ) VALUES (
      v_bed.stay_id,
      'Couchage',
      'sleeping',
      'Matériel à prévoir pour les couchages du séjour.',
      'accommodation',
      v_bed.stay_id,
      auth.uid()
    )
    RETURNING id INTO v_section_id;
  ELSE
    UPDATE public.logistics_sections
    SET is_hidden = false
    WHERE id = v_section_id;
  END IF;

  IF v_bed.logistics_item_id IS NULL THEN
    INSERT INTO public.logistics_items (
      section_id,
      stay_id,
      label,
      quantity,
      notes,
      created_by
    ) VALUES (
      v_section_id,
      v_bed.stay_id,
      v_label,
      '1',
      'Besoin créé depuis le module Couchage.',
      auth.uid()
    )
    RETURNING id INTO v_item_id;
  ELSE
    UPDATE public.logistics_items
    SET label = v_label,
        quantity = COALESCE(quantity, '1'),
        notes = COALESCE(notes, 'Besoin créé depuis le module Couchage.')
    WHERE id = v_bed.logistics_item_id
    RETURNING id INTO v_item_id;
  END IF;

  UPDATE public.accommodation_beds
  SET needs_logistics = true,
      logistics_item_id = v_item_id
  WHERE id = p_bed_id
  RETURNING * INTO v_bed;

  RETURN v_bed;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accommodation_room_with_beds(
  p_stay_id UUID,
  p_name TEXT,
  p_notes TEXT DEFAULT NULL,
  p_beds JSONB DEFAULT '[]'::jsonb
)
RETURNS public.accommodation_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.accommodation_rooms;
  v_bed JSONB;
  v_bed_id UUID;
  v_needs_logistics BOOLEAN;
BEGIN
  IF NOT public.is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'room_name_required';
  END IF;

  INSERT INTO public.accommodation_rooms (stay_id, name, notes, created_by)
  VALUES (p_stay_id, trim(p_name), NULLIF(trim(COALESCE(p_notes, '')), ''), auth.uid())
  RETURNING * INTO v_room;

  FOR v_bed IN SELECT * FROM jsonb_array_elements(COALESCE(p_beds, '[]'::jsonb))
  LOOP
    IF length(trim(COALESCE(v_bed->>'label', ''))) > 0 THEN
      v_needs_logistics := COALESCE((v_bed->>'needs_logistics')::boolean, false);

      INSERT INTO public.accommodation_beds (
        room_id,
        stay_id,
        label,
        bed_type,
        capacity,
        needs_logistics,
        created_by
      ) VALUES (
        v_room.id,
        p_stay_id,
        trim(v_bed->>'label'),
        COALESCE(NULLIF(trim(COALESCE(v_bed->>'bed_type', '')), ''), 'autre'),
        GREATEST(1, LEAST(10, COALESCE((v_bed->>'capacity')::int, 1))),
        false,
        auth.uid()
      ) RETURNING id INTO v_bed_id;

      IF v_needs_logistics THEN
        PERFORM public.sync_accommodation_bed_logistics(v_bed_id, true);
      END IF;
    END IF;
  END LOOP;

  RETURN v_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_accommodation_room(
  p_room_id UUID,
  p_name TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.accommodation_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.accommodation_rooms;
BEGIN
  SELECT * INTO v_room FROM public.accommodation_rooms WHERE id = p_room_id;
  IF v_room.id IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF NOT public.is_stay_member(v_room.stay_id) THEN RAISE EXCEPTION 'not_member'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'room_name_required'; END IF;

  UPDATE public.accommodation_rooms
  SET name = trim(p_name), notes = NULLIF(trim(COALESCE(p_notes, '')), '')
  WHERE id = p_room_id
  RETURNING * INTO v_room;

  RETURN v_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_accommodation_room(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.accommodation_rooms;
BEGIN
  SELECT * INTO v_room FROM public.accommodation_rooms WHERE id = p_room_id;
  IF v_room.id IS NULL THEN RETURN; END IF;
  IF NOT public.is_stay_member(v_room.stay_id) THEN RAISE EXCEPTION 'not_member'; END IF;

  DELETE FROM public.accommodation_rooms WHERE id = p_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accommodation_bed(
  p_room_id UUID,
  p_label TEXT,
  p_bed_type TEXT DEFAULT 'autre',
  p_capacity INTEGER DEFAULT 1,
  p_needs_logistics BOOLEAN DEFAULT false
)
RETURNS public.accommodation_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.accommodation_rooms;
  v_bed public.accommodation_beds;
BEGIN
  SELECT * INTO v_room FROM public.accommodation_rooms WHERE id = p_room_id;
  IF v_room.id IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF NOT public.is_stay_member(v_room.stay_id) THEN RAISE EXCEPTION 'not_member'; END IF;
  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN RAISE EXCEPTION 'bed_label_required'; END IF;

  INSERT INTO public.accommodation_beds (
    room_id, stay_id, label, bed_type, capacity, needs_logistics, created_by
  ) VALUES (
    v_room.id, v_room.stay_id, trim(p_label), COALESCE(NULLIF(trim(COALESCE(p_bed_type, '')), ''), 'autre'),
    GREATEST(1, LEAST(10, COALESCE(p_capacity, 1))), false, auth.uid()
  ) RETURNING * INTO v_bed;

  IF p_needs_logistics THEN
    SELECT * INTO v_bed FROM public.sync_accommodation_bed_logistics(v_bed.id, true);
  END IF;

  RETURN v_bed;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_accommodation_bed(
  p_bed_id UUID,
  p_label TEXT,
  p_bed_type TEXT DEFAULT 'autre',
  p_capacity INTEGER DEFAULT 1,
  p_needs_logistics BOOLEAN DEFAULT false
)
RETURNS public.accommodation_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bed public.accommodation_beds;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_bed FROM public.accommodation_beds WHERE id = p_bed_id;
  IF v_bed.id IS NULL THEN RAISE EXCEPTION 'bed_not_found'; END IF;
  IF NOT public.is_stay_member(v_bed.stay_id) THEN RAISE EXCEPTION 'not_member'; END IF;
  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN RAISE EXCEPTION 'bed_label_required'; END IF;

  SELECT count(*) INTO v_count FROM public.accommodation_assignments WHERE bed_id = p_bed_id;
  IF GREATEST(1, LEAST(10, COALESCE(p_capacity, 1))) < v_count THEN
    RAISE EXCEPTION 'capacity_lower_than_assignments';
  END IF;

  UPDATE public.accommodation_beds
  SET label = trim(p_label),
      bed_type = COALESCE(NULLIF(trim(COALESCE(p_bed_type, '')), ''), 'autre'),
      capacity = GREATEST(1, LEAST(10, COALESCE(p_capacity, 1)))
  WHERE id = p_bed_id
  RETURNING * INTO v_bed;

  SELECT * INTO v_bed FROM public.sync_accommodation_bed_logistics(p_bed_id, COALESCE(p_needs_logistics, false));

  RETURN v_bed;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_accommodation_bed(p_bed_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bed public.accommodation_beds;
BEGIN
  SELECT * INTO v_bed FROM public.accommodation_beds WHERE id = p_bed_id;
  IF v_bed.id IS NULL THEN RETURN; END IF;
  IF NOT public.is_stay_member(v_bed.stay_id) THEN RAISE EXCEPTION 'not_member'; END IF;

  IF v_bed.logistics_item_id IS NOT NULL THEN
    DELETE FROM public.logistics_items WHERE id = v_bed.logistics_item_id;
  END IF;

  DELETE FROM public.accommodation_beds WHERE id = p_bed_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_guest_to_accommodation_bed(
  p_bed_id UUID,
  p_guest_id UUID
)
RETURNS public.accommodation_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bed public.accommodation_beds;
  v_guest public.guests;
  v_count INTEGER;
  v_assignment public.accommodation_assignments;
BEGIN
  SELECT * INTO v_bed FROM public.accommodation_beds WHERE id = p_bed_id;
  IF v_bed.id IS NULL THEN RAISE EXCEPTION 'bed_not_found'; END IF;
  IF NOT public.is_stay_member(v_bed.stay_id) THEN RAISE EXCEPTION 'not_member'; END IF;

  SELECT * INTO v_guest FROM public.guests WHERE id = p_guest_id AND stay_id = v_bed.stay_id;
  IF v_guest.id IS NULL THEN RAISE EXCEPTION 'guest_not_found'; END IF;
  IF v_guest.status = 'cancelled' THEN RAISE EXCEPTION 'guest_cancelled'; END IF;

  SELECT count(*) INTO v_count FROM public.accommodation_assignments WHERE bed_id = p_bed_id;
  IF v_count >= v_bed.capacity THEN RAISE EXCEPTION 'bed_full'; END IF;

  INSERT INTO public.accommodation_assignments (bed_id, room_id, stay_id, guest_id, created_by)
  VALUES (v_bed.id, v_bed.room_id, v_bed.stay_id, v_guest.id, auth.uid())
  ON CONFLICT (stay_id, guest_id) DO UPDATE
  SET bed_id = EXCLUDED.bed_id,
      room_id = EXCLUDED.room_id,
      created_by = EXCLUDED.created_by,
      created_at = now()
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_accommodation_assignment(p_assignment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.accommodation_assignments;
BEGIN
  SELECT * INTO v_assignment FROM public.accommodation_assignments WHERE id = p_assignment_id;
  IF v_assignment.id IS NULL THEN RETURN; END IF;
  IF NOT public.is_stay_member(v_assignment.stay_id) THEN RAISE EXCEPTION 'not_member'; END IF;

  DELETE FROM public.accommodation_assignments WHERE id = p_assignment_id;
END;
$$;
