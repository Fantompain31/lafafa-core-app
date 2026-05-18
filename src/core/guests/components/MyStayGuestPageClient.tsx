'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GuestForm } from '@/core/guests/components/GuestForm'
import {
  getGuestResponsibilities,
  type GuestResponsibilities,
} from '@/core/guests/services/guest-responsibilities.service'
import type { GuestSummary } from '@/shared/types/database.types'
import '@/core/stays/components/StayHome.css'

type Props = {
  stayId: string
  userId: string
  guest: GuestSummary | null
  stayStartDate?: string | null
  stayEndDate?: string | null
}

type SectionKey = 'identity' | 'presence' | 'food' | 'responsibilities' | 'edit'

type ResponsibilityRow = {
  id: string
  type: string
  title: string
  subtitle?: string | null
  status?: string | null
  is_done?: boolean
  group: string
  icon: string
}

export default function MyStayGuestPageClient({
  stayId,
  userId,
  guest,
  stayStartDate = null,
  stayEndDate = null,
}: Props) {
  const router = useRouter()
  const [success, setSuccess] = useState(false)
  const [openSection, setOpenSection] = useState<SectionKey | null>(null)
  const [responsibilities, setResponsibilities] = useState<GuestResponsibilities | null>(null)
  const [responsibilitiesLoading, setResponsibilitiesLoading] = useState(false)
  const [responsibilitiesError, setResponsibilitiesError] = useState<string | null>(null)

  const responsibilityRows = useMemo<ResponsibilityRow[]>(() => {
    if (!responsibilities) return []
    return [
      ...responsibilities.logistics.map((item) => ({ ...item, group: 'Logistique', icon: '🧺' })),
      ...responsibilities.accommodation.map((item) => ({ ...item, group: 'Couchage', icon: '🛏️' })),
      ...responsibilities.planning.map((item) => ({ ...item, group: 'Planning', icon: '🗓️' })),
    ]
  }, [responsibilities])

  useEffect(() => {
    if (!guest?.id) {
      setResponsibilities(null)
      setResponsibilitiesError(null)
      setResponsibilitiesLoading(false)
      return
    }

    let cancelled = false

    async function loadResponsibilities() {
      setResponsibilitiesLoading(true)
      setResponsibilitiesError(null)
      try {
        const data = await getGuestResponsibilities(stayId, guest!.id)
        if (!cancelled) setResponsibilities(data)
      } catch (error) {
        if (!cancelled) {
          setResponsibilities(null)
          setResponsibilitiesError(error instanceof Error ? error.message : 'Impossible de charger vos éléments.')
        }
      } finally {
        if (!cancelled) setResponsibilitiesLoading(false)
      }
    }

    void loadResponsibilities()

    return () => {
      cancelled = true
    }
  }, [stayId, guest?.id])

  function handleSuccess() {
    setSuccess(true)
    setOpenSection(null)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  async function handleToggleResponsibilityItem(itemId: string, nextChecked: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('logistics_items')
      .update({
        is_checked: nextChecked,
        checked_at: nextChecked ? new Date().toISOString() : null,
      })
      .eq('id', itemId)

    if (error) {
      setResponsibilitiesError(error.message)
      return
    }

    setResponsibilities((current) => {
      if (!current) return current
      return {
        ...current,
        logistics: current.logistics.map((item) =>
          item.id === itemId
            ? {
                ...item,
                is_done: nextChecked,
                status: nextChecked ? 'Terminé' : item.assigned_guest_id ? 'Je m’en occupe' : 'À prévoir',
              }
            : item,
        ),
      }
    })
  }

  if (!guest) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--stay-primary)]">
              Ma fiche
            </p>
            <h2 className="text-base font-semibold text-neutral-900">Créer ma fiche dans ce séjour</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Créez votre fiche pour que votre présence, vos repas et vos éléments à apporter soient bien pris en compte.
            </p>
          </div>

          {success && <SuccessMessage />}

          <GuestForm
            stayId={stayId}
            stayStartDate={stayStartDate}
            stayEndDate={stayEndDate}
            linkedUserId={userId}
            onSuccess={handleSuccess}
            onCancel={() => router.push(`/stays/${stayId}`)}
          />
        </div>
      </div>
    )
  }

  const foodLines = readFoodPreferenceLines(guest)
  const fullName = `${guest.first_name}${guest.last_name ? ` ${guest.last_name}` : ''}`
  const categoryLabel = guest.category === 'adult' ? 'Adulte' : guest.category === 'child' ? 'Enfant' : 'Bébé'

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--stay-primary)]">Ma fiche</p>
            <h2 className="text-lg font-semibold text-neutral-900">{fullName}</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Retrouvez vos informations par section. Appuyez sur une section pour voir ou modifier le détail.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenSection('edit')}
            className="sh-btn-outline"
          >
            Modifier
          </button>
        </div>

        {success && <SuccessMessage />}

        <div className="grid gap-3 sm:grid-cols-2">
          <SectionCard
            eyebrow="Informations"
            title="Identité"
            value={`${categoryLabel} · ${guest.status === 'confirmed' ? 'Confirmé' : guest.status}`}
            onClick={() => setOpenSection('identity')}
          />
          <SectionCard
            eyebrow="Présence"
            title="Arrivée / départ"
            value={formatPresencePreview(guest)}
            onClick={() => setOpenSection('presence')}
          />
          <SectionCard
            eyebrow="Alimentation"
            title="Régime et allergies"
            value={foodLines.length > 0 ? foodLines.slice(0, 2).join(' · ') : 'Rien à signaler'}
            onClick={() => setOpenSection('food')}
          />
          <SectionCard
            eyebrow="À faire / à apporter"
            title="Votre récapitulatif"
            value={responsibilitiesLoading ? 'Chargement…' : `${responsibilityRows.length} élément${responsibilityRows.length > 1 ? 's' : ''}`}
            onClick={() => setOpenSection('responsibilities')}
          />
        </div>
      </div>

      {openSection === 'identity' && (
        <DetailModal title="Identité" eyebrow="Ma fiche" onClose={() => setOpenSection(null)}>
          <DetailRow label="Prénom" value={guest.first_name} />
          {guest.last_name && <DetailRow label="Nom" value={guest.last_name} />}
          <DetailRow label="Catégorie" value={categoryLabel} />
          <DetailRow label="Statut" value={guest.status === 'confirmed' ? 'Confirmé' : guest.status} />
          {guest.notes && <DetailRow label="Notes" value={guest.notes} />}
        </DetailModal>
      )}

      {openSection === 'presence' && (
        <DetailModal title="Arrivée / départ" eyebrow="Présence" onClose={() => setOpenSection(null)}>
          <DetailRow label="Arrivée" value={guest.arrival_at ? formatDateTime(guest.arrival_at) : 'Non renseignée'} />
          <DetailRow label="Départ" value={guest.departure_at ? formatDateTime(guest.departure_at) : 'Non renseigné'} />
        </DetailModal>
      )}

      {openSection === 'food' && (
        <DetailModal title="Régime et allergies" eyebrow="Alimentation" onClose={() => setOpenSection(null)}>
          {foodLines.length === 0 ? (
            <p className="text-sm text-neutral-500">Aucune information alimentaire renseignée.</p>
          ) : (
            foodLines.map((line) => <DetailRow key={line} label="À prendre en compte" value={line} />)
          )}
        </DetailModal>
      )}

      {openSection === 'responsibilities' && (
        <DetailModal title="Votre récapitulatif" eyebrow="À faire / à apporter" onClose={() => setOpenSection(null)}>
          {responsibilitiesError ? (
            <p className="text-sm text-red-600">{responsibilitiesError}</p>
          ) : responsibilitiesLoading ? (
            <p className="text-sm text-neutral-500">Chargement de vos éléments…</p>
          ) : responsibilityRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Rien ne vous est attribué pour le moment.</p>
          ) : (
            <ResponsibilitiesList rows={responsibilityRows} onToggleLogisticsItem={handleToggleResponsibilityItem} />
          )}
        </DetailModal>
      )}

      {openSection === 'edit' && (
        <DetailModal title="Modifier ma fiche" eyebrow="Ma fiche" onClose={() => setOpenSection(null)} wide>
          <GuestForm
            stayId={stayId}
            stayStartDate={stayStartDate}
            stayEndDate={stayEndDate}
            guest={guest}
            onSuccess={handleSuccess}
            onCancel={() => setOpenSection(null)}
          />
        </DetailModal>
      )}
    </div>
  )
}

