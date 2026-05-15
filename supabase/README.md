# Migrations SQL — Core SaaS v3 corrigé

Version corrigée après revue d'architecture. Objectif : obtenir un Core Supabase stable, sécurisé et modulaire avant de développer les modules métier `organization`, `logistics`, `budget` et `memories`.

---

## Ordre d'exécution obligatoire

| # | Fichier | Contenu | Dépendances |
|---|---|---|---|
| 001 | `001_extensions.sql` | `pgcrypto`, `uuid-ossp`, fonction `set_updated_at()` | — |
| 002 | `002_profiles.sql` | Table `profiles` + trigger `handle_new_user()` | `auth.users` |
| 003 | `003_stays.sql` | Table `stays`, trigger `updated_at`, protection `owner_id` | `profiles` |
| 004 | `004_stay_members.sql` | Table `stay_members` + trigger owner auto | `stays`, `profiles` |
| 005 | `005_guests.sql` | Table `guests` + protection champs sensibles | `stays`, `profiles` |
| 006 | `006_access_functions.sql` | Fonctions minimales RLS : `is_stay_member`, `is_stay_organizer`, `is_stay_owner`, `shares_any_stay_with`, helper storage | `stay_members` |
| 007 | `007_files_storage.sql` | Tables `files`, `guest_access_links`, buckets et policies Storage | `stays`, `guests`, `profiles`, fonctions access |
| 008 | `008_alerts_notifications_logs.sql` | Tables `alerts`, `notifications`, `activity_logs` | `stays`, `profiles` |
| 009 | `009_settings_features.sql` | Tables `stay_settings`, `stay_enabled_features` + trigger settings | `stays`, `files` |
| 010 | `010_rpc_functions.sql` | RPC Core et fonctions dépendant des tables transversales | toutes les tables Core |
| 011 | `011_rls_policies.sql` | Toutes les policies RLS applicatives | toutes les tables + fonctions |
| 012 | `012_views.sql` | Vues `security_invoker = true` | toutes les tables + RLS |
| 013 | `tests/rls_tests.sql` | Tests RLS avec pgTAP | tout le Core |

---

## Corrections appliquées

### 1. Ordre des migrations corrigé

Les migrations ne créent plus de fonction ou policy dépendant d'une table inexistante.

- Les fonctions d'accès minimales sont en `006_access_functions.sql`.
- Les tables transversales sont créées avant les RPC qui les utilisent.
- Les RLS applicatives sont toutes en `011_rls_policies.sql`, après création de toutes les tables et fonctions.

### 2. Récursion RLS évitée

Les policies ne relisent pas directement `stay_members`. Elles utilisent :

- `is_stay_member(stay_id)`
- `is_stay_organizer(stay_id)`
- `is_stay_owner(stay_id)`

Ces fonctions sont `security definer` et ont `set search_path = public, pg_temp`.

### 3. Profils mieux protégés

La lecture globale des profils est supprimée. Un utilisateur peut lire :

- son propre profil ;
- les profils des utilisateurs qui partagent un séjour actif avec lui.

La vue `profiles_public` exclut l'email.

### 4. `owner_id` protégé

`stays.owner_id` ne peut pas être modifié directement. Le trigger `prevent_direct_stay_owner_change()` bloque les modifications non autorisées.

Le transfert doit passer par :

```sql
transfer_stay_ownership(stay_id, new_owner_id)
```

Cette fonction active temporairement le verrou via `set_config('app.allow_owner_transfer', 'true', true)`.

### 5. `stay_members` protégé

Pas d'insert/update/delete direct depuis le frontend. Utiliser les RPC :

- `invite_member()`
- `accept_invitation()`
- `change_member_role()`
- `remove_member()`
- `leave_stay()`
- `transfer_stay_ownership()`

Règle métier : un owner ne peut pas être supprimé ou quitter sans transfert préalable.

### 6. `guests` : champs sensibles protégés

Le trigger `prevent_direct_guest_sensitive_change()` empêche la modification directe de :

- `stay_id`
- `linked_user_id`
- `managed_by_user_id`

Pour ces changements, prévoir plus tard des RPC dédiées.

### 7. Tokens invités hashés

`guest_access_links` stocke `token_hash`, jamais le token en clair.

`resolve_guest_access_token(token)` :

- calcule le hash SHA-256 ;
- vérifie expiration/révocation ;
- met à jour `last_used_at` ;
- retourne uniquement `guest_id`, `stay_id`, `permissions`.

### 8. Logs et notifications non falsifiables depuis le frontend

`log_activity()` et `create_notification()` sont réservées au rôle `service_role`.

Le frontend ne doit pas pouvoir créer de faux logs ou de fausses notifications.

### 9. Notifications en lecture seule côté frontend

Le frontend peut lire et supprimer ses notifications, mais ne peut pas les modifier directement.

Pour marquer comme lues, utiliser :

```sql
mark_notifications_read(stay_id)
```

### 10. Alertes contrôlées

Les alertes sont lues par les membres, mais ne sont pas modifiables directement depuis le frontend.

Pour les traiter :

- `resolve_alert(alert_id)`
- `ignore_alert(alert_id)`

La création d'alertes doit se faire côté backend/service role.

### 11. Pas de suppression directe des séjours

Pas de policy `DELETE` sur `stays`. Utiliser :

```sql
archive_stay(stay_id)
```

### 12. Storage sécurisé contre les chemins invalides

Les policies Storage utilisent `storage_path_stay_id(name)` au lieu d'un cast direct en UUID.

Cela évite les erreurs de cast avec un chemin invalide.

Convention de chemin :

```txt
{stay_id}/{kind}/{file_id}.ext
```

### 13. Vues en `security_invoker`

Les vues respectent la RLS de l'utilisateur appelant :

- `profiles_public`
- `stays_summary`
- `guests_summary`
- `my_stays`
- `stay_open_alerts`

---

## Installation

```bash
supabase link --project-ref VOTRE_PROJECT_REF
supabase start
supabase db push
supabase db test
```

En cas de projet local sans données importantes :

```bash
supabase db reset
```

Ne jamais faire de reset sur une base avec des données importantes sans sauvegarde.

---

## Prochaines migrations métier

À démarrer uniquement après validation du Core et des tests RLS.

```txt
014_module_organization.sql  — Transport, Planning, Couchages, Activités
015_module_logistics.sql     — Repas, Courses, Objets, Inventaire
016_module_budget.sql        — Cagnotte, Dépenses, Participants, Remboursements
017_module_memories.sql      — Albums, Photos, Vidéos
```

---

## Rappel architecture modulaire

- Le Core est obligatoire.
- Les modules métier dépendent du Core.
- Les modules métier ne doivent pas dépendre directement les uns des autres.
- Si un module doit référencer une donnée d'un autre module, utiliser un lien faible (`source_type`, `source_id`) ou une table de liaison.
- Désactiver une feature masque ses données, mais ne les supprime pas.
- Les actions sensibles passent par RPC/backend, pas par update direct depuis le frontend.

## Important — Supabase Cloud

Les migrations à appliquer sur Supabase Cloud sont uniquement les fichiers `001` à `012`.

Le fichier `tests/rls_tests.sql` est réservé aux tests locaux avec pgTAP / `supabase db test` et ne doit pas être lancé dans le SQL Editor ni via `supabase db push` comme migration Cloud.
