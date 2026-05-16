'use client';
// src/modules/organisation/OrganisationPageClient.tsx

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { OrganizationEvent, EventFormValues, EventType } from './organisation.types';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ICONS } from './organisation.types';
import {
  groupEventsByDay,
  createOrganizationEvent,
  updateOrganizationEvent,
  deleteOrganizationEvent,
  duplicateOrganizationEvent,
} from './organisation.service';
import EventFormModal from './components/EventFormModal';
import Toast         from './components/Toast';
import './organisation.css';

interface Props {
  stayId:        string;
  stayStart:     string;
  stayEnd:       string;
  initialEvents: OrganizationEvent[];
}

type View = 'grid' | 'list';
interface ToastMsg { id: number; message: string; type: 'success' | 'info'; }

const TYPE_COLORS: Record<EventType, string> = {
  repas:       'ev-repas',
  apero:       'ev-apero',
  activite:    'ev-activite',
  transport:   'ev-transport',
  arrivee:     'ev-arrivee',
  depart:      'ev-depart',
  menage:      'ev-menage',
  temps_libre: 'ev-temps_libre',
  autre:       'ev-autre',
};

const DOT_COLORS: Record<EventType, string> = {
  repas:       '#F5841F',
  apero:       '#7F77DD',
  activite:    '#639922',
  transport:   '#378ADD',
  arrivee:     '#1D9E75',
  depart:      '#888780',
  menage:      '#95a5a6',
  temps_libre: '#BA7517',
  autre:       '#D4537E',
};

let toastId = 0;

