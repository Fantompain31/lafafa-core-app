-- =====================================================
-- 018_logistics_tables.sql
-- Module Logistique générique
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- TYPES / CHECKS
-- =====================================================

-- On utilise un TEXT + CHECK plutôt qu'un enum Postgres
-- pour garder le module plus facile à faire évoluer.
-- Types prévus :
-- meal       = repas
-- aperitif   = apéro
-- shopping   = courses
-- equipment  = matériel
-- sleeping   = couchage
-- transport  = transport
-- cleaning   = ménage
-- other      = autre

-- =====================================================
-- TABLE: logistics_sections
-- Une section = un bloc logistique à organiser
-- Exemples : "Apéro samedi soir", "Couchage", "Repas midi 15"
-- =====================================================

CREATE TABLE IF NOT EXISTS logistics_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'other'
    CHECK (section_type IN (
      'meal',
      'aperitif',
      'shopping',
      'equipment',
      'sleeping',
      'transport',
      'cleaning',
      'other'
    )),

  notes TEXT,

  -- Lien faible vers un autre module.
  -- Exemple :
  -- source_type = 'organization_event'
  -- source_id = id de l'événement Organisation
  source_type TEXT,
  source_id UUID,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logistics_sections_stay_id
ON logistics_sections(stay_id);

CREATE INDEX IF NOT EXISTS idx_logistics_sections_source
ON logistics_sections(stay_id, source_type, source_id);

-- Évite de créer deux sections logistiques pour le même événement Organisation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_logistics_sections_unique_source
ON logistics_sections(stay_id, source_type, source_id)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- =====================================================
-- TABLE: logistics_items
-- Un item = une chose à prévoir dans une section
-- Exemples : "chips", "matelas 2 places", "bouilloire"
-- =====================================================

CREATE TABLE IF NOT EXISTS logistics_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  section_id UUID NOT NULL REFERENCES logistics_sections(id) ON DELETE CASCADE,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,

  label TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,

  -- Attribution à une fiche invité, pas directement à un compte user.
  -- Comme ça on peut attribuer à quelqu'un même s'il n'a pas encore créé son compte.
  assigned_guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,

  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES profiles(id),
  checked_at TIMESTAMPTZ,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logistics_items_section_id
ON logistics_items(section_id);

CREATE INDEX IF NOT EXISTS idx_logistics_items_stay_id
ON logistics_items(stay_id);

CREATE INDEX IF NOT EXISTS idx_logistics_items_assigned_guest_id
ON logistics_items(assigned_guest_id);

CREATE INDEX IF NOT EXISTS idx_logistics_items_checked
ON logistics_items(stay_id, is_checked);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logistics_sections_updated_at ON logistics_sections;
CREATE TRIGGER trg_logistics_sections_updated_at
BEFORE UPDATE ON logistics_sections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_logistics_items_updated_at ON logistics_items;
CREATE TRIGGER trg_logistics_items_updated_at
BEFORE UPDATE ON logistics_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE logistics_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS: logistics_sections
-- Tous les membres du séjour peuvent collaborer.
-- =====================================================

DROP POLICY IF EXISTS "Members can view logistics sections" ON logistics_sections;
CREATE POLICY "Members can view logistics sections"
ON logistics_sections
FOR SELECT
TO authenticated
USING (
  is_stay_member(stay_id)
);

DROP POLICY IF EXISTS "Members can insert logistics sections" ON logistics_sections;
CREATE POLICY "Members can insert logistics sections"
ON logistics_sections
FOR INSERT
TO authenticated
WITH CHECK (
  is_stay_member(stay_id)
);

DROP POLICY IF EXISTS "Members can update logistics sections" ON logistics_sections;
CREATE POLICY "Members can update logistics sections"
ON logistics_sections
FOR UPDATE
TO authenticated
USING (
  is_stay_member(stay_id)
)
WITH CHECK (
  is_stay_member(stay_id)
);

DROP POLICY IF EXISTS "Members can delete logistics sections" ON logistics_sections;
CREATE POLICY "Members can delete logistics sections"
ON logistics_sections
FOR DELETE
TO authenticated
USING (
  is_stay_member(stay_id)
);

-- =====================================================
-- RLS: logistics_items
-- Tous les membres du séjour peuvent collaborer.
-- =====================================================

DROP POLICY IF EXISTS "Members can view logistics items" ON logistics_items;
CREATE POLICY "Members can view logistics items"
ON logistics_items
FOR SELECT
TO authenticated
USING (
  is_stay_member(stay_id)
);

DROP POLICY IF EXISTS "Members can insert logistics items" ON logistics_items;
CREATE POLICY "Members can insert logistics items"
ON logistics_items
FOR INSERT
TO authenticated
WITH CHECK (
  is_stay_member(stay_id)
);

DROP POLICY IF EXISTS "Members can update logistics items" ON logistics_items;
CREATE POLICY "Members can update logistics items"
ON logistics_items
FOR UPDATE
TO authenticated
USING (
  is_stay_member(stay_id)
)
WITH CHECK (
  is_stay_member(stay_id)
);

DROP POLICY IF EXISTS "Members can delete logistics items" ON logistics_items;
CREATE POLICY "Members can delete logistics items"
ON logistics_items
FOR DELETE
TO authenticated
USING (
  is_stay_member(stay_id)
);