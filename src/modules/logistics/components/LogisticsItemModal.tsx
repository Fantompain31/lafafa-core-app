'use client';

import { useEffect, useState } from 'react';
import type { LogisticsGuest, LogisticsItem, LogisticsItemFormValues } from '../logistics.types';

interface Props {
  guests: LogisticsGuest[];
  editItem: LogisticsItem | null;
  onSave: (values: LogisticsItemFormValues) => Promise<void>;
  onClose: () => void;
}

const EMPTY: LogisticsItemFormValues = {
  label: '',
  quantity: '',
  notes: '',
  assigned_guest_id: '',
};

export default function LogisticsItemModal({ guests, editItem, onSave, onClose }: Props) {
  const [values, setValues] = useState<LogisticsItemFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editItem) {
      setValues({
        label: editItem.label,
        quantity: editItem.quantity ?? '',
        notes: editItem.notes ?? '',
        assigned_guest_id: editItem.assigned_guest_id ?? '',
      });
    } else {
      setValues(EMPTY);
    }
  }, [editItem]);

  function set<K extends keyof LogisticsItemFormValues>(key: K, value: LogisticsItemFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    setError('');
  }

  async function handleSubmit() {
    if (!values.label.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  const isEditing = !!editItem;

  return (
    <div className="lg-modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="lg-modal">
        <h2>{isEditing ? "Modifier l'élément" : 'Nouvel élément à prévoir'}</h2>

        <div className="lg-form">
          <div className="lg-field">
            <label htmlFor="lg-item-label">Nom *</label>
            <input
              id="lg-item-label"
              type="text"
              placeholder="Ex : chips, matelas 2 places, bouilloire…"
              value={values.label}
              onChange={event => set('label', event.target.value)}
            />
          </div>

          <div className="lg-field">
            <label htmlFor="lg-item-quantity">Quantité</label>
            <input
              id="lg-item-quantity"
              type="text"
              placeholder="Ex : 2 paquets, 1, pour 8 personnes…"
              value={values.quantity}
              onChange={event => set('quantity', event.target.value)}
            />
          </div>

          <div className="lg-field">
            <label htmlFor="lg-item-assigned">Attribué à</label>
            <select
              id="lg-item-assigned"
              value={values.assigned_guest_id}
              onChange={event => set('assigned_guest_id', event.target.value)}
            >
              <option value="">Non attribué</option>
              {guests.map(guest => (
                <option key={guest.id} value={guest.id}>{guest.first_name}</option>
              ))}
            </select>
          </div>

          <div className="lg-field">
            <label htmlFor="lg-item-notes">Notes</label>
            <textarea
              id="lg-item-notes"
              placeholder="Précisions utiles…"
              value={values.notes}
              onChange={event => set('notes', event.target.value)}
            />
          </div>

          {error && <div className="lg-error">{error}</div>}

          <div className="lg-form-actions">
            <button className="lg-btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
            <button className="lg-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : "Ajouter l'élément"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
