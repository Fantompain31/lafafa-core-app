-- Migration 014 : stay_invitations
-- Table déjà existante sur Supabase Cloud, cette migration documente l'état attendu.

-- Vérification de la structure attendue :
-- id UUID PK
-- stay_id UUID NOT NULL REFERENCES stays(id)
-- invited_by UUID NOT NULL REFERENCES profiles(id)
-- email TEXT NOT NULL
-- token_hash TEXT NOT NULL UNIQUE
-- guest_id UUID REFERENCES guests(id)
-- status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
-- expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
-- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

-- RLS
ALTER TABLE stay_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Organisateurs gèrent les invitations"
  ON stay_invitations
  FOR ALL
  USING (is_stay_organizer(stay_id))
  WITH CHECK (is_stay_organizer(stay_id));
