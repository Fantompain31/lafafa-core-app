-- Migration 017 : RPC système d'invitation
-- Toute la logique sensible est côté Supabase (SECURITY DEFINER).
-- Le frontend appelle uniquement ces RPC, jamais les tables directement.

-- ─────────────────────────────────────────
-- 1. create_stay_invitation
-- Génère une invitation par email avec token hashé.
-- Retourne le token brut une seule fois (à envoyer par email côté frontend).
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_stay_invitation(
  p_stay_id UUID,
  p_email TEXT,
  p_guest_id UUID DEFAULT NULL,
  p_expires_in_days INT DEFAULT 7
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_token TEXT := encode(gen_random_bytes(32), 'hex');
  v_hash TEXT := encode(sha256(v_token::bytea), 'hex');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT is_stay_organizer(p_stay_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  INSERT INTO stay_invitations (
    stay_id, invited_by, email, token_hash, guest_id, expires_at
  ) VALUES (
    p_stay_id, v_user_id, p_email, v_hash, p_guest_id,
    now() + (p_expires_in_days || ' days')::INTERVAL
  );

  RETURN v_token;
END;
$$;


-- ─────────────────────────────────────────
-- 2. create_guest_access_link
-- Génère un lien partageable (WhatsApp, SMS, etc.) avec token hashé.
-- Retourne le token brut une seule fois.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_guest_access_link(
  p_stay_id UUID,
  p_label TEXT DEFAULT NULL,
  p_guest_id UUID DEFAULT NULL,
  p_expires_in_days INT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_token TEXT := encode(gen_random_bytes(32), 'hex');
  v_hash TEXT := encode(sha256(v_token::bytea), 'hex');
  v_expires TIMESTAMPTZ := CASE
    WHEN p_expires_in_days IS NOT NULL
    THEN now() + (p_expires_in_days || ' days')::INTERVAL
    ELSE NULL
  END;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT is_stay_organizer(p_stay_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  INSERT INTO guest_access_links (
    stay_id, created_by, token_hash, label, guest_id, expires_at
  ) VALUES (
    p_stay_id, v_user_id, v_hash, p_label, p_guest_id, v_expires
  );

  RETURN v_token;
END;
$$;


-- ─────────────────────────────────────────
-- 3. accept_stay_invitation
-- Accepte une invitation via token (email ou lien partageable).
-- Ajoute l'utilisateur comme membre et lie la fiche invité si existante.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_stay_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash TEXT := encode(sha256(p_token::bytea), 'hex');
  v_inv stay_invitations;
  v_link guest_access_links;
  v_user_id UUID := auth.uid();
  v_stay_id UUID;
  v_guest_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Chercher dans stay_invitations
  SELECT * INTO v_inv FROM stay_invitations
  WHERE token_hash = v_hash AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now());

  -- Sinon chercher dans guest_access_links
  IF NOT FOUND THEN
    SELECT * INTO v_link FROM guest_access_links
    WHERE token_hash = v_hash AND is_active = true
      AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lien invalide ou expiré';
    END IF;

    v_stay_id := v_link.stay_id;
    v_guest_id := v_link.guest_id;
  ELSE
    v_stay_id := v_inv.stay_id;
    v_guest_id := v_inv.guest_id;
  END IF;

  -- Ajouter comme membre
  INSERT INTO stay_members (stay_id, user_id, role, status)
  VALUES (v_stay_id, v_user_id, 'guest', 'active')
  ON CONFLICT (stay_id, user_id) DO NOTHING;

  -- Lier la fiche invité si elle existe
  IF v_guest_id IS NOT NULL THEN
    UPDATE guests SET linked_user_id = v_user_id WHERE id = v_guest_id;
  END IF;

  -- Marquer l'invitation comme acceptée
  IF v_inv.id IS NOT NULL THEN
    UPDATE stay_invitations SET status = 'accepted' WHERE id = v_inv.id;
  END IF;

  PERFORM log_activity(v_stay_id, 'member_joined', 'stay_members', v_user_id, '{}'::jsonb);

  RETURN jsonb_build_object('stay_id', v_stay_id, 'guest_id', v_guest_id);
END;
$$;


-- ─────────────────────────────────────────
-- 4. revoke_stay_invitation
-- Révoque une invitation email (organisateur uniquement).
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION revoke_stay_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
BEGIN
  SELECT stay_id INTO v_stay_id FROM stay_invitations WHERE id = p_invitation_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Invitation introuvable';
  END IF;

  IF NOT is_stay_organizer(v_stay_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE stay_invitations SET status = 'revoked' WHERE id = p_invitation_id;
END;
$$;


-- ─────────────────────────────────────────
-- 5. revoke_guest_access_link
-- Désactive un lien partageable (organisateur uniquement).
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION revoke_guest_access_link(p_link_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stay_id UUID;
BEGIN
  SELECT stay_id INTO v_stay_id FROM guest_access_links WHERE id = p_link_id;

  IF v_stay_id IS NULL THEN
    RAISE EXCEPTION 'Lien introuvable';
  END IF;

  IF NOT is_stay_organizer(v_stay_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE guest_access_links SET is_active = false WHERE id = p_link_id;
END;
$$;