function SectionCard({ eyebrow, title, value, onClick }: { eyebrow: string; title: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-[var(--stay-primary)] hover:bg-[#fffdf9]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--stay-primary)]">{eyebrow}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">{title}</p>
          <p className="mt-1 truncate text-sm text-neutral-500">{value}</p>
        </div>
        <span className="sh-card-arrow">→</span>
      </div>
    </button>
  )
}

function DetailModal({
  title,
  eyebrow,
  children,
  onClose,
  wide,
}: {
  title: string
  eyebrow: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div className="sh-modal-overlay" onClick={onClose}>
      <div className={`sh-modal ${wide ? '' : 'sh-group-modal'}`} onClick={(event) => event.stopPropagation()}>
        <div className="sh-modal-header">
          <div>
            <p className="sh-section-label">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="sh-modal-content">{children}</div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-[#fffdf9] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--stay-primary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  )
}

function ResponsibilitiesList({
  rows,
  onToggleLogisticsItem,
}: {
  rows: ResponsibilityRow[]
  onToggleLogisticsItem: (itemId: string, nextChecked: boolean) => Promise<void>
}) {
  const groups = ['Logistique', 'Couchage', 'Planning']
    .map((group) => ({ group, items: rows.filter((row) => row.group === group) }))
    .filter((entry) => entry.items.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ group, items }) => (
        <section key={group} className="sh-modal-group">
          <h3>{group}</h3>
          <div className="sh-modal-list">
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="sh-modal-row">
                {item.type === 'logistics_item' ? (
                  <button
                    type="button"
                    className={`sh-recap-check${item.is_done ? ' checked' : ''}`}
                    onClick={() => void onToggleLogisticsItem(item.id, !item.is_done)}
                    aria-label={item.is_done ? 'Repasser à prévoir' : 'Marquer terminé'}
                  >
                    {item.is_done ? '✓' : ''}
                  </button>
                ) : (
                  <span className="sh-responsibility-icon">{item.icon}</span>
                )}
                <span className="sh-responsibility-body">
                  <span className="sh-responsibility-title">{item.title}</span>
                  {item.subtitle && <span className="sh-responsibility-meta">{item.subtitle}</span>}
                </span>
                {item.status && <span className="sh-responsibility-status">{item.status}</span>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SuccessMessage() {
  return (
    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
      Fiche enregistrée.
    </div>
  )
}

function formatPresencePreview(guest: GuestSummary) {
  const arrival = guest.arrival_at ? formatShortDate(guest.arrival_at) : 'arrivée non renseignée'
  const departure = guest.departure_at ? formatShortDate(guest.departure_at) : 'départ non renseigné'
  return `${arrival} → ${departure}`
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function readFoodPreferenceLines(guest: GuestSummary | { food_preferences?: unknown }) {
  const prefs = guest.food_preferences
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return []

  const record = prefs as Record<string, unknown>
  const lines: string[] = []

  const diet = typeof record.diet === 'string' ? record.diet.trim() : ''
  if (diet) lines.push(diet)

  const allergies = Array.isArray(record.allergies)
    ? record.allergies.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  if (allergies.length > 0) lines.push(`Allergies : ${allergies.join(', ')}`)

  const notes = typeof record.notes === 'string' ? record.notes.trim() : ''
  if (notes) lines.push(notes)

  return lines
}
