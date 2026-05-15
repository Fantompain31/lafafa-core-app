-- Migration 015 : guest_access_links
-- Table déjà existante sur Supabase Cloud.
-- Ajout des colonnes manquantes : label et is_active.

ALTER TABLE guest_access_links
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- RLS
ALTER TABLE guest_access_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Organisateurs gèrent les liens"
  ON guest_access_links
  FOR ALL
  USING (is_stay_organizer(stay_id))
  WITH CHECK (is_stay_organizer(stay_id));
