'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { settingsService } from '@/core/stays/services/settings.service'
import { staysService } from '@/core/stays/services/stays.service'
import { STAY_COLOR_OPTIONS } from '@/shared/constants/colors'
import type { MemberRole, MyStay, StayEnabledFeature, StaySettings } from '@/shared/types/database.types'

type Props = {
  stay: MyStay
  settings: StaySettings | null
  features: StayEnabledFeature[]
  isOwner: boolean
  myRole: MemberRole
}

const FEATURE_LABELS: Record<string, string> = {
  'organization.transport_advanced': 'Transport avancé',
  'organization.activities_advanced': 'Activités avancées',
  'logistics.shopping_advanced': 'Liste de courses avancée',
  'logistics.inventory_detailed': 'Inventaire détaillé',
  'logistics.weather_smart': 'Météo intelligente',
  'budget.cagnotte_advanced': 'Cagnotte avancée',
  'budget.receipts': 'Justificatifs de dépenses',
  'memories.upload_photos': 'Upload de photos',
  'memories.upload_videos': 'Upload de vidéos',
}

export function SettingsPageClient({ stay, settings, features, isOwner, myRole }: Props) {
  const router = useRouter()
  const isOrganizer = myRole === 'owner' || myRole === 'co_organizer'

  const [title, setTitle] = useState(stay.title)
  const [locationName, setLocationName] = useState(stay.location_name ?? '')
  const [startDate, setStartDate] = useState(stay.start_date ?? '')
  const [endDate, setEndDate] = useState(stay.end_date ?? '')
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color ?? STAY_COLOR_OPTIONS[0].value)
  const [featureRows, setFeatureRows] = useState<StayEnabledFeature[]>(features)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  async function handleSaveStay(e: React.FormEvent) {
    e.preventDefault()
    if (!isOrganizer) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await staysService.updateStay(stay.id, { title, locationName, startDate, endDate })
      await settingsService.updateSettings(stay.id, { primaryColor })
      setSaveSuccess(true)
      router.refresh()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function toggleFeature(featureKey: string, enabled: boolean) {
    if (!isOrganizer) return
    const previous = featureRows
    setFeatureRows(rows => rows.map(row => row.feature_key === featureKey ? { ...row, is_enabled: enabled } : row))
    try {
      await settingsService.setFeatureEnabled(stay.id, featureKey, enabled)
      router.refresh()
    } catch (err) {
      setFeatureRows(previous)
      setSaveError(err instanceof Error ? err.message : "Erreur lors de la modification de l'option")
    }
  }

  async function handleArchive() {
    if (!isOwner) return
    if (!confirm('Archiver ce séjour ? Il ne sera plus visible dans la liste principale.')) return
    try {
      await staysService.archiveStay(stay.id)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur lors de l'archivage")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-neutral-900">Paramètres</h2>
        {!isOrganizer && (
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500">
            Lecture seule
          </span>
        )}
      </div>

      {/* Informations du séjour */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-medium text-neutral-700">Informations</h3>

        {saveError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
        {saveSuccess && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Enregistré.</div>}

        {/* Lecture seule pour les invités */}
        {!isOrganizer ? (
          <div className="flex flex-col gap-3">
            <ReadOnlyField label="Nom du séjour" value={stay.title} />
            <ReadOnlyField label="Lieu" value={stay.location_name ?? '—'} />
            <div className="grid grid-cols-2 gap-3">
              <ReadOnlyField label="Début" value={stay.start_date ?? '—'} />
              <ReadOnlyField label="Fin" value={stay.end_date ?? '—'} />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveStay} className="flex flex-col gap-4">
            <Field label="Nom du séjour">
              <input required value={title} onChange={e => setTitle(e.target.value)} className="input" />
            </Field>
            <Field label="Lieu">
              <input value={locationName} onChange={e => setLocationName(e.target.value)} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
              </Field>
              <Field label="Fin">
                <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="input" />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600">Couleur du séjour</label>
              <div className="flex flex-wrap gap-2">
                {STAY_COLOR_OPTIONS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPrimaryColor(c.value)}
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value, outline: primaryColor === c.value ? `2px solid ${c.value}` : 'none', outlineOffset: '2px' }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--stay-primary)] py-2.5 text-sm font-medium text-[var(--stay-primary-text)] hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>

      {/* Options activées */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-700">Options activées</h3>
        {featureRows.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucune option avancée activée pour le moment.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {featureRows.map(f => (
              <div key={f.feature_key} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-neutral-700">{FEATURE_LABELS[f.feature_key] ?? f.feature_key}</span>
                {isOrganizer ? (
                  <button
                    type="button"
                    onClick={() => toggleFeature(f.feature_key, !f.is_enabled)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${f.is_enabled ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}
                  >
                    {f.is_enabled ? 'Actif' : 'Inactif'}
                  </button>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${f.is_enabled ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {f.is_enabled ? 'Actif' : 'Inactif'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone sensible — owner uniquement */}
      {isOwner && (
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-medium text-red-700">Zone sensible</h3>
          <p className="mb-4 text-xs text-neutral-500">Ces actions sont réservées au propriétaire du séjour.</p>
          <button
            type="button"
            onClick={() => void handleArchive()}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Archiver le séjour
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-800">{value}</span>
    </div>
  )
}
