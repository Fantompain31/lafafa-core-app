// src/modules/templates/templates.types.ts

export interface StayTemplate {
  id: string
  key: string
  name: string
  description: string | null
  category: string | null
  icon: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface TemplateLogisticsSection {
  id: string
  template_id: string
  title: string
  section_type: string
  notes: string | null
  position: number
  items: TemplateLogisticsItem[]
}

export interface TemplateLogisticsItem {
  id: string
  template_section_id: string
  title: string
  quantity: number
  notes: string | null
  position: number
}

export interface TemplatePersonalChecklistItem {
  id: string
  template_id: string
  title: string
  category: string | null
  position: number
}

// Template avec toutes ses données chargées
export interface StayTemplateWithSections extends StayTemplate {
  sections: TemplateLogisticsSection[]
  checklist: TemplatePersonalChecklistItem[]
}

// Résultat de l'application d'un template
export interface ApplyTemplateResult {
  sections_created: number
  items_created: number
}

// Catégories disponibles
export const TEMPLATE_CATEGORIES: Record<string, string> = {
  weekend:      'Week-end',
  famille:      'Famille',
  anniversaire: 'Anniversaire',
  evg:          'EVG / EVJF',
  plage:        'Plage',
  barbecue:     'Barbecue',
  nature:       'Nature',
  montagne:     'Montagne / Ski',
  camping:      'Camping',
}
