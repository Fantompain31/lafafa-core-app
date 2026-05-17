
-- ============================================================
-- MIGRATION 035 — Co-organisateurs, infos pratiques, listes perso
-- ============================================================

-- Infos pratiques d'un séjour
create table if not exists public.stay_practical_infos (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  label text not null,
  value text,
  kind text not null default 'text',
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stay_practical_infos_stay_idx on public.stay_practical_infos(stay_id, position);

alter table public.stay_practical_infos enable row level security;

drop policy if exists "stay_practical_infos_select_member" on public.stay_practical_infos;
create policy "stay_practical_infos_select_member"
on public.stay_practical_infos for select
to authenticated
using (public.is_stay_member(stay_id));

drop policy if exists "stay_practical_infos_manage_organizer" on public.stay_practical_infos;
create policy "stay_practical_infos_manage_organizer"
on public.stay_practical_infos for all
to authenticated
using (public.is_stay_organizer(stay_id))
with check (public.is_stay_organizer(stay_id));

-- Listes personnelles globales dans le profil
create table if not exists public.personal_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.personal_checklist_templates(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.personal_checklist_templates enable row level security;
alter table public.personal_checklist_template_items enable row level security;

drop policy if exists "personal_templates_owner" on public.personal_checklist_templates;
create policy "personal_templates_owner"
on public.personal_checklist_templates for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "personal_template_items_owner" on public.personal_checklist_template_items;
create policy "personal_template_items_owner"
on public.personal_checklist_template_items for all
to authenticated
using (
  exists (
    select 1 from public.personal_checklist_templates t
    where t.id = template_id and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.personal_checklist_templates t
    where t.id = template_id and t.user_id = auth.uid()
  )
);

-- Liste personnelle privée dans un séjour
create table if not exists public.stay_personal_checklist_items (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stay_personal_checklist_items_user_idx on public.stay_personal_checklist_items(stay_id, user_id, position);

alter table public.stay_personal_checklist_items enable row level security;

drop policy if exists "stay_personal_checklist_owner" on public.stay_personal_checklist_items;
create policy "stay_personal_checklist_owner"
on public.stay_personal_checklist_items for all
to authenticated
using (user_id = auth.uid() and public.is_stay_member(stay_id))
with check (user_id = auth.uid() and public.is_stay_member(stay_id));

-- Suggestions logistiques système, réutilisables dans l'UI
create table if not exists public.logistics_suggestion_groups (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  section_type text not null default 'autre',
  created_at timestamptz not null default now()
);

create table if not exists public.logistics_suggestion_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.logistics_suggestion_groups(id) on delete cascade,
  title text not null,
  quantity text default '1',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.logistics_suggestion_groups enable row level security;
alter table public.logistics_suggestion_items enable row level security;

drop policy if exists "logistics_suggestions_read" on public.logistics_suggestion_groups;
create policy "logistics_suggestions_read" on public.logistics_suggestion_groups for select to authenticated using (true);

drop policy if exists "logistics_suggestion_items_read" on public.logistics_suggestion_items;
create policy "logistics_suggestion_items_read" on public.logistics_suggestion_items for select to authenticated using (true);

-- RPC : nommer / retirer un co-organisateur depuis une fiche membre liée à un compte
create or replace function public.set_guest_co_organizer(
  p_guest_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stay_id uuid;
  v_user_id uuid;
begin
  select stay_id, linked_user_id
  into v_stay_id, v_user_id
  from public.guests
  where id = p_guest_id;

  if v_stay_id is null then
    raise exception 'Fiche membre introuvable.';
  end if;

  if v_user_id is null then
    raise exception 'Ce membre n’a pas encore de compte lié.';
  end if;

  if not public.is_stay_owner(v_stay_id) then
    raise exception 'Seul le créateur du séjour peut modifier ce rôle.';
  end if;

  if exists (
    select 1 from public.stay_members
    where stay_id = v_stay_id and user_id = v_user_id and role = 'owner'
  ) then
    raise exception 'Impossible de modifier le rôle du propriétaire.';
  end if;

  update public.stay_members
  set role = case when p_enabled then 'co_organizer' else 'guest' end,
      status = 'active',
      updated_at = now()
  where stay_id = v_stay_id and user_id = v_user_id;
end;
$$;

revoke execute on function public.set_guest_co_organizer(uuid, boolean) from public, anon;
grant execute on function public.set_guest_co_organizer(uuid, boolean) to authenticated;

-- Seed suggestions simples
insert into public.logistics_suggestion_groups(key, label, section_type)
values
  ('apero', 'Apéro', 'apero'),
  ('barbecue', 'Barbecue', 'repas'),
  ('petit-dejeuner', 'Petit déjeuner', 'repas'),
  ('maison', 'Maison / ménage', 'cleaning'),
  ('plage', 'Plage', 'activite')
on conflict (key) do update set label = excluded.label, section_type = excluded.section_type;

insert into public.logistics_suggestion_items(group_id, title, quantity, position)
select g.id, x.title, x.quantity, x.position
from public.logistics_suggestion_groups g
join (values
  ('apero','Gobelets','20',1),('apero','Serviettes','20',2),('apero','Glaçons','1',3),('apero','Chips','3',4),('apero','Décapsuleur / tire-bouchon','1',5),
  ('barbecue','Charbon','1',1),('barbecue','Allume-feu','1',2),('barbecue','Pinces barbecue','1',3),('barbecue','Sopalin','1',4),
  ('petit-dejeuner','Café','1',1),('petit-dejeuner','Lait','1',2),('petit-dejeuner','Pain / brioche','1',3),('petit-dejeuner','Confiture','1',4),
  ('maison','Sacs poubelle','5',1),('maison','Papier toilette','2',2),('maison','Produit vaisselle','1',3),('maison','Éponge','2',4),
  ('plage','Crème solaire','1',1),('plage','Serviettes','1',2),('plage','Parasol','1',3),('plage','Glacière','1',4)
) as x(group_key, title, quantity, position) on x.group_key = g.key
on conflict do nothing;
