// src/modules/templates/index.ts

export type {
  StayTemplate,
  StayTemplateWithSections,
  TemplateLogisticsSection,
  TemplateLogisticsItem,
  TemplatePersonalChecklistItem,
  ApplyTemplateResult,
} from './templates.types'

export { TEMPLATE_CATEGORIES } from './templates.types'
export { templatesService }    from './templates.service'
export { default as TemplatesPicker } from './TemplatesPicker'
