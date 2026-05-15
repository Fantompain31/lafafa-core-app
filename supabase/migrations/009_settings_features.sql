-- ============================================================
-- MIGRATION 009 — Tables : stay_settings, stay_enabled_features
-- Paramètres et feature flags par séjour.
-- Créées après stays et files (pour la FK logo_file_id).
-- RLS globale dans 011_rls_policies.sql.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE : stay_settings
-- Un seul enregistrement par séjour (one-to-one avec stays).
-- Créé automatiquement à la création du séjour via trigger.
-- ------------------------------------------------------------

create table if not exists public.stay_settings (
  id                     uuid        primary key default gen_random_uuid(),
  stay_id                uuid        not null unique references public.stays(id) on delete cascade,

  -- Paramètres financiers
  default_currency       text        not null default 'EUR',

  -- Permissions accordées aux membres de type guest/viewer
  guest_can_invite       boolean     not null default false,
  guest_can_see_budget   boolean     not null default true,
  guest_can_see_guests   boolean     not null default true,
  guest_can_add_expenses boolean     not null default false,

  -- Préférences de notification
  notify_on_guest_change boolean     not null default true,
  notify_on_expense      boolean     not null default true,
  notify_on_alert        boolean     not null default true,

  -- Personnalisation visuelle
  primary_color          text        null,
  accent_color           text        null,
  logo_file_id           uuid        null references public.files(id) on delete set null,

  -- Données de sondage (phase de création du séjour)
  -- Array de { date: date, label: text }
  poll_date_options      jsonb       not null default '[]',
  -- Array de { name: text, address: text, url: text }
  poll_location_options  jsonb       not null default '[]',
  poll_closes_at         timestamptz null,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists stay_settings_stay_id_idx on public.stay_settings (stay_id);

create trigger stay_settings_updated_at
  before update on public.stay_settings
  for each row execute function public.set_updated_at();

-- Création automatique des paramètres à la création d'un séjour
create or replace function public.handle_stay_settings_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.stay_settings (stay_id)
  values (new.id)
  on conflict (stay_id) do nothing;
  return new;
end;
$$;

create trigger on_stay_created_add_settings
  after insert on public.stays
  for each row execute function public.handle_stay_settings_created();

-- ------------------------------------------------------------
-- TABLE : stay_enabled_features
-- Feature flags par séjour.
-- Désactiver une feature masque ses données — ne les supprime PAS.
-- ------------------------------------------------------------

create table if not exists public.stay_enabled_features (
  id          uuid        primary key default gen_random_uuid(),
  stay_id     uuid        not null references public.stays(id) on delete cascade,
  feature_key text        not null,
  is_enabled  boolean     not null default true,
  -- Config spécifique à la feature (quotas, limites, options)
  settings    jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (stay_id, feature_key)
);

create index if not exists features_stay_id_idx   on public.stay_enabled_features (stay_id);
create index if not exists features_key_idx       on public.stay_enabled_features (stay_id, feature_key);
create index if not exists features_enabled_idx   on public.stay_enabled_features (stay_id, is_enabled);

create trigger stay_features_updated_at
  before update on public.stay_enabled_features
  for each row execute function public.set_updated_at();

-- Liste de référence des feature_keys valides (documentation + contrainte souple)
-- Exemples :
--   organization.transport_advanced
--   organization.planning_advanced
--   organization.activities_advanced
--   logistics.shopping_advanced
--   logistics.inventory_detailed
--   logistics.weather_smart
--   budget.cagnotte_advanced
--   budget.receipts
--   memories.upload_photos
--   memories.upload_videos
--   appearance.advanced_theme
--   announcements.advanced

comment on table public.stay_settings is
  'Paramètres généraux du séjour. One-to-one avec stays. Créé via trigger. Core SaaS.';
comment on column public.stay_settings.poll_date_options is
  'Options de dates pour le sondage. Format : [{date, label}].';
comment on column public.stay_settings.poll_location_options is
  'Options de lieux pour le sondage. Format : [{name, address, url}].';

comment on table public.stay_enabled_features is
  'Feature flags par séjour. Désactiver masque les données sans les supprimer. Core SaaS.';
comment on column public.stay_enabled_features.feature_key is
  'Clé de feature. Ex: organization.transport_advanced, budget.receipts.';
comment on column public.stay_enabled_features.settings is
  'Config spécifique : quotas, limites, options de la feature.';
