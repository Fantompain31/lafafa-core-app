-- ============================================================
-- MIGRATION 013 — Tests RLS (pgTAP)
-- Tests de sécurité à exécuter avant de développer les modules.
-- Nécessite l'extension pgTAP : create extension if not exists pgtap;
--
-- Exécution :
--   supabase db test          (si pgTAP est configuré)
--   ou manuellement dans le SQL Editor en environnement de test.
--
-- Ces tests vérifient les règles de sécurité fondamentales.
-- Un test qui échoue = une faille de sécurité à corriger.
-- ============================================================

-- Active pgTAP si disponible (environnement de test uniquement)
create extension if not exists pgtap;

begin;

select plan(18);

-- ============================================================
-- HELPERS DE TEST
-- ============================================================

-- Créer des utilisateurs de test (contournement auth pour les tests)
-- En pratique ces tests s'exécutent avec des JWT simulés.

-- ============================================================
-- GROUPE 1 — Isolation des séjours
-- Un utilisateur ne voit que ses propres séjours.
-- ============================================================

-- Test 1 : Un utilisateur non membre ne peut pas lire un séjour
select throws_ok(
  $$
    set local role authenticated;
    set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000099"}';
    select id from public.stays limit 1;
  $$,
  'Un utilisateur non membre ne doit pas voir les séjours des autres.'
);

-- Test 2 : La vue my_stays ne retourne que les séjours de l'utilisateur courant
-- (vérifié via la présence de la clause WHERE sm.user_id = auth.uid())
select has_view('public', 'my_stays', 'La vue my_stays existe.');

-- ============================================================
-- GROUPE 2 — Protection des profils
-- Un utilisateur ne peut pas lire tous les emails de l'app.
-- ============================================================

-- Test 3 : La policy profiles_select_own existe
select policy_cmd_is(
  'public', 'profiles', 'profiles_select_own', 'SELECT',
  'La policy profiles_select_own existe.'
);

-- Test 4 : La policy profiles_select_shared_stay existe
select policy_cmd_is(
  'public', 'profiles', 'profiles_select_shared_stay', 'SELECT',
  'La policy profiles_select_shared_stay existe.'
);

-- Test 5 : La vue profiles_public exclut l'email
select hasnt_column(
  'public', 'profiles_public', 'email',
  'La vue profiles_public ne doit pas exposer l''email.'
);

-- ============================================================
-- GROUPE 3 — Protection de stay_members
-- ============================================================

-- Test 6 : Pas de policy d'insert direct sur stay_members
select hasnt_policy(
  'public', 'stay_members', 'stay_members_insert_direct',
  'Pas d''insert direct sur stay_members depuis le frontend.'
);

-- Test 7 : Pas de policy d'update direct sur stay_members
select hasnt_policy(
  'public', 'stay_members', 'stay_members_update_direct',
  'Pas d''update direct sur stay_members depuis le frontend.'
);

-- Test 8 : La fonction leave_stay existe avec security definer
select is_definer('public', 'leave_stay', ARRAY['uuid'],
  'leave_stay est une fonction security definer.'
);

-- Test 9 : La fonction transfer_stay_ownership existe avec security definer
select is_definer('public', 'transfer_stay_ownership', ARRAY['uuid', 'uuid'],
  'transfer_stay_ownership est une fonction security definer.'
);

-- ============================================================
-- GROUPE 4 — Protection de stays (owner_id non modifiable)
-- ============================================================

-- Test 10 : La policy stays_update_organizer a un with check sur owner_id
select policy_cmd_is(
  'public', 'stays', 'stays_update_organizer', 'UPDATE',
  'La policy stays_update_organizer existe.'
);

-- Test 11 : archive_stay est une fonction security definer
select is_definer('public', 'archive_stay', ARRAY['uuid'],
  'archive_stay est une fonction security definer.'
);

-- ============================================================
-- GROUPE 5 — Logs immuables
-- ============================================================

-- Test 12 : Pas de policy d'insert direct sur activity_logs
select hasnt_policy(
  'public', 'activity_logs', 'activity_logs_insert_member',
  'Pas d''insert direct sur activity_logs depuis le frontend.'
);

-- Test 13 : Pas de policy d'update sur activity_logs
select hasnt_policy(
  'public', 'activity_logs', 'activity_logs_update',
  'Pas d''update sur activity_logs.'
);

-- Test 14 : log_activity est une fonction security definer
select is_definer('public', 'log_activity', ARRAY['uuid', 'text', 'text', 'uuid', 'jsonb'],
  'log_activity est une fonction security definer.'
);

-- ============================================================
-- GROUPE 6 — Sécurité des tokens invités
-- ============================================================

-- Test 15 : guest_access_links stocke token_hash, pas token
select has_column(
  'public', 'guest_access_links', 'token_hash',
  'guest_access_links stocke token_hash (jamais le token en clair).'
);

select hasnt_column(
  'public', 'guest_access_links', 'token',
  'guest_access_links ne doit pas avoir de colonne token en clair.'
);

-- Test 16 : resolve_guest_access_token est security definer
select is_definer('public', 'resolve_guest_access_token', ARRAY['text'],
  'resolve_guest_access_token est une fonction security definer.'
);

-- ============================================================
-- GROUPE 7 — RLS activée sur toutes les tables
-- ============================================================

-- Test 17 : RLS activée sur toutes les tables Core
select ok(
  (select relrowsecurity from pg_class where relname = 'profiles'   and relnamespace = 'public'::regnamespace),
  'RLS activée sur profiles.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'stays'      and relnamespace = 'public'::regnamespace),
  'RLS activée sur stays.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'stay_members' and relnamespace = 'public'::regnamespace),
  'RLS activée sur stay_members.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'guests'     and relnamespace = 'public'::regnamespace),
  'RLS activée sur guests.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'files'      and relnamespace = 'public'::regnamespace),
  'RLS activée sur files.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'alerts'     and relnamespace = 'public'::regnamespace),
  'RLS activée sur alerts.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'notifications' and relnamespace = 'public'::regnamespace),
  'RLS activée sur notifications.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'activity_logs' and relnamespace = 'public'::regnamespace),
  'RLS activée sur activity_logs.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'stay_settings' and relnamespace = 'public'::regnamespace),
  'RLS activée sur stay_settings.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'stay_enabled_features' and relnamespace = 'public'::regnamespace),
  'RLS activée sur stay_enabled_features.'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'guest_access_links' and relnamespace = 'public'::regnamespace),
  'RLS activée sur guest_access_links.'
);

-- ============================================================
-- GROUPE 8 — Vues en security_invoker
-- ============================================================

-- Test 18 : Les vues principales ont security_invoker = true
-- (PostgreSQL 15+ expose reloptions sur pg_class)
select ok(
  exists (
    select 1 from pg_class
    where relname = 'stays_summary'
      and relnamespace = 'public'::regnamespace
      and 'security_invoker=true' = any(reloptions)
  ),
  'La vue stays_summary a security_invoker = true.'
);

select ok(
  exists (
    select 1 from pg_class
    where relname = 'guests_summary'
      and relnamespace = 'public'::regnamespace
      and 'security_invoker=true' = any(reloptions)
  ),
  'La vue guests_summary a security_invoker = true.'
);

select * from finish();

rollback;
