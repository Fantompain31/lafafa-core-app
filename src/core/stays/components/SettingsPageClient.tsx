'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { settingsService } from '@/core/stays/services/settings.service'
import { staysService } from '@/core/stays/services/stays.service'
import { STAY_COLOR_OPTIONS } from '@/shared/constants/colors'
import type {
  MemberRole,
  MyStay,
  StayEnabledFeature,
  StaySettings,
} from '@/shared/types/database.types'

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

export function SettingsPageClient({
  stay,
  settings,
  features,
  isOwner,
  myRole,
}: Props) {
  const router = useRouter()

  const isOrganizer = myRole === 'owner' || myRole === 'co_organizer'
  const canManageDangerZone = myRole === 'owner' || isOwner

  const [title, setTitle] = useState(stay.title)
  const [locationName, setLocationName] = useState(stay.location_name ?? '')
  const [startDate, setStartDate] = useState(stay.start_date ?? '')
  const [endDate, setEndDate] = useState(stay.end_date ?? '')
  const [primaryColor, setPrimaryColor] = useState(
    settings?.primary_color ?? STAY_COLOR_OPTIONS[0].value
  )
  const [featureRows, setFeatureRows] = useState<StayEnabledFeature[]>(features)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function handleSaveStay(e: React.FormEvent) {
    e.preventDefault()

    if (!isOrganizer) return

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      await staysService.updateStay(stay.id, {
        title,
        locationName,
        startDate,
        endDate,
      })

      await settingsService.updateSettings(stay.id, {
        primaryColor,
      })

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

    setFeatureRows((rows) =>
      rows.map((row) =>
        row.feature_key === featureKey
          ? { ...row, is_enabled: enabled }
          : row
      )
    )

    try {
      await settingsService.setFeatureEnabled(stay.id, featureKey, enabled)
      router.refresh()
    } catch (err) {
      setFeatureRows(previous)
      setSaveError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la modification de l'option"
      )
    }
  }

  async function handleArchive() {
    if (!canManageDangerZone) return

    const confirmed = confirm(
      'Archiver ce séjour ? Il ne sera plus visible dans la liste principale, mais les données ne seront pas supprimées.'
    )

    if (!confirmed) return

    try {
      await staysService.archiveStay(stay.id)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Erreur lors de l'archivage"
      )
    }
  }

  async function handleDeleteStay() {
    if (!canManageDangerZone) return

    const firstConfirm = confirm(
      'Supprimer définitivement ce séjour ? Cette action supprimera les invités, l’organisation, la logistique et toutes les données liées.'
    )

    if (!firstConfirm) return

    const secondConfirm = confirm(
      `Confirmez la suppression définitive du séjour "${stay.title}". Cette action est irréversible.`
    )

    if (!secondConfirm) return

    try {
      await staysService.deleteStay(stay.id)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Erreur lors de la suppression'
      )
    }
  }


  async function handleLeaveStay() {
    if (myRole === 'owner') return

    const confirmed = confirm(
      'Quitter ce séjour ? Vous ne le verrez plus dans votre tableau de bord. Vos attributions seront libérées, mais les éléments du séjour seront conservés.'
    )

    if (!confirmed) return

    setLeaving(true)
    setSaveError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('leave_stay', {
        p_stay_id: stay.id,
      })

      if (error) throw new Error(error.message)

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Erreur lors de la sortie du séjour'
      )
    } finally {
      setLeaving(false)
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

      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-medium text-neutral-700">Informations</h3>

        {saveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Enregistré.
          </div>
        )}

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
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Lieu">
              <input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Début">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </Field>

              <Field label="Fin">
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600">
                Couleur du séjour
              </label>

              <div className="flex flex-wrap gap-2">
                {STAY_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPrimaryColor(c.value)}
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      outline:
                        primaryColor === c.value
                          ? `2px solid ${c.value}`
                          : 'none',
                      outlineOffset: '2px',
                    }}
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

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-700">
          Options activées
        </h3>

        {featureRows.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Tous les modules sont activés par défaut.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {featureRows.map((f) => (
              <div
                key={f.feature_key}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-sm text-neutral-700">
                  {FEATURE_LABELS[f.feature_key] ?? f.feature_key}
                </span>

                {isOrganizer ? (
                  <button
                    type="button"
                    onClick={() => toggleFeature(f.feature_key, !f.is_enabled)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      f.is_enabled
                        ? 'bg-green-50 text-green-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {f.is_enabled ? 'Actif' : 'Inactif'}
                  </button>
                ) : (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      f.is_enabled
                        ? 'bg-green-50 text-green-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {f.is_enabled ? 'Actif' : 'Inactif'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>


      {myRole !== 'owner' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-medium text-neutral-700">
            Mon accès au séjour
          </h3>

          <p className="mb-4 text-xs leading-relaxed text-neutral-500">
            Vous pouvez quitter ce séjour à tout moment. Le séjour disparaîtra de votre tableau de bord.
            Les objets, couchages ou tâches qui vous étaient attribués repasseront en non attribué.
          </p>

          <button
            type="button"
            onClick={() => void handleLeaveStay()}
            disabled={leaving}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {leaving ? 'Sortie en cours…' : 'Quitter le séjour'}
          </button>
        </div>
      )}

      {canManageDangerZone && (
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-medium text-red-700">
            Zone sensible
          </h3>

          <p className="mb-4 text-xs text-neutral-500">
            Ces actions sont réservées au propriétaire du séjour. L’archivage
            masque le séjour, la suppression définitive efface toutes les
            données liées.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleArchive()}
              className="rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
            >
              Archiver le séjour
            </button>

            <button
              type="button"
              onClick={() => void handleDeleteStay()}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Supprimer définitivement
            </button>
          </div>
        </div>
      )}
    </div>
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

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-800">{value}</span>
    </div>
  )
}