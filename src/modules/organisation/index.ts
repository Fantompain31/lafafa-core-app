// src/modules/organisation/index.ts
// Exports publics du module Organisation.
// Les autres modules ne doivent pas importer en profondeur dans ce dossier.

export type {
  OrganizationEvent,
  EventFormValues,
  EventType,
  EventStatus,
  EventsByDay,
} from './organisation.types';

export {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ICONS,
  EVENT_STATUS_LABELS,
} from './organisation.types';

// Note : les services ne sont pas exposés publiquement.
// Si Logistique a besoin de lire des événements, passer par la RPC ou la vue Supabase.
