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
// ⚠️ Ce composant gère uniquement les DATES (YYYY-MM-DD).
// Pour les formulaires qui combinent date + heure (datetime-local),
// utiliser StayDatePicker pour la date et un <input type="time"> séparé.

import { useState, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import './StayDatePicker.css'

export type StayDatePickerProps = {
  label?: string
  value: string | null
  onChange: (value: string | null) => void
  stayStartDate: string | null
  stayEndDate: string | null
  required?: boolean
  disabled?: boolean
  allowClear?: boolean
  helperText?: string
  error?: string
  placeholder?: string
}

const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

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
  const [open, setOpen] = useState(false)

  const [viewYear, setViewYear] = useState<number>(() => {
    if (value) return new Date(`${value}T12:00:00`).getFullYear()
    if (stayStartDate) return new Date(`${stayStartDate}T12:00:00`).getFullYear()
    return new Date().getFullYear()
  })

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value) return new Date(`${value}T12:00:00`).getMonth()
    if (stayStartDate) return new Date(`${stayStartDate}T12:00:00`).getMonth()
    return new Date().getMonth()
  })

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (!value) return

    const date = new Date(`${value}T12:00:00`)
    setViewYear(date.getFullYear())
    setViewMonth(date.getMonth())
  }, [value])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((year) => year - 1)
      return
    }

    setViewMonth((month) => month - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((year) => year + 1)
      return
    }

    setViewMonth((month) => month + 1)
  }

  function handleDayClick(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  function handleClear(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onChange(null)
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (disabled) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((current) => !current)
    }

    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const days = buildCalendarDays(viewYear, viewMonth)

  const isSelected = (iso: string) => iso === value

  const isInStay = (iso: string) => {
    if (!stayStartDate || !stayEndDate) return false
    return iso >= stayStartDate && iso <= stayEndDate
  }

  const isStayStart = (iso: string) => iso === stayStartDate
  const isStayEnd = (iso: string) => iso === stayEndDate
  const isToday = (iso: string) => iso === todayIso()

  const isOtherMonth = (iso: string) => {
    const date = new Date(`${iso}T12:00:00`)
    return date.getMonth() !== viewMonth
  }

  const isOutOfRange =
    Boolean(value && stayStartDate && stayEndDate) &&
    Boolean(value && stayStartDate && value < stayStartDate) ||
    Boolean(value && stayStartDate && stayEndDate && value > stayEndDate)

  const displayValue = value ? formatDateFr(value) : null

  const stayPeriodLabel =
    stayStartDate && stayEndDate
      ? `Séjour du ${formatDateFr(stayStartDate)} au ${formatDateFr(stayEndDate)}`
      : null

  return (
    <div className="sdp-root" ref={ref}>
      {label && (
        <label className={`sdp-label${required ? ' required' : ''}`}>
          {label}
        </label>
      )}

      <div
        className={`sdp-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}${error ? ' has-error' : ''}`}
        onClick={() => {
          if (!disabled) setOpen((current) => !current)
        }}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`sdp-trigger-value${!displayValue ? ' placeholder' : ''}`}>
          📅 {displayValue ?? placeholder}
        </span>

        <div className="sdp-trigger-actions">
          {allowClear && value && !disabled && (
            <button
              className="sdp-clear-btn"
              onClick={handleClear}
              type="button"
              aria-label="Effacer la date"
            >
              ✕
            </button>
          )}

          <span className={`sdp-chevron${open ? ' up' : ''}`}>▾</span>
        </div>
      </div>

      {open && (
        <div className="sdp-popover">
          {stayPeriodLabel && (
            <div className="sdp-stay-info">
              <span className="sdp-stay-dot" />
              {stayPeriodLabel}
            </div>
          )}

          <div className="sdp-nav">
            <button
              type="button"
              className="sdp-nav-btn"
              onClick={prevMonth}
              aria-label="Mois précédent"
            >
              ‹
            </button>

            <span className="sdp-nav-label">
              {MONTHS_FR[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              className="sdp-nav-btn"
              onClick={nextMonth}
              aria-label="Mois suivant"
            >
              ›
            </button>
          </div>

          <div className="sdp-grid">
            {DAYS_FR.map((day) => (
              <div key={day} className="sdp-day-header">
                {day}
              </div>
            ))}

            {days.map((iso) => {
              const className = [
                'sdp-day',
                isOtherMonth(iso) ? 'other-month' : '',
                isInStay(iso) ? 'in-stay' : '',
                isStayStart(iso) ? 'stay-start' : '',
                isStayEnd(iso) ? 'stay-end' : '',
                isSelected(iso) ? 'selected' : '',
                isToday(iso) ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <button
                  key={iso}
                  type="button"
                  className={className}
                  onClick={() => handleDayClick(iso)}
                  aria-label={formatDateFr(iso)}
                  aria-pressed={isSelected(iso)}
                >
                  {new Date(`${iso}T12:00:00`).getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isOutOfRange && (
        <div className="sdp-warning">
          ⚠️ Cette date est en dehors des dates prévues du séjour.
        </div>
      )}

      {helperText && !error && !isOutOfRange && (
        <span className="sdp-helper">{helperText}</span>
      )}

      {error && <span className="sdp-error">{error}</span>}
    </div>
  )
}

function todayIso(): string {
  return new Date().toLocaleDateString('fr-CA')
}

function formatDateFr(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildCalendarDays(year: number, month: number): string[] {
  const firstDay = new Date(year, month, 1)
  const startDow = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startDow)

  const days: string[] = []

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    days.push(date.toLocaleDateString('fr-CA'))
  }

  return days
}