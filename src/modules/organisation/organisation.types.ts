// src/modules/organisation/organisation.types.ts

export type EventType =
  | 'repas'
  | 'apero'
  | 'activite'
  | 'transport'
  | 'arrivee'
  | 'depart'
  | 'menage'
  | 'temps_libre'
  | 'autre';

export type EventStatus = 'draft' | 'confirmed' | 'cancelled';

// Types qui peuvent s'étendre sur plusieurs jours
export const MULTIDAY_TYPES: EventType[] = ['activite', 'transport', 'temps_libre', 'autre'];

export interface OrganizationEvent {
  id: string;
  stay_id: string;
  created_by: string;
  title: string;
  event_type: EventType;
  event_date: string;        // "2025-08-15"
  end_date: string | null;   // null = événement sur 1 jour
  start_time: string;        // "19:00:00"
  end_time: string | null;
  location: string | null;
  description: string | null;
  status: EventStatus;
  logistics_section_id: string | null;
  source_type: string | null;  // 'guest' | null
  source_id: string | null;    // id de la source
  created_at: string;
  updated_at: string;
}

export interface EventFormValues {
  title: string;
  event_type: EventType;
  event_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  status: EventStatus;
  create_logistics: boolean;
}

export type EventsByDay = Record<string, OrganizationEvent[]>;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  repas:       'Repas',
  apero:       'Apéro',
  activite:    'Activité',
  transport:   'Transport',
  arrivee:     'Arrivée',
  depart:      'Départ',
  menage:      'Ménage',
  temps_libre: 'Temps libre',
  autre:       'Autre',
};

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  repas:       '🍽️',
  apero:       '🥂',
  activite:    '🎯',
  transport:   '🚗',
  arrivee:     '👋',
  depart:      '👜',
  menage:      '🧹',
  temps_libre: '☀️',
  autre:       '📌',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft:     'Brouillon',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
};
