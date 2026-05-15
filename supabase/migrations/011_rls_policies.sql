-- ============================================================
-- MIGRATION 011 — RLS Policies globales
-- Exécutée après la création de toutes les tables et fonctions Core.
-- Les policies ne relisent jamais stay_members directement : elles passent
-- par les fonctions security definer is_stay_member/is_stay_organizer/is_stay_owner.
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_select_shared_stay"
  on public.profiles for select to authenticated
  using (public.shares_any_stay_with(id));

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- STAYS
-- ------------------------------------------------------------
alter table public.stays enable row level security;

create policy "stays_select_member"
  on public.stays for select to authenticated
  using (public.is_stay_member(id));

create policy "stays_insert_authenticated"
  on public.stays for insert to authenticated
  with check (owner_id = auth.uid());

-- owner_id est protégé par trigger prevent_direct_stay_owner_change().
create policy "stays_update_organizer"
  on public.stays for update to authenticated
  using (public.is_stay_organizer(id))
  with check (public.is_stay_organizer(id));

-- Pas de delete direct : utiliser archive_stay().

-- ------------------------------------------------------------
-- STAY_MEMBERS
-- ------------------------------------------------------------
alter table public.stay_members enable row level security;

create policy "stay_members_select_member"
  on public.stay_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_stay_member(stay_id)
  );

-- Pas d'insert/update/delete direct : utiliser les RPC Core.

-- ------------------------------------------------------------
-- GUESTS
-- ------------------------------------------------------------
alter table public.guests enable row level security;

create policy "guests_select_member"
  on public.guests for select to authenticated
  using (public.is_stay_member(stay_id));

create policy "guests_insert_organizer"
  on public.guests for insert to authenticated
  with check (public.is_stay_organizer(stay_id));

-- Les champs stay_id, linked_user_id et managed_by_user_id sont protégés par trigger.
create policy "guests_update_organizer_or_manager"
  on public.guests for update to authenticated
  using (
    public.is_stay_organizer(stay_id)
    or managed_by_user_id = auth.uid()
  )
  with check (
    public.is_stay_organizer(stay_id)
    or managed_by_user_id = auth.uid()
  );

-- Suppression directe limitée aux organisateurs. Préférer status = 'cancelled'.
create policy "guests_delete_organizer"
  on public.guests for delete to authenticated
  using (public.is_stay_organizer(stay_id));

-- ------------------------------------------------------------
-- FILES
-- ------------------------------------------------------------
alter table public.files enable row level security;

create policy "files_select_member"
  on public.files for select to authenticated
  using (public.is_stay_member(stay_id));

create policy "files_insert_member"
  on public.files for insert to authenticated
  with check (
    public.is_stay_member(stay_id)
    and uploaded_by = auth.uid()
  );

-- Les métadonnées ne sont pas modifiables librement au départ.
-- Prévoir plus tard une RPC update_file_metadata() si nécessaire.

create policy "files_delete_organizer_or_uploader"
  on public.files for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_stay_organizer(stay_id)
  );

-- ------------------------------------------------------------
-- GUEST_ACCESS_LINKS
-- ------------------------------------------------------------
alter table public.guest_access_links enable row level security;

create policy "guest_links_select_organizer"
  on public.guest_access_links for select to authenticated
  using (public.is_stay_organizer(stay_id));

create policy "guest_links_insert_organizer"
  on public.guest_access_links for insert to authenticated
  with check (public.is_stay_organizer(stay_id));

create policy "guest_links_update_organizer"
  on public.guest_access_links for update to authenticated
  using (public.is_stay_organizer(stay_id))
  with check (public.is_stay_organizer(stay_id));

create policy "guest_links_delete_organizer"
  on public.guest_access_links for delete to authenticated
  using (public.is_stay_organizer(stay_id));

-- ------------------------------------------------------------
-- ALERTS
-- ------------------------------------------------------------
alter table public.alerts enable row level security;

create policy "alerts_select_member"
  on public.alerts for select to authenticated
  using (public.is_stay_member(stay_id));

-- Pas d'insert/update/delete direct depuis le frontend.
-- Création par backend/service_role. Résolution via resolve_alert()/ignore_alert().

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Pas d'insert/update direct. Marquer comme lu via mark_notifications_read().
create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- ACTIVITY_LOGS
-- ------------------------------------------------------------
alter table public.activity_logs enable row level security;

create policy "activity_logs_select_member"
  on public.activity_logs for select to authenticated
  using (public.is_stay_member(stay_id));

-- Append-only : pas d'insert direct, pas d'update, pas de delete.
-- Création par backend/service_role via log_activity().

-- ------------------------------------------------------------
-- STAY_SETTINGS
-- ------------------------------------------------------------
alter table public.stay_settings enable row level security;

create policy "stay_settings_select_member"
  on public.stay_settings for select to authenticated
  using (public.is_stay_member(stay_id));

create policy "stay_settings_update_organizer"
  on public.stay_settings for update to authenticated
  using (public.is_stay_organizer(stay_id))
  with check (public.is_stay_organizer(stay_id));

-- Pas d'insert direct : créé via trigger handle_stay_settings_created().

-- ------------------------------------------------------------
-- STAY_ENABLED_FEATURES
-- ------------------------------------------------------------
alter table public.stay_enabled_features enable row level security;

create policy "features_select_member"
  on public.stay_enabled_features for select to authenticated
  using (public.is_stay_member(stay_id));

create policy "features_insert_organizer"
  on public.stay_enabled_features for insert to authenticated
  with check (public.is_stay_organizer(stay_id));

create policy "features_update_organizer"
  on public.stay_enabled_features for update to authenticated
  using (public.is_stay_organizer(stay_id))
  with check (public.is_stay_organizer(stay_id));

create policy "features_delete_organizer"
  on public.stay_enabled_features for delete to authenticated
  using (public.is_stay_organizer(stay_id));
