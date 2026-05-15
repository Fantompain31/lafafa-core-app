-- ============================================================
-- MIGRATION 008 — Tables : alerts, notifications, activity_logs
-- Ces trois tables sont créées ensemble car elles sont liées
-- aux mêmes entités et ont des patterns identiques.
-- RLS globale dans 011_rls_policies.sql.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE : alerts
-- Alertes transversales générées par les modules.
-- Centralisées dans le Core pour affichage unifié.
-- Les modules écrivent via service backend (service_role ou RPC).
-- Le frontend lit et peut appeler resolve_alert() / ignore_alert().
-- ------------------------------------------------------------

create table if not exists public.alerts (
  id           uuid        primary key default gen_random_uuid(),
  stay_id      uuid        not null references public.stays(id) on delete cascade,
  module_key   text        not null,
  severity     text        not null default 'info',
  title        text        not null,
  message      text,
  entity_type  text,
  entity_id    uuid,
  status       text        not null default 'open',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz null,
  resolved_by  uuid        null references public.profiles(id) on delete set null,

  constraint alerts_severity_check check (
    severity in ('info', 'warning', 'critical')
  ),
  constraint alerts_status_check check (
    status in ('open', 'resolved', 'ignored')
  )
);

create index if not exists alerts_stay_id_idx    on public.alerts (stay_id);
create index if not exists alerts_open_idx       on public.alerts (stay_id, severity)
  where status = 'open';
create index if not exists alerts_module_idx     on public.alerts (stay_id, module_key);
create index if not exists alerts_entity_idx     on public.alerts (entity_type, entity_id)
  where entity_id is not null;

-- ------------------------------------------------------------
-- TABLE : notifications
-- Notifications personnelles par utilisateur.
-- Différentes des alertes (qui sont liées au séjour entier).
-- Créées exclusivement via create_notification() (RPC security definer).
-- ------------------------------------------------------------

create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  stay_id     uuid        not null references public.stays(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  type        text        not null,
  title       text        not null,
  message     text,
  entity_type text,
  entity_id   uuid,
  is_read     boolean     not null default false,
  read_at     timestamptz null,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_stay_id_idx on public.notifications (stay_id);
-- Index partiel : non lues uniquement (usage courant)
create index if not exists notifications_unread_idx  on public.notifications (user_id)
  where is_read = false;
create index if not exists notifications_feed_idx    on public.notifications (user_id, created_at desc);

-- ------------------------------------------------------------
-- TABLE : activity_logs
-- Journal d'activité immuable.
-- Append-only : pas d'update, pas de delete direct.
-- Créés exclusivement via log_activity() (RPC security definer).
-- Le frontend ne peut pas insérer directement (pas de policy d'insert).
-- ------------------------------------------------------------

create table if not exists public.activity_logs (
  id            uuid        primary key default gen_random_uuid(),
  stay_id       uuid        not null references public.stays(id) on delete cascade,
  actor_user_id uuid        null references public.profiles(id) on delete set null,
  action        text        not null,
  entity_type   text,
  entity_id     uuid,
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now()
  -- Pas de updated_at : les logs sont immuables
);

create index if not exists activity_logs_stay_id_idx on public.activity_logs (stay_id);
create index if not exists activity_logs_actor_idx   on public.activity_logs (actor_user_id)
  where actor_user_id is not null;
create index if not exists activity_logs_action_idx  on public.activity_logs (stay_id, action);
create index if not exists activity_logs_feed_idx    on public.activity_logs (stay_id, created_at desc);
create index if not exists activity_logs_entity_idx  on public.activity_logs (entity_type, entity_id)
  where entity_id is not null;

comment on table public.alerts is
  'Alertes transversales des modules. Modifiées uniquement via resolve_alert() / ignore_alert(). Core SaaS.';
comment on column public.alerts.module_key  is
  'Module source : core | organization | logistics | budget | memories';
comment on column public.alerts.entity_type is
  'Type d''entité liée (ex: guest, transport, expense) pour navigation directe.';

comment on table public.notifications is
  'Notifications personnelles. Créées via create_notification() uniquement. Core SaaS.';

comment on table public.activity_logs is
  'Journal immuable. Créé via log_activity() uniquement. Jamais modifié ou supprimé directement. Core SaaS.';
comment on column public.activity_logs.action is
  'Format : module.entite.verbe — ex: guest.created, expense.added, stay.status_changed';
