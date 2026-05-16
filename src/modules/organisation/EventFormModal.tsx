'use client';
// src/modules/organisation/components/EventFormModal.tsx

import { useState, useEffect } from 'react';
import type { OrganizationEvent, EventFormValues, EventType, EventStatus } from './organisation.types';
import { EVENT_TYPE_LABELS } from './organisation.types';

interface Props {
  stayId:       string;
  editEvent?:   OrganizationEvent | null;
  prefillDate?: string;
  onSave:       (values: EventFormValues) => Promise<void>;
  onClose:      () => void;
}

const EMPTY: EventFormValues = {
  title:            '',
  event_type:       'repas',
  event_date:       '',
  end_date:         '',
  start_time:       '',
  end_time:         '',
  location:         '',
  description:      '',
  status:           'confirmed',
  create_logistics: false,
};

export default function EventFormModal({ stayId, editEvent, prefillDate, onSave, onClose }: Props) {
  const [values, setValues] = useState<EventFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (editEvent) {
      setValues({
        title:            editEvent.title,
        event_type:       editEvent.event_type,
        event_date:       editEvent.event_date,
        end_date:         editEvent.end_date ?? '',
        start_time:       editEvent.start_time.slice(0, 5),
        end_time:         editEvent.end_time?.slice(0, 5) ?? '',
        location:         editEvent.location ?? '',
        description:      editEvent.description ?? '',
        status:           editEvent.status,
        create_logistics: false,
      });
    } else {
      setValues({ ...EMPTY, event_date: prefillDate ?? '', end_date: '' });
    }
  }, [editEvent, prefillDate]);

  function set<K extends keyof EventFormValues>(key: K, val: EventFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: val }));
    setError('');
  }

  async function handleSubmit() {
    if (!values.title.trim()) return setError('Le titre est obligatoire.');
    if (!values.event_date)   return setError('La date est obligatoire.');
    if (!values.start_time)   return setError("L'heure de début est obligatoire.");
    setSaving(true);
    setError('');
    try {
      await onSave(values);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  const isEditing = !!editEvent;

  return (
    <div className="org-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="org-modal">
        <h2>{isEditing ? "Modifier l'événement" : 'Nouvel événement'}</h2>

        <div className="org-form">
          <div className="org-field">
            <label htmlFor="evt-title">Titre *</label>
            <input
              id="evt-title"
              type="text"
              placeholder="Ex : Repas du midi, Apéro terrasse…"
              value={values.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          <div className="org-field">
            <label htmlFor="evt-type">Type *</label>
            <select
              id="evt-type"
              value={values.event_type}
              onChange={e => set('event_type', e.target.value as EventType)}
            >
              {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="org-field">
            <label htmlFor="evt-date">Date *</label>
            <input
              id="evt-date"
              type="date"
              value={values.event_date}
              onChange={e => set('event_date', e.target.value)}
            />
          </div>

          <div className="org-field-row">
            <div className="org-field">
              <label htmlFor="evt-start">Heure de début *</label>
              <input
                id="evt-start"
                type="time"
                value={values.start_time}
                onChange={e => set('start_time', e.target.value)}
              />
            </div>
            <div className="org-field">
              <label htmlFor="evt-end">Heure de fin</label>
              <input
                id="evt-end"
                type="time"
                value={values.end_time}
                onChange={e => set('end_time', e.target.value)}
              />
            </div>
          </div>

          <div className="org-field">
            <label htmlFor="evt-location">Lieu</label>
            <input
              id="evt-location"
              type="text"
              placeholder="Ex : Terrasse, Salle à manger…"
              value={values.location}
              onChange={e => set('location', e.target.value)}
            />
          </div>

          <div className="org-field">
            <label htmlFor="evt-desc">Note</label>
            <textarea
              id="evt-desc"
              placeholder="Informations supplémentaires…"
              value={values.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="org-field">
            <label htmlFor="evt-status">Statut</label>
            <select
              id="evt-status"
              value={values.status}
              onChange={e => set('status', e.target.value as EventStatus)}
            >
              <option value="confirmed">Confirmé</option>
              <option value="draft">Brouillon</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>

          {!isEditing && (
            <label className="org-logistics-check">
              <input
                type="checkbox"
                checked={values.create_logistics}
                onChange={e => set('create_logistics', e.target.checked)}
              />
              📋 Créer une section logistique liée
            </label>
          )}

          {error && <div className="org-error">{error}</div>}

          <div className="org-form-actions">
            <button className="org-btn-ghost" onClick={onClose} disabled={saving}>
              Annuler
            </button>
            <button className="org-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : "Créer l'événement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
