export type LogisticsSectionType =
  | 'repas'
  | 'apero'
  | 'activite'
  | 'transport'
  | 'arrivee'
  | 'depart'
  | 'menage'
  | 'temps_libre'
  | 'autre'
  | 'shopping'
  | 'equipment'
  | 'sleeping'
  | 'cleaning'
  | 'meal'
  | 'aperitif';

export interface LogisticsSection {
  id: string;
  stay_id: string;
  title: string;
  section_type: LogisticsSectionType;
  notes: string | null;
  source_type: string | null;
  source_id: string | null;
  is_hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogisticsItem {
  id: string;
  section_id: string;
  stay_id: string;
  label: string;
  quantity: string | null;
  notes: string | null;
  assigned_guest_id: string | null;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_by: string | null;
  source_type?: string | null;
  source_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogisticsGuest {
  id: string;
  first_name: string;
  last_name: string | null;
  color: string | null;
  linked_user_id: string | null;
  linked_user_avatar_url: string | null;
  food_preferences?: unknown;
}

export type LogisticsSectionWithItems = LogisticsSection & {
  items: LogisticsItem[];
};

export type LogisticsSectionFormValues = {
  title: string;
  section_type: LogisticsSectionType;
  notes: string;
};

export type LogisticsItemFormValues = {
  label: string;
  quantity: string;
  notes: string;
  assigned_guest_id: string;
};

export const LOGISTICS_SECTION_LABELS: Record<LogisticsSectionType, string> = {
  repas: 'Repas',
  apero: 'Apéro',
  activite: 'Activité',
  transport: 'Transport',
  arrivee: 'Arrivée',
  depart: 'Départ',
  menage: 'Ménage',
  temps_libre: 'Temps libre',
  autre: 'Autre',
  shopping: 'Courses',
  equipment: 'Matériel',
  sleeping: 'Couchage',
  cleaning: 'Ménage',
  meal: 'Repas',
  aperitif: 'Apéro',
};

export const LOGISTICS_SECTION_ICONS: Record<LogisticsSectionType, string> = {
  repas: '🍽️',
  apero: '🥂',
  activite: '🎯',
  transport: '🚗',
  arrivee: '👋',
  depart: '👜',
  menage: '🧹',
  temps_libre: '☀️',
  autre: '📌',
  shopping: '🛒',
  equipment: '🎒',
  sleeping: '🛏️',
  cleaning: '🧹',
  meal: '🍽️',
  aperitif: '🥂',
};

export const MANUAL_SECTION_TYPES: LogisticsSectionType[] = [
  'repas',
  'apero',
  'shopping',
  'equipment',
  'sleeping',
  'transport',
  'menage',
  'activite',
  'autre',
];
