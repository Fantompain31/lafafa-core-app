# La Fafa — Core applicatif corrigé

Ce zip contient une base Next.js structurée proprement autour de l'architecture validée :

```txt
src/
├── app/
├── core/
├── modules/
├── shared/
└── lib/
```

## Corrections appliquées

- Ajout des fichiers manquants Supabase : `client.ts`, `server.ts`, `middleware.ts`, `src/middleware.ts`.
- Ajout des routes manquantes : `/auth/callback` et `/auth/signout`.
- Ajout de `layout.tsx`, `globals.css`, `package.json`, `tsconfig.json`, configuration Tailwind.
- Remise des fichiers dans une arborescence propre.
- Correction de `GuestCard` : rendu en `div` si la carte n'est pas cliquable.
- Correction des champs facultatifs : chaînes vides transformées en `null` quand nécessaire.
- Correction du bug d'édition invité : un nom vidé peut bien devenir `null`.
- Ajout de validations minimales côté services : trim, dates cohérentes, horaires cohérents.
- Ajout d'une conversion `datetime-local` → ISO UTC pour les colonnes `timestamptz`.
- Ajout d'une conversion ISO UTC → `datetime-local` pour l'édition.
- Ajout du dossier `modules/` avec placeholders pour garder l'architecture modulaire.
- Inclusion des migrations Supabase corrigées v2 dans `supabase/migrations/`.
- Le fichier `tests/rls_tests.sql` reste hors migrations Cloud.

## Installation

```bash
npm install
cp .env.local.example .env.local
npm run typecheck
npm run build
```

Renseigner ensuite :

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Important

Les modules métier `organization`, `logistics`, `budget` et `memories` ne sont pas encore développés. Ils doivent être ajoutés un par un après validation complète du Core applicatif.
