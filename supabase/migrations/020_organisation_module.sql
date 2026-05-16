-- ============================================================
-- Migration 018 — Module Organisation
-- La Fafa — mai 2026
-- ============================================================

-- ── 1. Table principale ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id       UUID NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),

  title         TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'repas', 'apero', 'activite', 'transport',
                  'arrivee', 'depart', 'menage', 'temps_libre', 'autre'
                )),
  event_date    DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME,
  location      TEXT,
  description   TEXT,
  status        TEXT DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed', 'cancelled')),

  -- Lien faible vers la section logistique créée automatiquement
  logistics_section_id UUID,   -- rempli après création dans Logistique (optionnel)

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_org_events_stay   ON public.organization_events (stay_id);
CREATE INDEX IF NOT EXISTS idx_org_events_date   ON public.organization_events (stay_id, event_date, start_time);

-- Mise à jour auto de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_events_updated_at ON public.organization_events;
CREATE TRIGGER trg_org_events_updated_at
  BEFORE UPDATE ON public.organization_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 2. RLS ──────────────────────────────────────────────────

ALTER TABLE public.organization_events ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre actif du séjour
CREATE POLICY "org_events_select" ON public.organization_events
  FOR SELECT USING (
    is_stay_member(stay_id)
  );

-- Insertion : tout membre actif
CREATE POLICY "org_events_insert" ON public.organization_events
  FOR INSERT WITH CHECK (
    is_stay_member(stay_id)
    AND created_by = auth.uid()
  );

-- Mise à jour : créateur OU organisateur
CREATE POLICY "org_events_update" ON public.organization_events
  FOR UPDATE USING (
    created_by = auth.uid()
    OR is_stay_organizer(stay_id)
  );

-- Suppression : créateur OU organisateur
CREATE POLICY "org_events_delete" ON public.organization_events
  FOR DELETE USING (
    created_by = auth.uid()
    OR is_stay_organizer(stay_id)
  );


-- ── 3. RPC — CRUD événements ────────────────────────────────

-- Créer un événement
CREATE OR REPLACE FUNCTION public.create_organization_event(
  p_stay_id     UUID,
  p_title       TEXT,
  p_event_type  TEXT,
  p_event_date  DATE,
  p_start_time  TIME,
  p_end_time    TIME     DEFAULT NULL,
  p_location    TEXT     DEFAULT NULL,
  p_description TEXT     DEFAULT NULL,
  p_status      TEXT     DEFAULT 'confirmed'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Vérification membre
  IF NOT is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  -- Vérification feature activée
  IF NOT EXISTS (
    SELECT 1 FROM stay_enabled_features
    WHERE stay_id = p_stay_id AND feature_key = 'organisation' AND is_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;

  INSERT INTO organization_events (
    stay_id, created_by, title, event_type,
    event_date, start_time, end_time,
    location, description, status
  )
  VALUES (
    p_stay_id, auth.uid(), p_title, p_event_type,
    p_event_date, p_start_time, p_end_time,
    p_location, p_description, p_status
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;


-- Mettre à jour un événement
CREATE OR REPLACE FUNCTION public.update_organization_event(
  p_event_id    UUID,
  p_title       TEXT,
  p_event_type  TEXT,
  p_event_date  DATE,
  p_start_time  TIME,
  p_end_time    TIME     DEFAULT NULL,
  p_location    TEXT     DEFAULT NULL,
  p_description TEXT     DEFAULT NULL,
  p_status      TEXT     DEFAULT 'confirmed'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
BEGIN
  SELECT stay_id INTO v_stay_id FROM organization_events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT (
    (SELECT created_by FROM organization_events WHERE id = p_event_id) = auth.uid()
    OR is_stay_organizer(v_stay_id)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE organization_events SET
    title       = p_title,
    event_type  = p_event_type,
    event_date  = p_event_date,
    start_time  = p_start_time,
    end_time    = p_end_time,
    location    = p_location,
    description = p_description,
    status      = p_status
  WHERE id = p_event_id;
END;
$$;


-- Supprimer un événement
CREATE OR REPLACE FUNCTION public.delete_organization_event(
  p_event_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
BEGIN
  SELECT stay_id INTO v_stay_id FROM organization_events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT (
    (SELECT created_by FROM organization_events WHERE id = p_event_id) = auth.uid()
    OR is_stay_organizer(v_stay_id)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM organization_events WHERE id = p_event_id;
END;
$$;


-- Mémoriser l'id de section logistique créée (appelé par le module Logistique)
CREATE OR REPLACE FUNCTION public.link_logistics_section_to_event(
  p_event_id           UUID,
  p_logistics_section_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE organization_events
  SET logistics_section_id = p_logistics_section_id
  WHERE id = p_event_id
    AND is_stay_member(stay_id);
END;
$$;


-- ── 4. RPC — Créer une section logistique liée (point de contact inter-modules) ──

-- Cette RPC est le SEUL point de contact entre Organisation et Logistique.
-- Organisation appelle cette fonction sans connaître le schéma de Logistique.
-- Logistique doit avoir créé la table logistics_sections avant que cette RPC
-- soit utile — elle est defensive : si la table n'existe pas encore, elle échoue
-- gracieusement côté applicatif (le catch dans le service).
--
-- Signature attendue par ChatGPT pour le module Logistique :
--   create_logistics_section(p_stay_id, p_title, p_section_type, p_source_type, p_source_id)
--   → UUID (id de la section créée)
--
-- Ce fichier ne définit PAS cette RPC (c'est la migration Logistique qui le fera).
-- On documente ici l'interface pour que les deux modules restent cohérents.


-- ── 5. Feature flag par défaut ──────────────────────────────

-- À exécuter une fois par séjour existant si vous voulez activer le module par défaut :
-- INSERT INTO stay_enabled_features (stay_id, feature_key, is_enabled)
-- SELECT id, 'organisation', true FROM stays
-- ON CONFLICT (stay_id, feature_key) DO NOTHING;
