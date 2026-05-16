'use client';
// src/modules/organisation/components/EventCard.tsx

import { useState } from 'react';
import type { OrganizationEvent } from '../organisation.types';
import {
  EVENT_TYPE_ICONS,
  EVENT_TYPE_LABELS,
} from '../organisation.types';
import { deleteOrganizationEvent } from '../organisation.service';

interface Props {
  event: OrganizationEvent;
  onEdit:    (event: OrganizationEvent) => void;
  onDeleted: (eventId: string) => void;
}

export default function EventCard({ event, onEdit, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);

  const icon  = EVENT_TYPE_ICONS[event.event_type]  ?? '📌';
  const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;

  const timeRange = event.end_time
    ? `${fmtTime(event.start_time)} → ${fmtTime(event.end_time)}`
    : fmtTime(event.start_time);

  async function handleDelete() {
    if (!confirm(`Supprimer "${event.title}" ?`)) return;
    setDeleting(true);
    try {
      await deleteOrganizationEvent(event.id);
      onDeleted(event.id);
    } catch (e) {
      alert('Erreur lors de la suppression.');
      setDeleting(false);
    }
  }

  return (
    <div className="org-event-card" data-type={event.event_type}>
      <div className="org-event-icon">{icon}</div>

      <div className="org-event-body">
        <div className="org-event-title">
          {event.title}
          {event.status === 'draft'     && <span className="org-badge org-badge--draft">Brouillon</span>}
          {event.status === 'cancelled' && <span className="org-badge org-badge--cancelled">Annulé</span>}
        </div>

        <div className="org-event-meta">
          <span>{timeRange}</span>
          <span>{label}</span>
          {event.location && <span>{event.location}</span>}
        </div>

        {event.description && (
          <div className="org-event-desc">{event.description}</div>
        )}

        {event.logistics_section_id && (
          <div className="org-logistics-badge">📋 Logistique liée</div>
        )}
      </div>

      <div className="org-event-actions">
        <button
          className="org-btn-ghost"
          onClick={() => onEdit(event)}
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
        >
          Modifier
        </button>
        <button
          className="org-btn-danger"
          onClick={handleDelete}
          disabled={deleting}
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
        >
          {deleting ? '…' : 'Supprimer'}
        </button>
      </div>
    </div>
  );
}

// "19:00:00" → "19h00"
function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  return `${parseInt(h)}h${m === '00' ? '' : m}`;
}
