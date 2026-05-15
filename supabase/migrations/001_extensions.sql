-- ============================================================
-- MIGRATION 001 — Extensions
-- Doit être la première migration exécutée.
-- pgcrypto est requis pour gen_random_uuid() et gen_random_bytes().
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Fonction générique de mise à jour automatique de updated_at.
-- Définie ici pour être disponible dans toutes les migrations suivantes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
