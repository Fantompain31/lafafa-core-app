-- ============================================================
-- Migration 034 — Stay Templates
-- La Fafa — modèles de séjour système
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stay_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  icon        TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stay_template_logistics_sections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES public.stay_templates(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'autre',
  notes        TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stay_template_logistics_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_section_id UUID NOT NULL REFERENCES public.stay_template_logistics_sections(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1,
  notes               TEXT,
  position            INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stay_template_personal_checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.stay_templates(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  category    TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stay_template_practical_infos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.stay_templates(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  value       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpl_sections_template
  ON public.stay_template_logistics_sections (template_id, position);

CREATE INDEX IF NOT EXISTS idx_tpl_items_section
  ON public.stay_template_logistics_items (template_section_id, position);

CREATE INDEX IF NOT EXISTS idx_tpl_checklist_template
  ON public.stay_template_personal_checklist_items (template_id, position);

CREATE INDEX IF NOT EXISTS idx_tpl_practical_template
  ON public.stay_template_practical_infos (template_id, position);

ALTER TABLE public.stay_templates                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_template_logistics_sections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_template_logistics_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_template_personal_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_template_practical_infos          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS templates_select_all ON public.stay_templates;
CREATE POLICY templates_select_all
ON public.stay_templates
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS tpl_sections_select_all ON public.stay_template_logistics_sections;
CREATE POLICY tpl_sections_select_all
ON public.stay_template_logistics_sections
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS tpl_items_select_all ON public.stay_template_logistics_items;
CREATE POLICY tpl_items_select_all
ON public.stay_template_logistics_items
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS tpl_checklist_select_all ON public.stay_template_personal_checklist_items;
CREATE POLICY tpl_checklist_select_all
ON public.stay_template_personal_checklist_items
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS tpl_practical_select_all ON public.stay_template_practical_infos;
CREATE POLICY tpl_practical_select_all
ON public.stay_template_practical_infos
FOR SELECT
TO authenticated
USING (TRUE);

-- ── 2. RPC apply_stay_template ───────────────────────────────
-- Applique un modèle sans supprimer l'existant.
-- Les sections créées depuis un template restent des sections classiques,
-- volontairement sans source_type/source_id, car logistics_sections possède
-- un index unique (stay_id, source_type, source_id) incompatible avec plusieurs
-- sections issues du même template.

CREATE OR REPLACE FUNCTION public.apply_stay_template(
  p_stay_id UUID,
  p_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section stay_template_logistics_sections%ROWTYPE;
  v_item stay_template_logistics_items%ROWTYPE;
  v_section_id UUID;
  v_sections_created INTEGER := 0;
  v_items_created INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.stay_members sm
    WHERE sm.stay_id = p_stay_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
      AND sm.role IN ('owner', 'co_organizer')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stay_templates WHERE id = p_template_id
  ) THEN
    RAISE EXCEPTION 'template_not_found';
  END IF;

  FOR v_section IN
    SELECT *
    FROM public.stay_template_logistics_sections
    WHERE template_id = p_template_id
    ORDER BY position, title
  LOOP
    SELECT ls.id
    INTO v_section_id
    FROM public.logistics_sections ls
    WHERE ls.stay_id = p_stay_id
      AND lower(ls.title) = lower(v_section.title)
    ORDER BY ls.created_at
    LIMIT 1;

    IF v_section_id IS NULL THEN
      INSERT INTO public.logistics_sections (
        stay_id,
        title,
        section_type,
        notes,
        source_type,
        source_id,
        is_hidden,
        created_at,
        updated_at
      )
      VALUES (
        p_stay_id,
        v_section.title,
        v_section.section_type,
        v_section.notes,
        NULL,
        NULL,
        FALSE,
        now(),
        now()
      )
      RETURNING id INTO v_section_id;

      v_sections_created := v_sections_created + 1;
    END IF;

    FOR v_item IN
      SELECT *
      FROM public.stay_template_logistics_items
      WHERE template_section_id = v_section.id
      ORDER BY position, title
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.logistics_items li
        WHERE li.section_id = v_section_id
          AND lower(li.label) = lower(v_item.title)
      ) THEN
        INSERT INTO public.logistics_items (
          stay_id,
          section_id,
          label,
          quantity,
          notes,
          is_checked,
          created_at,
          updated_at
        )
        VALUES (
          p_stay_id,
          v_section_id,
          v_item.title,
          v_item.quantity::TEXT,
          v_item.notes,
          FALSE,
          now(),
          now()
        );

        v_items_created := v_items_created + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'sections_created', v_sections_created,
    'items_created', v_items_created
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_stay_template(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_stay_template(UUID, UUID) TO authenticated;

-- ── 3. Seed helper ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_system_stay_template(
  p_key TEXT,
  p_name TEXT,
  p_description TEXT,
  p_category TEXT,
  p_icon TEXT,
  p_sections JSONB,
  p_checklist JSONB DEFAULT '[]'::JSONB,
  p_practical_infos JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_template_id UUID;
  v_section_rec RECORD;
  v_item_rec RECORD;
  v_check_rec RECORD;
  v_info_rec RECORD;
  v_section_id UUID;
BEGIN
  INSERT INTO public.stay_templates (key, name, description, category, icon, is_system, updated_at)
  VALUES (p_key, p_name, p_description, p_category, p_icon, TRUE, now())
  ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    is_system = TRUE,
    updated_at = now()
  RETURNING id INTO v_template_id;

  DELETE FROM public.stay_template_logistics_sections WHERE template_id = v_template_id;
  DELETE FROM public.stay_template_personal_checklist_items WHERE template_id = v_template_id;
  DELETE FROM public.stay_template_practical_infos WHERE template_id = v_template_id;

  FOR v_section_rec IN
    SELECT value, ordinality
    FROM jsonb_array_elements(p_sections) WITH ORDINALITY
  LOOP
    INSERT INTO public.stay_template_logistics_sections (
      template_id,
      title,
      section_type,
      notes,
      position
    )
    VALUES (
      v_template_id,
      v_section_rec.value->>'title',
      COALESCE(v_section_rec.value->>'section_type', 'autre'),
      NULLIF(v_section_rec.value->>'notes', ''),
      v_section_rec.ordinality::INTEGER - 1
    )
    RETURNING id INTO v_section_id;

    FOR v_item_rec IN
      SELECT value, ordinality
      FROM jsonb_array_elements(COALESCE(v_section_rec.value->'items', '[]'::JSONB)) WITH ORDINALITY
    LOOP
      INSERT INTO public.stay_template_logistics_items (
        template_section_id,
        title,
        quantity,
        notes,
        position
      )
      VALUES (
        v_section_id,
        v_item_rec.value->>'title',
        COALESCE(NULLIF(v_item_rec.value->>'quantity', '')::INTEGER, 1),
        NULLIF(v_item_rec.value->>'notes', ''),
        v_item_rec.ordinality::INTEGER - 1
      );
    END LOOP;
  END LOOP;

  FOR v_check_rec IN
    SELECT value, ordinality
    FROM jsonb_array_elements(p_checklist) WITH ORDINALITY
  LOOP
    INSERT INTO public.stay_template_personal_checklist_items (
      template_id,
      title,
      category,
      position
    )
    VALUES (
      v_template_id,
      v_check_rec.value->>'title',
      NULLIF(v_check_rec.value->>'category', ''),
      v_check_rec.ordinality::INTEGER - 1
    );
  END LOOP;

  FOR v_info_rec IN
    SELECT value, ordinality
    FROM jsonb_array_elements(p_practical_infos) WITH ORDINALITY
  LOOP
    INSERT INTO public.stay_template_practical_infos (
      template_id,
      title,
      value,
      position
    )
    VALUES (
      v_template_id,
      v_info_rec.value->>'title',
      NULLIF(v_info_rec.value->>'value', ''),
      v_info_rec.ordinality::INTEGER - 1
    );
  END LOOP;
END;
$$;

-- ── 4. Seeds système enrichis ────────────────────────────────

SELECT public.seed_system_stay_template(
  'weekend_amis',
  'Week-end entre amis',
  'Base complète pour un week-end entre amis : apéro, repas, couchage, ménage et petits oublis classiques.',
  'weekend',
  '🎉',
  '[{"title": "Apéro", "section_type": "apero", "notes": null, "items": [{"title": "Gobelets", "quantity": 20, "notes": null}, {"title": "Serviettes papier", "quantity": 20, "notes": null}, {"title": "Glaçons", "quantity": 2, "notes": null}, {"title": "Chips / snacks", "quantity": 3, "notes": null}, {"title": "Olives / cacahuètes", "quantity": 2, "notes": null}, {"title": "Piques à apéro", "quantity": 1, "notes": null}, {"title": "Décapsuleur / tire-bouchon", "quantity": 1, "notes": null}, {"title": "Sacs poubelle", "quantity": 5, "notes": null}]}, {"title": "Repas de base", "section_type": "repas", "notes": null, "items": [{"title": "Pain / baguettes", "quantity": 4, "notes": null}, {"title": "Boissons soft", "quantity": 6, "notes": null}, {"title": "Café / thé", "quantity": 1, "notes": null}, {"title": "Sucre", "quantity": 1, "notes": null}, {"title": "Sel et poivre", "quantity": 1, "notes": null}, {"title": "Huile d''olive", "quantity": 1, "notes": null}, {"title": "Sopalin", "quantity": 2, "notes": null}, {"title": "Film alimentaire / aluminium", "quantity": 1, "notes": null}]}, {"title": "Couchage", "section_type": "sleeping", "notes": null, "items": [{"title": "Draps", "quantity": 4, "notes": null}, {"title": "Oreillers", "quantity": 4, "notes": null}, {"title": "Couvertures", "quantity": 4, "notes": null}, {"title": "Serviettes de bain", "quantity": 4, "notes": null}, {"title": "Matelas gonflable", "quantity": 1, "notes": null}, {"title": "Pompe matelas", "quantity": 1, "notes": null}]}, {"title": "Matériel utile", "section_type": "equipment", "notes": null, "items": [{"title": "Rallonge électrique", "quantity": 1, "notes": null}, {"title": "Multiprise", "quantity": 2, "notes": null}, {"title": "Enceinte Bluetooth", "quantity": 1, "notes": null}, {"title": "Chargeur téléphone", "quantity": 2, "notes": null}, {"title": "Jeux de société", "quantity": 2, "notes": null}, {"title": "Lampe / veilleuse", "quantity": 1, "notes": null}]}, {"title": "Ménage / fin de séjour", "section_type": "cleaning", "notes": null, "items": [{"title": "Sacs poubelle", "quantity": 5, "notes": null}, {"title": "Liquide vaisselle", "quantity": 1, "notes": null}, {"title": "Éponges", "quantity": 2, "notes": null}, {"title": "Torchons", "quantity": 2, "notes": null}, {"title": "Produit multi-surfaces", "quantity": 1, "notes": null}, {"title": "Papier toilette", "quantity": 4, "notes": null}]}, {"title": "Santé / imprévus", "section_type": "equipment", "notes": null, "items": [{"title": "Pansements", "quantity": 1, "notes": null}, {"title": "Paracétamol", "quantity": 1, "notes": null}, {"title": "Anti-moustiques", "quantity": 1, "notes": null}, {"title": "Crème solaire", "quantity": 1, "notes": null}, {"title": "Chargeur batterie externe", "quantity": 1, "notes": null}]}]'::JSONB,
  '[{"title": "Vêtements de rechange", "category": "bagages"}, {"title": "Téléphone + chargeur", "category": "materiel"}, {"title": "Trousse de toilette", "category": "hygiene"}, {"title": "Serviette personnelle", "category": "bagages"}, {"title": "Médicaments personnels", "category": "sante"}, {"title": "Carte d’identité", "category": "documents"}, {"title": "Espèces / carte bancaire", "category": "argent"}]'::JSONB,
  '[{"title": "Adresse", "value": ""}, {"title": "Code portail", "value": ""}, {"title": "Wi-Fi", "value": ""}, {"title": "Parking", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'vacances_famille',
  'Vacances famille',
  'Pour partir en famille sans oublier les essentiels : enfants, maison, courses, santé et activités.',
  'famille',
  '👨‍👩‍👧‍👦',
  '[{"title": "Courses de base", "section_type": "shopping", "notes": null, "items": [{"title": "Petit déjeuner", "quantity": 1, "notes": null}, {"title": "Goûters enfants", "quantity": 5, "notes": null}, {"title": "Eau en bouteilles", "quantity": 6, "notes": null}, {"title": "Boissons enfants", "quantity": 6, "notes": null}, {"title": "Café / thé", "quantity": 1, "notes": null}, {"title": "Pain / viennoiseries", "quantity": 4, "notes": null}, {"title": "Fruits", "quantity": 3, "notes": null}, {"title": "Sacs congélation", "quantity": 1, "notes": null}]}, {"title": "Enfants", "section_type": "equipment", "notes": null, "items": [{"title": "Doudous / tétines", "quantity": 1, "notes": null}, {"title": "Jeux / coloriages", "quantity": 2, "notes": null}, {"title": "Livres enfants", "quantity": 2, "notes": null}, {"title": "Lingettes", "quantity": 3, "notes": null}, {"title": "Couches / changes", "quantity": 1, "notes": null}, {"title": "Crème solaire enfants", "quantity": 1, "notes": null}, {"title": "Chapeaux / casquettes", "quantity": 4, "notes": null}, {"title": "Veilleuse", "quantity": 1, "notes": null}]}, {"title": "Maison / location", "section_type": "cleaning", "notes": null, "items": [{"title": "Papier toilette", "quantity": 6, "notes": null}, {"title": "Sacs poubelle", "quantity": 5, "notes": null}, {"title": "Produit vaisselle", "quantity": 1, "notes": null}, {"title": "Éponges", "quantity": 2, "notes": null}, {"title": "Torchons", "quantity": 2, "notes": null}, {"title": "Lessive", "quantity": 1, "notes": null}, {"title": "Produit multi-surfaces", "quantity": 1, "notes": null}]}, {"title": "Santé famille", "section_type": "equipment", "notes": null, "items": [{"title": "Trousse de secours", "quantity": 1, "notes": null}, {"title": "Thermomètre", "quantity": 1, "notes": null}, {"title": "Paracétamol enfant/adulte", "quantity": 1, "notes": null}, {"title": "Pansements", "quantity": 1, "notes": null}, {"title": "Anti-moustiques", "quantity": 1, "notes": null}, {"title": "Carnets de santé / ordonnances", "quantity": 1, "notes": null}]}, {"title": "Sorties / plein air", "section_type": "activite", "notes": null, "items": [{"title": "Glacière", "quantity": 1, "notes": null}, {"title": "Pique-nique", "quantity": 1, "notes": null}, {"title": "Serviettes de plage", "quantity": 4, "notes": null}, {"title": "Ballon / jeux extérieurs", "quantity": 2, "notes": null}, {"title": "Porte-bébé / poussette", "quantity": 1, "notes": null}, {"title": "Sac à dos journée", "quantity": 1, "notes": null}]}]'::JSONB,
  '[{"title": "Vêtements enfants", "category": "bagages"}, {"title": "Pyjamas", "category": "bagages"}, {"title": "Médicaments enfants", "category": "sante"}, {"title": "Cartes vitales", "category": "documents"}, {"title": "Jeux pour le trajet", "category": "enfants"}, {"title": "Chargeurs tablette/téléphone", "category": "materiel"}]'::JSONB,
  '[{"title": "Adresse de la location", "value": ""}, {"title": "Contact sur place", "value": ""}, {"title": "Pharmacie la plus proche", "value": ""}, {"title": "Consignes enfants", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'anniversaire',
  'Anniversaire',
  'Déco, gâteau, ambiance et petits détails pour organiser un anniversaire sans courir partout.',
  'anniversaire',
  '🎂',
  '[{"title": "Décoration", "section_type": "equipment", "notes": null, "items": [{"title": "Ballons", "quantity": 20, "notes": null}, {"title": "Guirlandes", "quantity": 2, "notes": null}, {"title": "Banderole anniversaire", "quantity": 1, "notes": null}, {"title": "Bougies d''anniversaire", "quantity": 1, "notes": null}, {"title": "Nappe de fête", "quantity": 1, "notes": null}, {"title": "Confettis", "quantity": 2, "notes": null}, {"title": "Scotch / ficelle", "quantity": 1, "notes": null}]}, {"title": "Repas / gâteau", "section_type": "repas", "notes": null, "items": [{"title": "Gâteau d''anniversaire", "quantity": 1, "notes": null}, {"title": "Boissons soft", "quantity": 6, "notes": null}, {"title": "Boissons alcoolisées", "quantity": 4, "notes": null}, {"title": "Assiettes", "quantity": 20, "notes": null}, {"title": "Gobelets", "quantity": 20, "notes": null}, {"title": "Couverts", "quantity": 20, "notes": null}, {"title": "Serviettes papier", "quantity": 20, "notes": null}, {"title": "Couteau à gâteau", "quantity": 1, "notes": null}]}, {"title": "Animation", "section_type": "activite", "notes": null, "items": [{"title": "Enceinte Bluetooth", "quantity": 1, "notes": null}, {"title": "Playlist préparée", "quantity": 1, "notes": null}, {"title": "Jeux de groupe", "quantity": 2, "notes": null}, {"title": "Appareil photo / Polaroid", "quantity": 1, "notes": null}, {"title": "Livre d''or", "quantity": 1, "notes": null}, {"title": "Accessoires photo", "quantity": 1, "notes": null}]}, {"title": "Cadeaux", "section_type": "autre", "notes": null, "items": [{"title": "Papier cadeau", "quantity": 2, "notes": null}, {"title": "Rubans / bolduc", "quantity": 1, "notes": null}, {"title": "Carte de vœux", "quantity": 3, "notes": null}, {"title": "Sac cadeau", "quantity": 3, "notes": null}]}, {"title": "Ménage après fête", "section_type": "cleaning", "notes": null, "items": [{"title": "Sacs poubelle", "quantity": 5, "notes": null}, {"title": "Sopalin", "quantity": 2, "notes": null}, {"title": "Produit multi-surfaces", "quantity": 1, "notes": null}, {"title": "Éponges", "quantity": 2, "notes": null}]}]'::JSONB,
  '[{"title": "Cadeau d''anniversaire", "category": "cadeaux"}, {"title": "Tenue de fête", "category": "bagages"}, {"title": "Message / discours", "category": "animation"}, {"title": "Téléphone chargé", "category": "materiel"}]'::JSONB,
  '[{"title": "Heure de surprise", "value": ""}, {"title": "Lieu du gâteau", "value": ""}, {"title": "Contact référent", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'evg_evjf',
  'EVG / EVJF',
  'Le nécessaire pour un week-end EVG/EVJF : soirée, activités, transport et sécurité.',
  'evg',
  '💍',
  '[{"title": "Soirée / apéro", "section_type": "apero", "notes": null, "items": [{"title": "Champagne / boisson principale", "quantity": 3, "notes": null}, {"title": "Softs", "quantity": 6, "notes": null}, {"title": "Glaçons", "quantity": 3, "notes": null}, {"title": "Verres / flûtes", "quantity": 20, "notes": null}, {"title": "Snacks", "quantity": 5, "notes": null}, {"title": "Seau à glaçons", "quantity": 1, "notes": null}, {"title": "Décapsuleur / tire-bouchon", "quantity": 1, "notes": null}]}, {"title": "Accessoires / déguisements", "section_type": "equipment", "notes": null, "items": [{"title": "Accessoire du/de la futur(e) marié(e)", "quantity": 1, "notes": null}, {"title": "Déguisements thématiques", "quantity": 1, "notes": null}, {"title": "Accessoires photo", "quantity": 1, "notes": null}, {"title": "Bandeau / couronne", "quantity": 1, "notes": null}, {"title": "T-shirts personnalisés", "quantity": 1, "notes": null}]}, {"title": "Animations", "section_type": "activite", "notes": null, "items": [{"title": "Jeux et défis préparés", "quantity": 1, "notes": null}, {"title": "Playlist", "quantity": 1, "notes": null}, {"title": "Enceinte Bluetooth", "quantity": 1, "notes": null}, {"title": "Polaroid + pellicules", "quantity": 1, "notes": null}, {"title": "Planning des activités", "quantity": 1, "notes": null}]}, {"title": "Transport", "section_type": "transport", "notes": null, "items": [{"title": "Réservation taxi/VTC", "quantity": 1, "notes": null}, {"title": "Itinéraires", "quantity": 1, "notes": null}, {"title": "Conducteurs désignés", "quantity": 1, "notes": null}, {"title": "Budget transport", "quantity": 1, "notes": null}]}, {"title": "Sécurité / imprévus", "section_type": "equipment", "notes": null, "items": [{"title": "Trousse de secours", "quantity": 1, "notes": null}, {"title": "Paracétamol", "quantity": 1, "notes": null}, {"title": "Batterie externe", "quantity": 1, "notes": null}, {"title": "Liste contacts urgence", "quantity": 1, "notes": null}]}]'::JSONB,
  '[{"title": "Carte d’identité", "category": "documents"}, {"title": "Tenue de soirée", "category": "bagages"}, {"title": "Chargeur téléphone", "category": "materiel"}, {"title": "Espèces pour activités", "category": "argent"}, {"title": "Médicaments personnels", "category": "sante"}]'::JSONB,
  '[{"title": "Adresse hébergement", "value": ""}, {"title": "Contacts taxis", "value": ""}, {"title": "Planning activités", "value": ""}, {"title": "Budget par personne", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'sejour_plage',
  'Séjour plage',
  'Plage, soleil, pique-nique et après-plage : tout pour éviter les oublis classiques.',
  'plage',
  '🏖️',
  '[{"title": "Plage", "section_type": "activite", "notes": null, "items": [{"title": "Serviettes de plage", "quantity": 4, "notes": null}, {"title": "Crème solaire SPF 50", "quantity": 2, "notes": null}, {"title": "Chapeaux / casquettes", "quantity": 4, "notes": null}, {"title": "Lunettes de soleil", "quantity": 4, "notes": null}, {"title": "Parasol / tente de plage", "quantity": 1, "notes": null}, {"title": "Jeux de plage", "quantity": 2, "notes": null}, {"title": "Sac étanche", "quantity": 1, "notes": null}]}, {"title": "Pique-nique plage", "section_type": "repas", "notes": null, "items": [{"title": "Glacière", "quantity": 1, "notes": null}, {"title": "Pains / wraps", "quantity": 4, "notes": null}, {"title": "Fruits frais", "quantity": 2, "notes": null}, {"title": "Eau", "quantity": 6, "notes": null}, {"title": "Boissons fraîches", "quantity": 6, "notes": null}, {"title": "Snacks", "quantity": 4, "notes": null}, {"title": "Sacs poubelle", "quantity": 2, "notes": null}]}, {"title": "Après-plage", "section_type": "cleaning", "notes": null, "items": [{"title": "Après-soleil", "quantity": 1, "notes": null}, {"title": "Gel douche", "quantity": 1, "notes": null}, {"title": "Talc anti-sable", "quantity": 1, "notes": null}, {"title": "Tongs de rechange", "quantity": 2, "notes": null}, {"title": "Sac linge mouillé", "quantity": 1, "notes": null}]}, {"title": "Sécurité", "section_type": "equipment", "notes": null, "items": [{"title": "Trousse de secours", "quantity": 1, "notes": null}, {"title": "Pansements ampoules", "quantity": 1, "notes": null}, {"title": "Anti-moustiques", "quantity": 1, "notes": null}, {"title": "Housse imperméable téléphone", "quantity": 2, "notes": null}]}]'::JSONB,
  '[{"title": "Maillot de bain x2", "category": "bagages"}, {"title": "Crème solaire personnelle", "category": "sante"}, {"title": "Lunettes de soleil", "category": "bagages"}, {"title": "Livre / liseuse", "category": "loisirs"}, {"title": "Écouteurs", "category": "loisirs"}, {"title": "Sac pour linge mouillé", "category": "bagages"}]'::JSONB,
  '[{"title": "Plage la plus proche", "value": ""}, {"title": "Parking plage", "value": ""}, {"title": "Point de rendez-vous", "value": ""}, {"title": "Horaires marées", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'barbecue',
  'Séjour barbecue',
  'Charbon, grillades, accompagnements et service : une base prête pour barbecue ou grillades.',
  'barbecue',
  '🍖',
  '[{"title": "Barbecue", "section_type": "equipment", "notes": null, "items": [{"title": "Charbon de bois", "quantity": 3, "notes": null}, {"title": "Allume-feu", "quantity": 1, "notes": null}, {"title": "Briquet / allumettes", "quantity": 1, "notes": null}, {"title": "Pinces / spatule BBQ", "quantity": 1, "notes": null}, {"title": "Gants chaleur", "quantity": 1, "notes": null}, {"title": "Aluminium", "quantity": 1, "notes": null}, {"title": "Grille de rechange", "quantity": 1, "notes": null}]}, {"title": "Grillades & accompagnements", "section_type": "repas", "notes": null, "items": [{"title": "Viandes / grillades", "quantity": 1, "notes": null}, {"title": "Option végétarienne", "quantity": 1, "notes": null}, {"title": "Pain / baguettes", "quantity": 4, "notes": null}, {"title": "Sauces", "quantity": 3, "notes": null}, {"title": "Légumes à griller", "quantity": 2, "notes": null}, {"title": "Salades composées", "quantity": 2, "notes": null}, {"title": "Maïs", "quantity": 4, "notes": null}]}, {"title": "Boissons & apéro", "section_type": "apero", "notes": null, "items": [{"title": "Softs", "quantity": 6, "notes": null}, {"title": "Boissons fraîches", "quantity": 6, "notes": null}, {"title": "Glaçons", "quantity": 3, "notes": null}, {"title": "Chips / olives", "quantity": 3, "notes": null}, {"title": "Eau", "quantity": 6, "notes": null}]}, {"title": "Vaisselle & service", "section_type": "equipment", "notes": null, "items": [{"title": "Assiettes", "quantity": 20, "notes": null}, {"title": "Couverts", "quantity": 20, "notes": null}, {"title": "Gobelets", "quantity": 20, "notes": null}, {"title": "Serviettes", "quantity": 20, "notes": null}, {"title": "Sacs poubelle", "quantity": 5, "notes": null}, {"title": "Essuie-mains", "quantity": 2, "notes": null}]}, {"title": "Nettoyage BBQ", "section_type": "cleaning", "notes": null, "items": [{"title": "Brosse pour grille", "quantity": 1, "notes": null}, {"title": "Produit dégraissant", "quantity": 1, "notes": null}, {"title": "Éponges", "quantity": 2, "notes": null}, {"title": "Sacs charbon/cendres", "quantity": 2, "notes": null}]}]'::JSONB,
  '[{"title": "Boisson personnelle", "category": "boissons"}, {"title": "Plat à partager", "category": "repas"}, {"title": "Tenue confortable", "category": "bagages"}, {"title": "Pull pour le soir", "category": "bagages"}]'::JSONB,
  '[{"title": "Zone barbecue", "value": ""}, {"title": "Règles feu/barbecue", "value": ""}, {"title": "Lieu des poubelles", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'rando_nature',
  'Randonnée & nature',
  'Matériel, vivres, sécurité et bivouac pour un séjour en pleine nature.',
  'nature',
  '🥾',
  '[{"title": "Équipement randonnée", "section_type": "equipment", "notes": null, "items": [{"title": "Sacs à dos", "quantity": 4, "notes": null}, {"title": "Bâtons de randonnée", "quantity": 4, "notes": null}, {"title": "Cartes / GPS", "quantity": 1, "notes": null}, {"title": "Lampes frontales + piles", "quantity": 4, "notes": null}, {"title": "Batterie externe", "quantity": 2, "notes": null}, {"title": "Couvertures de survie", "quantity": 4, "notes": null}, {"title": "Sifflet de détresse", "quantity": 1, "notes": null}]}, {"title": "Vivres & hydratation", "section_type": "repas", "notes": null, "items": [{"title": "Gourdes", "quantity": 4, "notes": null}, {"title": "Eau", "quantity": 6, "notes": null}, {"title": "Barres énergétiques", "quantity": 12, "notes": null}, {"title": "Fruits secs", "quantity": 4, "notes": null}, {"title": "Sandwichs", "quantity": 4, "notes": null}, {"title": "Pastilles purification eau", "quantity": 1, "notes": null}]}, {"title": "Santé / secours", "section_type": "equipment", "notes": null, "items": [{"title": "Pansements", "quantity": 1, "notes": null}, {"title": "Bande élastique", "quantity": 2, "notes": null}, {"title": "Antiseptique", "quantity": 1, "notes": null}, {"title": "Compresses stériles", "quantity": 4, "notes": null}, {"title": "Pince à tiques", "quantity": 1, "notes": null}, {"title": "Crème solaire", "quantity": 1, "notes": null}, {"title": "Anti-moustiques", "quantity": 1, "notes": null}]}, {"title": "Bivouac", "section_type": "sleeping", "notes": null, "items": [{"title": "Tente", "quantity": 2, "notes": null}, {"title": "Sacs de couchage", "quantity": 4, "notes": null}, {"title": "Matelas de sol", "quantity": 4, "notes": null}, {"title": "Réchaud + gaz", "quantity": 1, "notes": null}, {"title": "Ustensiles camping", "quantity": 1, "notes": null}, {"title": "Sacs poubelle hermétiques", "quantity": 3, "notes": null}]}]'::JSONB,
  '[{"title": "Chaussures de randonnée", "category": "bagages"}, {"title": "Vêtement imperméable", "category": "bagages"}, {"title": "Lunettes de soleil", "category": "bagages"}, {"title": "Téléphone chargé", "category": "materiel"}, {"title": "Batterie externe", "category": "materiel"}, {"title": "Carte identité / assurance", "category": "documents"}]'::JSONB,
  '[{"title": "Itinéraire", "value": ""}, {"title": "Point de départ", "value": ""}, {"title": "Numéro secours", "value": ""}, {"title": "Météo à vérifier", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'ski_montagne',
  'Séjour ski / montagne',
  'Pour la montagne : vêtements chauds, matériel, repas raclette et sécurité neige.',
  'montagne',
  '⛷️',
  '[{"title": "Matériel ski", "section_type": "equipment", "notes": null, "items": [{"title": "Skis / snowboard", "quantity": 1, "notes": null}, {"title": "Chaussures ski", "quantity": 1, "notes": null}, {"title": "Casque", "quantity": 1, "notes": null}, {"title": "Masque / lunettes", "quantity": 1, "notes": null}, {"title": "Gants chauds", "quantity": 1, "notes": null}, {"title": "Forfaits", "quantity": 1, "notes": null}]}, {"title": "Vêtements chauds", "section_type": "equipment", "notes": null, "items": [{"title": "Combinaison / pantalon ski", "quantity": 1, "notes": null}, {"title": "Sous-couches thermiques", "quantity": 2, "notes": null}, {"title": "Pull chaud", "quantity": 2, "notes": null}, {"title": "Chaussettes ski", "quantity": 3, "notes": null}, {"title": "Bonnet", "quantity": 1, "notes": null}, {"title": "Tour de cou", "quantity": 1, "notes": null}]}, {"title": "Repas montagne", "section_type": "repas", "notes": null, "items": [{"title": "Fromage raclette / fondue", "quantity": 1, "notes": null}, {"title": "Charcuterie", "quantity": 1, "notes": null}, {"title": "Pommes de terre", "quantity": 1, "notes": null}, {"title": "Pain", "quantity": 2, "notes": null}, {"title": "Boissons chaudes", "quantity": 1, "notes": null}, {"title": "Chocolat / goûter", "quantity": 2, "notes": null}]}, {"title": "Sécurité / voiture", "section_type": "transport", "notes": null, "items": [{"title": "Chaînes / chaussettes neige", "quantity": 1, "notes": null}, {"title": "Raclette pare-brise", "quantity": 1, "notes": null}, {"title": "Lampe de poche", "quantity": 1, "notes": null}, {"title": "Trousse secours", "quantity": 1, "notes": null}]}]'::JSONB,
  '[{"title": "Veste chaude", "category": "bagages"}, {"title": "Gants / bonnet", "category": "bagages"}, {"title": "Crème solaire montagne", "category": "sante"}, {"title": "Baume à lèvres", "category": "sante"}, {"title": "Carte identité", "category": "documents"}]'::JSONB,
  '[{"title": "Adresse chalet", "value": ""}, {"title": "Parking", "value": ""}, {"title": "Location matériel", "value": ""}, {"title": "Météo / enneigement", "value": ""}]'::JSONB
);

SELECT public.seed_system_stay_template(
  'camping',
  'Camping',
  'Base complète pour un séjour camping : installation, cuisine, couchage et vie quotidienne.',
  'nature',
  '⛺',
  '[{"title": "Installation camp", "section_type": "sleeping", "notes": null, "items": [{"title": "Tente", "quantity": 1, "notes": null}, {"title": "Sardines / maillet", "quantity": 1, "notes": null}, {"title": "Tapis de sol", "quantity": 1, "notes": null}, {"title": "Sacs de couchage", "quantity": 4, "notes": null}, {"title": "Matelas gonflables", "quantity": 2, "notes": null}, {"title": "Pompe matelas", "quantity": 1, "notes": null}]}, {"title": "Cuisine camping", "section_type": "repas", "notes": null, "items": [{"title": "Réchaud + gaz", "quantity": 1, "notes": null}, {"title": "Casserole / poêle", "quantity": 1, "notes": null}, {"title": "Assiettes / couverts", "quantity": 4, "notes": null}, {"title": "Gobelets", "quantity": 4, "notes": null}, {"title": "Glacière", "quantity": 1, "notes": null}, {"title": "Briquet", "quantity": 1, "notes": null}, {"title": "Éponge + liquide vaisselle", "quantity": 1, "notes": null}]}, {"title": "Vie quotidienne", "section_type": "equipment", "notes": null, "items": [{"title": "Lampes frontales", "quantity": 4, "notes": null}, {"title": "Multiprise camping", "quantity": 1, "notes": null}, {"title": "Batterie externe", "quantity": 2, "notes": null}, {"title": "Corde à linge", "quantity": 1, "notes": null}, {"title": "Pinces à linge", "quantity": 1, "notes": null}, {"title": "Sacs poubelle", "quantity": 4, "notes": null}]}, {"title": "Hygiène", "section_type": "cleaning", "notes": null, "items": [{"title": "Papier toilette", "quantity": 2, "notes": null}, {"title": "Gel douche", "quantity": 1, "notes": null}, {"title": "Serviettes", "quantity": 4, "notes": null}, {"title": "Tongs douche", "quantity": 4, "notes": null}, {"title": "Trousse secours", "quantity": 1, "notes": null}]}]'::JSONB,
  '[{"title": "Duvet personnel", "category": "bagages"}, {"title": "Lampe frontale", "category": "materiel"}, {"title": "Tongs douche", "category": "bagages"}, {"title": "Serviette microfibre", "category": "bagages"}, {"title": "Anti-moustiques", "category": "sante"}]'::JSONB,
  '[{"title": "Adresse camping", "value": ""}, {"title": "Numéro emplacement", "value": ""}, {"title": "Horaires accueil", "value": ""}, {"title": "Code sanitaires", "value": ""}]'::JSONB
);

DROP FUNCTION IF EXISTS public.seed_system_stay_template(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB);
