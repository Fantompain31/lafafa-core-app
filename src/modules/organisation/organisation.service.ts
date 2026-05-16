// src/modules/organisation/organisation.service.ts

import { createClient } from '@/lib/supabase/client';
import type {
  OrganizationEvent,
  EventFormValues,
  EventsByDay,
} from './organisation.types';

// ── Lecture ─────────────────────────────────────────────────

export async function getOrganizationEvents(stayId: string): Promise<OrganizationEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organization_events')
    .select('*')
    .eq('stay_id', stayId)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationEvent[];
}

// Regroupe les événements par date.
// Un événement multi-jours apparaît dans chaque jour qu'il couvre.
export function groupEventsByDay(events: OrganizationEvent[]): EventsByDay {
  const result: EventsByDay = {};
  for (const event of events) {
    const start = event.event_date;
    const end   = event.end_date ?? event.event_date;
    let cursor  = start;
    while (cursor <= end) {
      if (!result[cursor]) result[cursor] = [];
      // Évite les doublons si appelé plusieurs fois
      if (!result[cursor].find(e => e.id === event.id)) {
        result[cursor].push(event);
      }
      cursor = nextDay(cursor);
    }
  }
  return result;
}

function nextDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Création ────────────────────────────────────────────────

export async function createOrganizationEvent(
  stayId: string,
  values: EventFormValues
): Promise<string> {
  const supabase = createClient();
  const { data: eventId, error } = await supabase.rpc('create_organization_event', {
    p_stay_id:     stayId,
    p_title:       values.title.trim(),
    p_event_type:  values.event_type,
    p_event_date:  values.event_date,
    p_start_time:  values.start_time  || null,
    p_end_time:    values.end_time    || null,
    p_end_date:    values.end_date    || null,
    p_location:    values.location.trim()    || null,
    p_description: values.description.trim() || null,
    p_status:      values.status,
  });
  if (error) throw new Error(error.message);

  if (values.create_logistics && eventId) {
    await createLinkedLogisticsSection(
      stayId,
      eventId,
      values.title.trim(),
      values.event_type,
      values.description.trim() || undefined,
    );
  }
  return eventId as string;
}

// ── Mise à jour ─────────────────────────────────────────────

export async function updateOrganizationEvent(
  eventId: string,
  values: EventFormValues
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('update_organization_event', {
    p_event_id:    eventId,
    p_title:       values.title.trim(),
    p_event_type:  values.event_type,
    p_event_date:  values.event_date,
    p_start_time:  values.start_time  || null,
    p_end_time:    values.end_time    || null,
    p_end_date:    values.end_date    || null,
    p_location:    values.location.trim()    || null,
    p_description: values.description.trim() || null,
    p_status:      values.status,
  });
  if (error) throw new Error(error.message);
}

// ── Suppression ─────────────────────────────────────────────

export async function deleteOrganizationEvent(eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_organization_event', { p_event_id: eventId });
  if (error) throw new Error(error.message);
}

// ── Duplication ─────────────────────────────────────────────

export async function duplicateOrganizationEvent(
  eventId: string,
  original: OrganizationEvent
): Promise<OrganizationEvent> {
  const supabase = createClient();
  const { data: newId, error } = await supabase.rpc('duplicate_organization_event', {
    p_event_id: eventId,
  });
  if (error) throw new Error(error.message);
  // Retourne une copie optimiste pour mise à jour UI immédiate
  return {
    ...original,
    id:         newId as string,
    title:      original.title + ' (copie)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    logistics_section_id: null,
  };
}

// ── Lien inter-modules ───────────────────────────────────────

async function createLinkedLogisticsSection(
  stayId: string,
  eventId: string,
  title: string,
  eventType: string,
  notes?: string,
): Promise<void> {
  const supabase = createClient();
  try {
    const { data: sectionId, error } = await supabase.rpc(
      'ensure_logistics_section_for_source',
      {
        p_stay_id:      stayId,
        p_title:        title,
        p_section_type: eventType,
        p_source_type:  'organization_event',
        p_source_id:    eventId,
        p_notes:        notes ?? null,
      }
    );
    if (error) {
      console.warn('[Organisation] ensure_logistics_section_for_source indisponible :', error.message);
      return;
    }
    if (sectionId) {
      await supabase.rpc('link_logistics_section_to_event', {
        p_event_id:             eventId,
        p_logistics_section_id: sectionId,
      });
    }
  } catch (e) {
    console.warn('[Organisation] Impossible de créer la section logistique :', e);
  }
}
