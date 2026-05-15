-- Migration 016 : guests
-- Ajout des colonnes de liaison utilisateur.

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS managed_by_user_id UUID REFERENCES profiles(id);