export default function OrganisationPageClient({ stayId, stayStart, stayEnd, initialEvents }: Props) {
  const router = useRouter();
  const [events,      setEvents]      = useState<OrganizationEvent[]>(initialEvents);
  const [view,        setView]        = useState<View>('grid');
  const [filter,      setFilter]      = useState<EventType | 'all'>('all');
  const [showModal,   setShowModal]   = useState(false);
  const [editEvent,   setEditEvent]   = useState<OrganizationEvent | null>(null);
  const [prefillDate, setPrefillDate] = useState('');
  const [toasts,      setToasts]      = useState<ToastMsg[]>([]);

  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const days  = useMemo(() => Object.keys(byDay).sort(), [byDay]);

  const filtered = useCallback(
    (evs: OrganizationEvent[]) =>
      filter === 'all' ? evs : evs.filter(e => e.event_type === filter),
    [filter]
  );

  function pushToast(message: string, type: 'success' | 'info' = 'success') {
    const id = ++toastId;
    setToasts(t => [...t, { id, message, type }]);
  }
  function dismissToast(id: number) {
    setToasts(t => t.filter(x => x.id !== id));
  }

  const openCreate  = (date?: string) => { setEditEvent(null); setPrefillDate(date ?? stayStart); setShowModal(true); };
  const openEdit    = (ev: OrganizationEvent) => { setEditEvent(ev); setShowModal(true); };
  const closeModal  = () => { setShowModal(false); setEditEvent(null); setPrefillDate(''); };

  const sortedInsert = (prev: OrganizationEvent[], ev: OrganizationEvent) =>
    [...prev, ev].sort((a, b) => {
      const d = a.event_date.localeCompare(b.event_date);
      return d !== 0 ? d : a.start_time.localeCompare(b.start_time);
    });

  const handleSave = useCallback(async (values: EventFormValues) => {
    if (editEvent) {
      await updateOrganizationEvent(editEvent.id, values);
      setEvents(prev => prev.map(e =>
        e.id === editEvent.id
          ? {
              ...e,
              title:       values.title,
              event_type:  values.event_type,
              event_date:  values.event_date,
              end_date:    values.end_date    || null,
              start_time:  values.start_time,
              end_time:    values.end_time    || null,
              location:    values.location    || null,
              description: values.description || null,
              status:      values.status,
            }
          : e
      ));
      pushToast('Événement modifié');
    } else {
      const newId = await createOrganizationEvent(stayId, values);

      // Mise à jour optimiste immédiate dans tous les cas
      const newEvent: OrganizationEvent = {
        id:                   newId,
        stay_id:              stayId,
        created_by:           '',
        title:                values.title,
        event_type:           values.event_type,
        event_date:           values.event_date,
        end_date:             values.end_date    || null,
        start_time:           values.start_time,
        end_time:             values.end_time    || null,
        location:             values.location    || null,
        description:          values.description || null,
        status:               values.status,
        logistics_section_id: null,
        source_type:          null,
        source_id:            null,
        created_at:           new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      };
      setEvents(prev => sortedInsert(prev, newEvent));

      if (values.create_logistics) {
        pushToast('Événement créé + section logistique ajoutée 📋');
        // Refresh silencieux en arrière-plan pour récupérer le vrai logistics_section_id
        // sans bloquer l'UI — le badge 📋 apparaîtra après le prochain re-render serveur
        router.refresh();
      } else {
        pushToast('Événement ajouté au planning');
      }
    }
  }, [editEvent, stayId, router]);

  const handleDeleted = useCallback(async (eventId: string) => {
    await deleteOrganizationEvent(eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    pushToast('Événement supprimé', 'info');
  }, []);

  const handleDuplicate = useCallback(async (event: OrganizationEvent) => {
    const copy = await duplicateOrganizationEvent(event.id, event);
    setEvents(prev => sortedInsert(prev, copy));
    pushToast(`"${event.title}" dupliqué`);
  }, []);

  return (
    <div className="org-root">

      {/* Toolbar */}
      <div className="org-toolbar">
        <div className="org-toolbar-left">
          <h1 className="org-page-title">📅 Planning du séjour</h1>
        </div>
        <div className="org-toolbar-right">
          <button className="org-btn-primary" onClick={() => openCreate()}>
            + Ajouter
          </button>
          <div className="org-view-toggle">
            <button className={`org-view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')}>
              ▦ Jours
            </button>
            <button className={`org-view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>
              ≡ Liste
            </button>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="org-filters">
        <button className={`org-tag org-tag-all${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Tous
        </button>
        {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(type => (
          <button
            key={type}
            className={`org-tag org-tag-${type}${filter === type ? ' active' : ''}`}
            onClick={() => setFilter(type)}
          >
            {EVENT_TYPE_ICONS[type]} {EVENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {days.length === 0 ? (
        <div className="org-empty">
          <p>Aucun événement pour l'instant.</p>
          <p>Ajoutez le premier moment du séjour !</p>
        </div>
      ) : view === 'grid' ? (
        <GridView
          days={days}
          byDay={byDay}
          filtered={filtered}
          onEdit={openEdit}
          onDeleted={handleDeleted}
          onDuplicate={handleDuplicate}
          onAdd={openCreate}
        />
      ) : (
        <ListView
          days={days}
          byDay={byDay}
          filtered={filtered}
          onEdit={openEdit}
          onDeleted={handleDeleted}
          onDuplicate={handleDuplicate}
        />
      )}

      {showModal && (
        <EventFormModal
          stayId={stayId}
          stayStart={stayStart}
          stayEnd={stayEnd}
          editEvent={editEvent}
          prefillDate={prefillDate}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      <div className="org-toasts">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onDone={() => dismissToast(t.id)} />
        ))}
      </div>
    </div>
  );
}

// ── Vue grille ───────────────────────────────────────────────

function GridView({ days, byDay, filtered, onEdit, onDeleted, onDuplicate, onAdd }: {
  days: string[];
  byDay: Record<string, OrganizationEvent[]>;
  filtered: (evs: OrganizationEvent[]) => OrganizationEvent[];
  onEdit: (ev: OrganizationEvent) => void;
  onDeleted: (id: string) => void;
  onDuplicate: (ev: OrganizationEvent) => void;
  onAdd: (date: string) => void;
}) {
  const cols = Math.min(days.length, 4);
  return (
    <div className="org-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {days.map((day, dayIndex) => {
        const evs = filtered(byDay[day] ?? []);
        return (
          <div key={day} className="org-grid-col">
            <div className="org-grid-header">
              <span className="org-grid-day-num">{new Date(day + 'T12:00:00').getDate()}</span>
              <span className="org-grid-day-name">{formatDayName(day)}</span>
            </div>
            <div className="org-grid-events">
              {evs.length === 0 && <div className="org-grid-empty">Rien ce jour</div>}
              {evs.map(ev => (
                <GridBlock
                  key={ev.id + '-' + day}
                  event={ev}
                  currentDay={day}
                  dayIndex={dayIndex}
                  onEdit={onEdit}
                  onDeleted={onDeleted}
                  onDuplicate={onDuplicate}
                />
              ))}
              <button className="org-grid-add" onClick={() => onAdd(day)}>
                + Ajouter
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GridBlock({ event, currentDay, dayIndex, onEdit, onDeleted, onDuplicate }: {
  event: OrganizationEvent;
  currentDay: string;
  dayIndex: number;
  onEdit: (ev: OrganizationEvent) => void;
  onDeleted: (id: string) => void;
  onDuplicate: (ev: OrganizationEvent) => void;
}) {
  const cls        = TYPE_COLORS[event.event_type] ?? 'ev-autre';
  const isMultiday = event.end_date && event.end_date !== event.event_date;
  const isFirstDay = currentDay === event.event_date;
  const isLastDay  = currentDay === (event.end_date ?? event.event_date);
  const isAutoGuest = event.source_type === 'guest';

  let multidayClass = '';
  if (isMultiday) {
    if (isFirstDay && !isLastDay)       multidayClass = ' multiday-start';
    else if (!isFirstDay && isLastDay)  multidayClass = ' multiday-end';
    else if (!isFirstDay && !isLastDay) multidayClass = ' multiday-mid';
  }

  return (
    <div className={`org-event-block ${cls}${event.status === 'cancelled' ? ' cancelled' : ''}${multidayClass}`}>
      <div className="org-block-content">
        {isFirstDay && <span className="org-event-time">{fmtTime(event.start_time)}</span>}
        <span className="org-event-title-grid">
          {!isFirstDay && <span className="org-event-cont">↪ </span>}
          {event.title}
        </span>
        {isFirstDay && event.location && (
          <span className="org-event-loc">📍 {event.location}</span>
        )}
        <div className="org-block-pills">
          {isMultiday && isFirstDay && (
            <span className="org-multiday-pill">📅 {countDays(event.event_date, event.end_date!)}j</span>
          )}
          {event.logistics_section_id && isFirstDay && (
            <span className="org-multiday-pill" title="Logistique liée">📋</span>
          )}
          {isAutoGuest && isFirstDay && (
            <span className="org-auto-pill" title="Synchronisé depuis la fiche invité">auto</span>
          )}
        </div>
      </div>

      {isFirstDay && (
        <div className="org-block-actions" onClick={e => e.stopPropagation()}>
          {!isAutoGuest && (
            <>
              <button className="org-block-btn" title="Modifier" onClick={() => onEdit(event)}>✏️</button>
              <button className="org-block-btn" title="Dupliquer" onClick={() => onDuplicate(event)}>📋</button>
            </>
          )}
          {isAutoGuest && (
            <span className="org-block-hint" title="Modifiable depuis la fiche invité">👤</span>
          )}
          <button
            className="org-block-btn danger"
            title="Supprimer"
            onClick={async () => {
              const msg = isAutoGuest
                ? `Retirer "${event.title}" du planning ?\n\nIl sera recréé si l'invité a toujours une date d'arrivée.`
                : `Supprimer "${event.title}" ?`;
              if (!confirm(msg)) return;
              onDeleted(event.id);
            }}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

// ── Vue liste ────────────────────────────────────────────────

function ListView({ days, byDay, filtered, onEdit, onDeleted, onDuplicate }: {
  days: string[];
  byDay: Record<string, OrganizationEvent[]>;
  filtered: (evs: OrganizationEvent[]) => OrganizationEvent[];
  onEdit: (ev: OrganizationEvent) => void;
  onDeleted: (id: string) => void;
  onDuplicate: (ev: OrganizationEvent) => void;
}) {
  const seen = new Set<string>();
  return (
    <div className="org-list">
      {days.map(day => {
        const evs = filtered(byDay[day] ?? []).filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        if (evs.length === 0) return null;
        return (
          <div key={day} className="org-list-day">
            <div className="org-list-day-header">
              <span className="org-list-day-title">{formatFullDay(day)}</span>
              <span className="org-list-day-count">{evs.length} événement{evs.length > 1 ? 's' : ''}</span>
            </div>
            <div className="org-list-events">
              {evs.map(ev => (
                <ListRow key={ev.id} event={ev} onEdit={onEdit} onDeleted={onDeleted} onDuplicate={onDuplicate} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListRow({ event, onEdit, onDeleted, onDuplicate }: {
  event: OrganizationEvent;
  onEdit: (ev: OrganizationEvent) => void;
  onDeleted: (id: string) => void;
  onDuplicate: (ev: OrganizationEvent) => void;
}) {
  const dot         = DOT_COLORS[event.event_type] ?? '#C4A882';
  const isMultiday  = event.end_date && event.end_date !== event.event_date;
  const isAutoGuest = event.source_type === 'guest';

  return (
    <div className={`org-list-row${event.status === 'cancelled' ? ' cancelled' : ''}`}>
      <div className="org-list-dot" style={{ background: dot }} />
      <span className="org-list-time">{fmtTime(event.start_time)}</span>
      <div className="org-list-body">
        <span className="org-list-title">
          {event.title}
          {isAutoGuest && <span className="org-auto-pill" style={{ marginLeft: '6px' }}>auto</span>}
        </span>
        <div className="org-list-meta">
          {event.location && <span className="org-list-loc">📍 {event.location}</span>}
          {isMultiday && (
            <span className="org-list-multiday">📅 {countDays(event.event_date, event.end_date!)} jours</span>
          )}
        </div>
      </div>
      <span className={`org-list-badge org-tag-${event.event_type}`}>
        {EVENT_TYPE_ICONS[event.event_type]} {EVENT_TYPE_LABELS[event.event_type]}
      </span>
      <div className="org-list-actions">
        {!isAutoGuest && (
          <>
            <button onClick={() => onEdit(event)} title="Modifier">✏️</button>
            <button onClick={() => onDuplicate(event)} title="Dupliquer">📋</button>
          </>
        )}
        <button
          title="Supprimer"
          className="danger"
          onClick={async () => {
            const msg = isAutoGuest
              ? `Retirer "${event.title}" du planning ?\n\nIl sera recréé si l'invité a toujours une date d'arrivée.`
              : `Supprimer "${event.title}" ?`;
            if (!confirm(msg)) return;
            onDeleted(event.id);
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  return `${parseInt(h)}h${m === '00' ? '' : m}`;
}

function formatDayName(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' });
}

function formatFullDay(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function countDays(start: string, end: string): number {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end   + 'T12:00:00');
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}
