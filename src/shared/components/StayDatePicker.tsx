'use client'
// src/shared/components/StayDatePicker.tsx
//
// Calendrier custom réutilisable.
// - Les jours du séjour sont mis en surbrillance.
// - Les jours hors séjour restent sélectionnables.
// - Avertissement non bloquant si date hors séjour sélectionnée.
// - Zéro dépendance externe.
// - Compatible Next.js 14 client component.
//
// ⚠️  Ce composant gère uniquement les DATES (YYYY-MM-DD).
//     Pour les formulaires qui combinent date + heure (datetime-local),
//     utiliser StayDatePicker pour la date et un <input type="time"> séparé.

import { useState, useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import './StayDatePicker.css'

export type StayDatePickerProps = {
  label?: string
  value: string | null           // "YYYY-MM-DD" ou null
  onChange: (value: string | null) => void
  stayStartDate: string | null   // "YYYY-MM-DD"
  stayEndDate: string | null     // "YYYY-MM-DD"
  required?: boolean
  disabled?: boolean
  allowClear?: boolean
  helperText?: string
  error?: string
  placeholder?: string
}

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di']

export function StayDatePicker({
  label,
  value,
  onChange,
  stayStartDate,
  stayEndDate,
  required = false,
  disabled = false,
  allowClear = true,
  helperText,
  error,
  placeholder = 'Choisir une date',
}: StayDatePickerProps) {
  const [open, setOpen]         = useState(false)
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value) return new Date(value + 'T12:00:00').getFullYear()
    if (stayStartDate) return new Date(stayStartDate + 'T12:00:00').getFullYear()
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value) return new Date(value + 'T12:00:00').getMonth()
    if (stayStartDate) return new Date(stayStartDate + 'T12:00:00').getMonth()
    return new Date().getMonth()
  })
  const ref = useRef<HTMLDivElement>(null)

  // Fermer si clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Mettre à jour la vue si value change de l'extérieur
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  function handleClear(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    onChange(null)
  }

  // Calcul des jours à afficher
  const days = buildCalendarDays(viewYear, viewMonth)

  // Helpers de comparaison
  const isSelected     = (iso: string) => iso === value
  const isInStay       = (iso: string) => {
    if (!stayStartDate || !stayEndDate) return false
    return iso >= stayStartDate && iso <= stayEndDate
  }
  const isStayStart    = (iso: string) => iso === stayStartDate
  const isStayEnd      = (iso: string) => iso === stayEndDate
  const isToday        = (iso: string) => iso === todayIso()
  const isOtherMonth   = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return d.getMonth() !== viewMonth
  }

  // Avertissement hors séjour
  const isOutOfRange = value && stayStartDate && stayEndDate
    && (value < stayStartDate || value > stayEndDate)

  // Label affiché dans le trigger
  const displayValue = value ? formatDateFr(value) : null

  // Info période séjour
  const stayPeriodLabel = stayStartDate && stayEndDate
    ? `Séjour du ${formatDateFr(stayStartDate)} au ${formatDateFr(stayEndDate)}`
    : null

  return (
    <div className="sdp-root" ref={ref}>
      {label && (
        <label className={`sdp-label${required ? ' required' : ''}`}>
          {label}
        </label>
      )}

      {/* Trigger */}
      <div
        className={`sdp-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}${error ? ' has-error' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        role="button"
        aria-haspopup="true"
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
      >
        <span className={`sdp-trigger-value${!displayValue ? ' placeholder' : ''}`}>
          📅 {displayValue ?? placeholder}
        </span>
        <div className="sdp-trigger-actions">
          {allowClear && value && !disabled && (
            <button className="sdp-clear-btn" onClick={handleClear} type="button" aria-label="Effacer">
              ✕
            </button>
          )}
          <span className={`sdp-chevron${open ? ' up' : ''}`}>▾</span>
        </div>
      </div>

      {/* Popover calendrier */}
      {open && (
        <div className="sdp-popover">
          {/* Info séjour */}
          {stayPeriodLabel && (
            <div className="sdp-stay-info">
              <span className="sdp-stay-dot" />
              {stayPeriodLabel}
            </div>
          )}

          {/* Navigation mois */}
          <div className="sdp-nav">
            <button type="button" className="sdp-nav-btn" onClick={prevMonth} aria-label="Mois précédent">‹</button>
            <span className="sdp-nav-label">
              {MONTHS_FR[viewMonth]} {viewYear}
            </span>
            <button type="button" className="sdp-nav-btn" onClick={nextMonth} aria-label="Mois suivant">›</button>
          </div>

          {/* Grille */}
          <div className="sdp-grid">
            {/* En-têtes jours */}
            {DAYS_FR.map(d => (
              <div key={d} className="sdp-day-header">{d}</div>
            ))}

            {/* Jours */}
            {days.map(iso => {
              const cls = [
                'sdp-day',
                isOtherMonth(iso)  ? 'other-month' : '',
                isInStay(iso)      ? 'in-stay'      : '',
                isStayStart(iso)   ? 'stay-start'   : '',
                isStayEnd(iso)     ? 'stay-end'      : '',
                isSelected(iso)    ? 'selected'      : '',
                isToday(iso)       ? 'today'         : '',
              ].filter(Boolean).join(' ')

              return (
                <button
                  key={iso}
                  type="button"
                  className={cls}
                  onClick={() => handleDayClick(iso)}
                  aria-label={formatDateFr(iso)}
                  aria-pressed={isSelected(iso)}
                >
                  {new Date(iso + 'T12:00:00').getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Avertissement hors séjour */}
      {isOutOfRange && (
        <div className="sdp-warning">
          ⚠️ Cette date est en dehors des dates prévues du séjour.
        </div>
      )}

      {/* Texte d'aide */}
      {helperText && !error && !isOutOfRange && (
        <span className="sdp-helper">{helperText}</span>
      )}

      {/* Erreur */}
      {error && <span className="sdp-error">{error}</span>}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toLocaleDateString('fr-CA')
}

function formatDateFr(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Génère les 42 cases du calendrier (6 semaines × 7 jours, lundi en premier)
function buildCalendarDays(year: number, month: number): string[] {
  const firstDay = new Date(year, month, 1)
  // getDay() : 0=dim, 1=lun…6=sam → on veut lundi=0
  const startDow = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startDow)
  const days: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.toLocaleDateString('fr-CA'))
  }
  return days
}
