'use client';

import { useEffect, useState } from 'react';
import type { LogisticsSection, LogisticsSectionFormValues, LogisticsSectionType } from '../logistics.types';
import { LOGISTICS_SECTION_LABELS, MANUAL_SECTION_TYPES } from '../logistics.types';

interface Props {
  editSection: LogisticsSection | null;
  onSave: (values: LogisticsSectionFormValues) => Promise<void>;
  onClose: () => void;
}

const EMPTY: LogisticsSectionFormValues = {
  title: '',
  section_type: 'autre',
  notes: '',
};

export default function LogisticsSectionModal({ editSection, onSave, onClose }: Props) {
  const [values, setValues] = useState<LogisticsSectionFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editSection) {
      setValues({
        title: editSection.title,
        section_type: editSection.section_type,
        notes: editSection.notes ?? '',
      });
    } else {
      setValues(EMPTY);
    }
  }, [editSection]);

  function set<K extends keyof LogisticsSectionFormValues>(key: K, value: LogisticsSectionFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    setError('');
  }

  async function handleSubmit() {
    if (!values.title.trim()) {
      setError('Le titre est obligatoire.');
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

  const isEditing = !!editSection;

  return (
    <div className="lg-modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="lg-modal">
        <h2>{isEditing ? 'Modifier la section' : 'Nouvelle section logistique'}</h2>

        <div className="lg-form">
          <div className="lg-field">
            <label htmlFor="lg-section-title">Titre *</label>
            <input
              id="lg-section-title"
              type="text"
              placeholder="Ex : Apéro terrasse, Couchage, Matériel cuisine…"
              value={values.title}
              onChange={event => set('title', event.target.value)}
            />
          </div>

          <div className="lg-field">
            <label htmlFor="lg-section-type">Type</label>
            <select
              id="lg-section-type"
              value={values.section_type}
              onChange={event => set('section_type', event.target.value as LogisticsSectionType)}
            >
              {MANUAL_SECTION_TYPES.map(type => (
                <option key={type} value={type}>{LOGISTICS_SECTION_LABELS[type]}</option>
              ))}
            </select>
          </div>

          <div className="lg-field">
            <label htmlFor="lg-section-notes">Notes</label>
            <textarea
              id="lg-section-notes"
              placeholder="Informations utiles pour cette logistique…"
              value={values.notes}
              onChange={event => set('notes', event.target.value)}
            />
          </div>

          {error && <div className="lg-error">{error}</div>}

          <div className="lg-form-actions">
            <button className="lg-btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
            <button className="lg-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Créer la section'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
