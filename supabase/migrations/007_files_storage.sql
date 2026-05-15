-- ============================================================
-- MIGRATION 007 — Tables : files, guest_access_links + Storage
-- Créées ici car files dépend de stays et profiles,
-- et guest_access_links dépend de stays et guests.
-- La FK stays.cover_image_file_id est ajoutée ici (après files).
-- ============================================================

-- ------------------------------------------------------------
-- TABLE : files
-- Stocke les métadonnées. Le fichier physique est dans Storage.
-- Convention de chemin : {stay_id}/{kind}/{file_id}.ext
-- ------------------------------------------------------------

create table if not exists public.files (
  id            uuid        primary key default gen_random_uuid(),
  stay_id       uuid        not null references public.stays(id) on delete cascade,
  uploaded_by   uuid        null references public.profiles(id) on delete set null,
  bucket        text        not null,
  storage_path  text        not null,
  file_name     text        not null,
  mime_type     text,
  file_size     bigint,
  kind          text        not null default 'other',
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now(),

  constraint files_kind_check check (
    kind in (
      'cover_image', 'memory_photo', 'memory_video',
      'expense_receipt', 'activity_attachment', 'other'
    )
  ),
  unique (bucket, storage_path)
);

create index if not exists files_stay_id_idx     on public.files (stay_id);
create index if not exists files_kind_idx        on public.files (stay_id, kind);
create index if not exists files_uploaded_by_idx on public.files (uploaded_by)
  where uploaded_by is not null;

-- Ajout de la FK différée : stays.cover_image_file_id → files(id)
-- (stays a été créée avant files, la contrainte est ajoutée ici)
alter table public.stays
  add constraint stays_cover_image_file_id_fk
  foreign key (cover_image_file_id)
  references public.files(id)
  on delete set null;

-- ------------------------------------------------------------
-- TABLE : guest_access_links
-- Liens privés pour invités sans compte.
-- Sécurité : token_hash stocké (jamais le vrai token en clair).
-- Le vrai token est généré côté backend, affiché une seule fois.
-- ------------------------------------------------------------

create table if not exists public.guest_access_links (
  id           uuid        primary key default gen_random_uuid(),
  stay_id      uuid        not null references public.stays(id) on delete cascade,
  guest_id     uuid        not null references public.guests(id) on delete cascade,
  -- Stocke uniquement le hash SHA-256 du token (jamais le token en clair)
  token_hash   text        not null unique,
  permissions  jsonb       not null default '["read"]',
  expires_at   timestamptz null,
  revoked_at   timestamptz null,
  last_used_at timestamptz null,
  created_by   uuid        null references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists guest_links_stay_id_idx  on public.guest_access_links (stay_id);
create index if not exists guest_links_guest_id_idx on public.guest_access_links (guest_id);
create index if not exists guest_links_hash_idx     on public.guest_access_links (token_hash);
create index if not exists guest_links_active_idx   on public.guest_access_links (stay_id)
  where revoked_at is null;

-- Vue : liens actifs (non expirés, non révoqués)
create or replace view public.guest_access_links_active
with (security_invoker = true)
as
  select *
  from public.guest_access_links
  where revoked_at is null
    and (expires_at is null or expires_at > now());

-- ------------------------------------------------------------
-- STORAGE : Buckets Supabase
-- ------------------------------------------------------------

-- Bucket principal pour les médias du séjour (photos, vidéos de couverture, souvenirs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stays-media',
  'stays-media',
  false,
  52428800,  -- 50 MB max par fichier
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do nothing;

-- Bucket pour les documents (justificatifs, pièces jointes)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stays-documents',
  'stays-documents',
  false,
  10485760,  -- 10 MB max par fichier
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- STORAGE POLICIES
-- Convention de chemin : {stay_id}/{kind}/{file_id}.ext
-- Le stay_id est le premier segment du chemin.
-- (storage.foldername(name))[1] extrait le premier dossier.
-- ------------------------------------------------------------

-- stays-media : lecture pour membres actifs
create policy "storage_media_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'stays-media'
    and public.is_stay_member(
      public.storage_path_stay_id(name)
    )
  );

-- stays-media : upload pour membres actifs
create policy "storage_media_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'stays-media'
    and public.is_stay_member(
      public.storage_path_stay_id(name)
    )
  );

-- stays-media : suppression pour organisateurs uniquement
create policy "storage_media_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'stays-media'
    and public.is_stay_organizer(
      public.storage_path_stay_id(name)
    )
  );

-- stays-documents : lecture pour membres actifs
create policy "storage_docs_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'stays-documents'
    and public.is_stay_member(
      public.storage_path_stay_id(name)
    )
  );

-- stays-documents : upload pour membres actifs
create policy "storage_docs_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'stays-documents'
    and public.is_stay_member(
      public.storage_path_stay_id(name)
    )
  );

-- stays-documents : suppression pour organisateurs
create policy "storage_docs_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'stays-documents'
    and public.is_stay_organizer(
      public.storage_path_stay_id(name)
    )
  );

comment on table public.files is
  'Métadonnées des fichiers. Le fichier physique est dans Supabase Storage. Core SaaS.';
comment on column public.files.storage_path is
  'Chemin dans le bucket. Convention : {stay_id}/{kind}/{file_id}.ext';
comment on column public.files.kind is
  'cover_image | memory_photo | memory_video | expense_receipt | activity_attachment | other';

comment on table public.guest_access_links is
  'Liens d''accès privés pour invités sans compte. token_hash uniquement — jamais le token en clair. Core SaaS.';
comment on column public.guest_access_links.token_hash is
  'SHA-256 (hex) du vrai token. Le vrai token est généré backend, envoyé par email, affiché une seule fois.';
comment on column public.guest_access_links.permissions is
  'JSON array de permissions : ["read"] | ["read","rsvp"] | ["read","rsvp","edit_self"]';
