// src/modules/templates/templates.service.ts

import { createClient } from '@/lib/supabase/client'
import type {
  StayTemplate,
  StayTemplateWithSections,
  TemplateLogisticsSection,
  TemplatePersonalChecklistItem,
  ApplyTemplateResult,
} from './templates.types'

export const templatesService = {

  // ── Liste tous les templates ───────────────────────────────
  async getTemplates(): Promise<StayTemplate[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('stay_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as StayTemplate[]
  },

  // ── Charge un template complet avec sections + items ───────
  async getTemplateWithSections(templateId: string): Promise<StayTemplateWithSections | null> {
    const supabase = createClient()

    const { data: template, error: tErr } = await supabase
      .from('stay_templates')
      .select('*')
      .eq('id', templateId)
      .single()
    if (tErr || !template) return null

    const { data: sections, error: sErr } = await supabase
      .from('stay_template_logistics_sections')
      .select('*, items:stay_template_logistics_items(*)')
      .eq('template_id', templateId)
      .order('position', { ascending: true })
    if (sErr) throw new Error(sErr.message)

    const { data: checklist, error: cErr } = await supabase
      .from('stay_template_personal_checklist_items')
      .select('*')
      .eq('template_id', templateId)
      .order('position', { ascending: true })
    if (cErr) throw new Error(cErr.message)

    // Trier les items de chaque section
    const sectionsWithSortedItems = ((sections ?? []) as (TemplateLogisticsSection & { items: unknown[] })[]).map(s => ({
      ...s,
      items: (s.items ?? []).sort((a: any, b: any) => a.position - b.position),
    }))

    return {
      ...template as StayTemplate,
      sections: sectionsWithSortedItems as TemplateLogisticsSection[],
      checklist: (checklist ?? []) as TemplatePersonalChecklistItem[],
    }
  },

  // ── Applique un template à un séjour ──────────────────────
  async applyTemplate(stayId: string, templateId: string): Promise<ApplyTemplateResult> {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('apply_stay_template', {
      p_stay_id:     stayId,
      p_template_id: templateId,
    })
    if (error) throw new Error(error.message)
    return data as ApplyTemplateResult
  },
}
