'use client'
// src/modules/templates/TemplatesPicker.tsx
//
// Composant client : liste les templates disponibles,
// affiche un aperçu, demande confirmation avant d'appliquer.
// À intégrer dans la page Logistique ou dans un onglet dédié.

import { useState, useEffect } from 'react'
import { templatesService } from './templates.service'
import type {
  StayTemplate,
  StayTemplateWithSections,
  ApplyTemplateResult,
} from './templates.types'
import { TEMPLATE_CATEGORIES } from './templates.types'
import './templates.css'

interface Props {
  stayId: string
  onApplied?: (result: ApplyTemplateResult) => void
  onClose?: () => void
}

export default function TemplatesPicker({ stayId, onApplied, onClose }: Props) {
  const [templates,  setTemplates]  = useState<StayTemplate[]>([])
  const [selected,   setSelected]   = useState<StayTemplateWithSections | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [applying,   setApplying]   = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState<ApplyTemplateResult | null>(null)

  useEffect(() => {
    templatesService.getTemplates()
      .then(setTemplates)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSelectTemplate(template: StayTemplate) {
    setLoadingPreview(true)
    setError('')
    try {
      const full = await templatesService.getTemplateWithSections(template.id)
      setSelected(full)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleApply() {
    if (!selected) return
    setApplying(true)
    setError('')
    try {
      const result = await templatesService.applyTemplate(stayId, selected.id)
      setSuccess(result)
      onApplied?.(result)
    } catch (e: any) {
      setError(
        e.message === 'unauthorized'
          ? 'Seuls les organisateurs peuvent appliquer un modèle.'
          : e.message
      )
    } finally {
      setApplying(false)
    }
  }

  // ── Écran succès ─────────────────────────────────────────
  if (success) {
    return (
      <div className="tpl-success">
        <div className="tpl-success-icon">✅</div>
        <h3>Modèle appliqué !</h3>
        <p>
          <strong>{success.sections_created}</strong> section{success.sections_created > 1 ? 's' : ''} et{' '}
          <strong>{success.items_created}</strong> élément{success.items_created > 1 ? 's' : ''} ont été ajoutés à votre logistique.
        </p>
        <p className="tpl-success-sub">Rien n'a été supprimé. Vous pouvez modifier ou supprimer ces éléments à tout moment.</p>
        <button className="tpl-btn-primary" onClick={onClose}>Fermer</button>
      </div>
    )
  }

  // ── Aperçu du template sélectionné ───────────────────────
  if (selected) {
    return (
      <div className="tpl-preview">
        <div className="tpl-preview-header">
          <button className="tpl-back-btn" onClick={() => setSelected(null)}>← Retour</button>
          <h2>{selected.icon} {selected.name}</h2>
        </div>

        {selected.description && (
          <p className="tpl-preview-desc">{selected.description}</p>
        )}

        <div className="tpl-notice">
          📦 Ce modèle va ajouter des sections et éléments à votre logistique. <strong>Rien ne sera supprimé.</strong>
        </div>

        <div className="tpl-preview-sections">
          <h3>Ce qui sera ajouté :</h3>
          {selected.sections.map(section => (
            <div key={section.id} className="tpl-preview-section">
              <div className="tpl-preview-section-header">
                <span className="tpl-preview-section-title">{section.title}</span>
                <span className="tpl-preview-section-count">{section.items.length} élément{section.items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="tpl-preview-items">
                {section.items.map(item => (
                  <span key={item.id} className="tpl-preview-item">
                    {item.quantity > 1 && <span className="tpl-preview-qty">{item.quantity}×</span>}
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selected.checklist.length > 0 && (
          <div className="tpl-preview-checklist">
            <h3>Checklist personnelle suggérée :</h3>
            <div className="tpl-preview-items">
              {selected.checklist.map(item => (
                <span key={item.id} className="tpl-preview-item">☐ {item.title}</span>
              ))}
            </div>
          </div>
        )}

        {error && <div className="tpl-error">{error}</div>}

        <div className="tpl-preview-actions">
          <button className="tpl-btn-ghost" onClick={() => setSelected(null)} disabled={applying}>
            Annuler
          </button>
          <button className="tpl-btn-primary" onClick={handleApply} disabled={applying}>
            {applying ? 'Application…' : 'Appliquer le modèle'}
          </button>
        </div>
      </div>
    )
  }

  // ── Liste des templates ───────────────────────────────────
  return (
    <div className="tpl-root">
      <div className="tpl-header">
        <h2>Choisir un modèle de séjour</h2>
        <p className="tpl-subtitle">
          Un modèle ajoute des sections et éléments logistiques de base. Vous pourrez tout personnaliser ensuite.
        </p>
      </div>

      {loading && <div className="tpl-loader">Chargement des modèles…</div>}
      {error   && <div className="tpl-error">{error}</div>}

      {!loading && (
        <div className="tpl-grid">
          {templates.map(template => (
            <button
              key={template.id}
              className="tpl-card"
              onClick={() => handleSelectTemplate(template)}
              disabled={loadingPreview}
            >
              <span className="tpl-card-icon">{template.icon ?? '📋'}</span>
              <div className="tpl-card-body">
                <span className="tpl-card-name">{template.name}</span>
                {template.category && (
                  <span className="tpl-card-category">
                    {TEMPLATE_CATEGORIES[template.category] ?? template.category}
                  </span>
                )}
                {template.description && (
                  <span className="tpl-card-desc">{template.description}</span>
                )}
              </div>
              <span className="tpl-card-arrow">→</span>
            </button>
          ))}
        </div>
      )}

      {onClose && (
        <button className="tpl-btn-ghost tpl-close-btn" onClick={onClose}>
          Fermer
        </button>
      )}
    </div>
  )
}
