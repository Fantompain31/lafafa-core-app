-- ============================================================
-- Migration 020 — Organisation : sync arrivée invité
-- La Fafa — mai 2026
-- ============================================================

-- ── 1. Colonnes source sur organization_events ───────────────
-- Permet de tracer l'origine d'un événement créé automatiquement
-- (même pattern que source_type/source_id dans logistics_sections)

ALTER TABLE public.organization_events
  ADD COLUMN IF NOT EXISTS source_type TEXT,   -- ex: 'guest'
  ADD COLUMN IF NOT EXISTS source_id   UUID;   -- ex: id du guest

CREATE INDEX IF NOT EXISTS idx_org_events_source
  ON public.organization_events (stay_id, source_type, source_id)
  WHERE source_type IS NOT NULL;


-- ── 2. RPC sync_guest_arrival_event ──────────────────────────
-- Appelée après chaque mise à jour d'un guest (arrival_date/arrival_time).
-- Crée l'événement s'il n'existe pas, le met à jour s'il existe,
-- le supprime si les infos d'arrivée sont effacées.
-- Ne touche jamais aux événements créés manuellement (source_type IS NULL).

CREATE OR REPLACE FUNCTION public.sync_guest_arrival_event(
  p_guest_id    UUID,
  p_stay_id     UUID,
  p_guest_name  TEXT,         -- prénom + nom à afficher dans le titre
  p_arrival_date DATE,        -- NULL = effacer l'événement
  p_arrival_time TIME         -- NULL = pas d'heure précise → 00:00
)
RETURNS UUID   -- id de l'événement (NULL si supprimé)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id  UUID;
  v_title     TEXT;
  v_time      TIME;
BEGIN
  -- Vérification que l'appelant est membre du séjour
  IF NOT is_stay_member(p_stay_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  -- Chercher un événement existant lié à ce guest
  SELECT id INTO v_event_id
  FROM organization_events
  WHERE stay_id     = p_stay_id
    AND source_type = 'guest'
    AND source_id   = p_guest_id
  LIMIT 1;

  -- Si la date d'arrivée est effacée → supprimer l'événement lié
  IF p_arrival_date IS NULL THEN
    IF v_event_id IS NOT NULL THEN
      DELETE FROM organization_events WHERE id = v_event_id;
    END IF;
    RETURN NULL;
  END IF;

  v_title := 'Arrivée de ' || p_guest_name;
  v_time  := COALESCE(p_arrival_time, '00:00:00'::TIME);

  IF v_event_id IS NULL THEN
    -- Vérifier que le module est activé avant de créer
    IF NOT EXISTS (
      SELECT 1 FROM stay_enabled_features
      WHERE stay_id    = p_stay_id
        AND feature_key = 'organisation'
        AND is_enabled  = TRUE
    ) THEN
      RETURN NULL;  -- module désactivé, on ne crée rien silencieusement
    END IF;

    -- Créer l'événement
    INSERT INTO organization_events (
      stay_id, created_by, title, event_type,
      event_date, start_time,
      status, source_type, source_id
    )
    VALUES (
      p_stay_id, auth.uid(), v_title, 'arrivee',
      p_arrival_date, v_time,
      'confirmed', 'guest', p_guest_id
    )
    RETURNING id INTO v_event_id;

  ELSE
    -- Mettre à jour l'événement existant
    UPDATE organization_events SET
      title      = v_title,
      event_date = p_arrival_date,
      start_time = v_time
    WHERE id = v_event_id;
  END IF;

  RETURN v_event_id;
END;
$$;
