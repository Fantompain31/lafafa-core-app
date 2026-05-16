'use client'

import { useState } from 'react'
import type { GuestSummary, MemberRole } from '@/shared/types/database.types'
import { permissions } from '@/core/permissions/permissions'
import { guestsService } from '@/core/guests/services/guests.service'
import { createClient } from '@/lib/supabase/client'
import { GuestCard } from './GuestCard'
import { GuestForm } from './GuestForm'
import InviteGuestModal from './InviteGuestModal'

type Props = {
  stayId: string
  initialGuests: GuestSummary[]
  myRole: MemberRole
}

type View = 'list' | 'add' | 'edit'

export function GuestsPageClient({ stayId, initialGuests, myRole }: Props) {
  const [guests, setGuests] = useState<GuestSummary[]>(initialGuests)
  const [view, setView] = useState<View>('list')
  const [selectedGuest, setSelectedGuest] = useState<GuestSummary | null>(null)
  const [filter, setFilter] = useState('all')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteGuestId, setInviteGuestId] = useState<string | undefined>(undefined)
  const [copiedGuestId, setCopiedGuestId] = useState<string | null>(null)

  const isOrganizer = permissions.canManageGuests(myRole)

  async function reload() {
    setGuests(await guestsService.getGuests(stayId))
  }

  function handleSuccess() {
    setView('list')
    setSelectedGuest(null)
    void reload()
  }

  function handleInviteGuest(guest: GuestSummary) {
    setInviteGuestId(guest.id)
    setShowInviteModal(true)
  }

  function handleInviteGeneral() {
    setInviteGuestId(undefined)
    setShowInviteModal(true)
  }

  async function handleCopyLink(guest: GuestSummary) {
    const supabase = createClient()
    const { data: token, error } = await supabase.rpc('create_guest_access_link', {
      p_stay_id: stayId,
      p_label: 'Lien partageable',
      p_guest_id: guest.id,
      p_expires_in_days: null,
    })

    if (error || !token) return

    const url = `${window.location.origin}/join?token=${token}`
    await navigator.clipboard.writeText(url)
    setCopiedGuestId(guest.id)
    setTimeout(() => setCopiedGuestId(null), 2000)
    void reload()
  }

  async function handleRevoke(guest: GuestSummary) {
    if (!confirm(`Révoquer l'invitation de ${guest.first_name} ?`)) return
    const supabase = createClient()

    if (guest.active_link_id) {
      await supabase.rpc('revoke_guest_access_link', { p_link_id: guest.active_link_id })
    }
    if (guest.active_invitation_id) {
      await supabase.rpc('revoke_stay_invitation', { p_invitation_id: guest.active_invitation_id })
    }

    void reload()
  }

  const filteredGuests = guests.filter(g => {
    if (filter === 'all') return g.status !== 'cancelled'
    if (filter === 'confirmed') return g.status === 'confirmed'
    if (filter === 'pending') return ['invited', 'maybe'].includes(g.status)
    if (filter === 'cancelled') return g.status === 'cancelled'
    return true
  })

  const confirmed = guests.filter(g => g.status === 'confirmed').length
  const total = guests.filter(g => g.status !== 'cancelled').length

  if (view === 'add') {
    return (
      <GuestEditor title="Ajouter un invité" onBack={() => setView('list')}>
        <GuestForm stayId={stayId} onSuccess={handleSuccess} onCancel={() => setView('list')} />
      </GuestEditor>
    )
  }

  if (view === 'edit' && selectedGuest) {
    return (
      <GuestEditor
        title={`${selectedGuest.first_name} ${selectedGuest.last_name ?? ''}`}
        onBack={() => { setView('list'); setSelectedGuest(null) }}
      >
        <GuestForm
          stayId={stayId}
          guest={selectedGuest}
          onSuccess={handleSuccess}
          onCancel={() => { setView('list'); setSelectedGuest(null) }}
        />
      </GuestEditor>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-neutral-900">Invités</h2>
          <p className="text-xs text-neutral-500">
            {confirmed} confirmé{confirmed > 1 ? 's' : ''} / {total} au total
          </p>
        </div>

        {isOrganizer && (
          <div className="flex gap-2">
            <button
              onClick={() => setView('add')}
              className="rounded-lg border border-[var(--stay-primary)] px-3 py-2 text-sm font-medium text-[var(--stay-primary)] hover:opacity-90"
            >
              + Ajouter
            </button>
            <button
              onClick={handleInviteGeneral}
              className="rounded-lg bg-[var(--stay-primary)] px-3 py-2 text-sm font-medium text-[var(--stay-primary-text)] hover:opacity-90"
            >
              Inviter
            </button>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { value: 'all', label: 'Tous' },
          { value: 'confirmed', label: 'Confirmés' },
          { value: 'pending', label: 'En attente' },
          { value: 'cancelled', label: 'Annulés' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-[var(--stay-primary)] text-[var(--stay-primary-text)]'
                : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filteredGuests.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white py-12 text-center">
          <p className="text-sm text-neutral-500">Aucun invité dans cette catégorie.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredGuests.map(guest => (
            <GuestCard
              key={guest.id}
              guest={guest}
              isOrganizer={isOrganizer}
              onInvite={handleInviteGuest}
              onCopyLink={handleCopyLink}
              onRevoke={handleRevoke}
              onClick={isOrganizer ? () => { setSelectedGuest(guest); setView('edit') } : undefined}
            />
          ))}
        </div>
      )}

      {/* Feedback copie */}
      {copiedGuestId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
          Lien copié !
        </div>
      )}

      {/* Modal invitation */}
      {showInviteModal && (
        <InviteGuestModal
          stayId={stayId}
          guestId={inviteGuestId}
          onClose={() => { setShowInviteModal(false); void reload() }}
        />
      )}

    </div>
  )
}

function GuestEditor({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-700">
          ← Retour
        </button>
        <h2 className="text-base font-medium text-neutral-900">{title}</h2>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">{children}</div>
    </div>
  )
}
