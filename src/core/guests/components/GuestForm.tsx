'use client'

import { useState } from 'react'
import { guestsService } from '@/core/guests/services/guests.service'
import { STAY_COLOR_OPTIONS } from '@/shared/constants/colors'
import type {
  FoodPreferences,
  GuestCategory,
  GuestStatus,
  GuestSummary,
} from '@/shared/types/database.types'
import { utcIsoToDateTimeLocal } from '@/shared/utils/dates'

type Props = {
  stayId: string
  guest?: GuestSummary
  linkedUserId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

const CATEGORIES: { value: GuestCategory; label: string }[] = [
  { value: 'adult', label: 'Adulte' },
  { value: 'child', label: 'Enfant' },
  { value: 'baby', label: 'Bébé' },
]

const STATUSES: { value: GuestStatus; label: string }[] = [
  { value: 'invited', label: 'Invité' },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'maybe', label: 'Peut-être' },
  { value: 'declined', label: 'Décliné' },
  { value: 'cancelled', label: 'Annulé' },
]

function readFoodPreferences(value: GuestSummary['food_preferences'] | undefined): FoodPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as FoodPreferences
}

export function GuestForm({
  stayId,
  guest,
  linkedUserId,
  onSuccess,
  onCancel,
}: Props) {
  const isEditing = Boolean(guest)
  const foodPrefs = readFoodPreferences(guest?.food_preferences)

  const [firstName, setFirstName] = useState(guest?.first_name ?? '')
  const [lastName, setLastName] = useState(guest?.last_name ?? '')
  const [category, setCategory] = useState<GuestCategory>(guest?.category ?? 'adult')
  const [status, setStatus] = useState<GuestStatus>(guest?.status ?? (linkedUserId ? 'confirmed' : 'invited'))
  const [color, setColor] = useState(guest?.color ?? STAY_COLOR_OPTIONS[0].value)
  const [arrivalAt, setArrivalAt] = useState(utcIsoToDateTimeLocal(guest?.arrival_at))
  const [departureAt, setDepartureAt] = useState(utcIsoToDateTimeLocal(guest?.departure_at))
  const [diet, setDiet] = useState(foodPrefs.diet ?? '')
  const [allergies, setAllergies] = useState(foodPrefs.allergies?.join(', ') ?? '')
  const [notes, setNotes] = useState(guest?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const foodPreferences: FoodPreferences = {
      diet: diet.trim() || undefined,
      allergies: allergies
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    }

    try {
      if (isEditing && guest) {
        await guestsService.updateGuest(guest.id, {
          firstName,
          lastName,
          category,
          status,
          color,
          arrivalAt: arrivalAt || null,
          departureAt: departureAt || null,
          foodPreferences,
          notes,
        })
      } else {
        await guestsService.addGuest(stayId, {
          firstName,
          lastName,
          category,
          status,
          color,
          arrivalAt: arrivalAt || null,
          departureAt: departureAt || null,
          foodPreferences,
          notes,
          linkedUserId: linkedUserId ?? null,
        })
      }

      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom *">
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Alice"
            className="input"
          />
        </Field>

        <Field label="Nom">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Dupont"
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Catégorie">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as GuestCategory)}
            className="input bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Statut">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GuestStatus)}
            className="input bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-600">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {STAY_COLOR_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.value)}
              title={c.label}
              className="h-7 w-7 rounded-full transition-transform hover:scale-110"
              style={{
                backgroundColor: c.value,
                outline: color === c.value ? `2px solid ${c.value}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Arrivée">
          <input
            type="datetime-local"
            value={arrivalAt}
            onChange={(e) => setArrivalAt(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Départ">
          <input
            type="datetime-local"
            value={departureAt}
            min={arrivalAt}
            onChange={(e) => setDepartureAt(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-xs font-medium text-neutral-600">Alimentation</p>

        <Field label="Régime">
          <input
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            placeholder="végétarien, vegan, halal…"
            className="input bg-white"
          />
        </Field>

        <Field label="Allergies séparées par des virgules">
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="gluten, lactose, arachides…"
            className="input bg-white"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations complémentaires…"
          className="input resize-none"
        />
      </Field>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Annuler
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-[var(--stay-primary)] py-2.5 text-sm font-medium text-[var(--stay-primary-text)] hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  )
}