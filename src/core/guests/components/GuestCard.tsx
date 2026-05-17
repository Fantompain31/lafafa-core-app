import type { GuestSummary } from '@/shared/types/database.types'
import { formatDateTime } from '@/shared/utils/dates'
import { GuestCategoryBadge, GuestStatusBadge } from './GuestBadge'

type Props = {
  guest: GuestSummary
  onClick?: () => void
  onInvite?: (guest: GuestSummary) => void
  onCopyLink?: (guest: GuestSummary) => void
  onRevoke?: (guest: GuestSummary) => void
  onRemove?: (guest: GuestSummary) => void
  onMakeCoOrganizer?: (guest: GuestSummary) => void
  onRemoveCoOrganizer?: (guest: GuestSummary) => void
  isOrganizer?: boolean
  isOwner?: boolean
}

export function GuestCard({ guest, onClick, onInvite, onCopyLink, onRevoke, onRemove, onMakeCoOrganizer, onRemoveCoOrganizer, isOrganizer, isOwner }: Props) {
  const initials = [guest.first_name[0], guest.last_name?.[0]].filter(Boolean).join('').toUpperCase()
  const isLinked = guest.linked_user_id !== null
  const hasActiveInvitation = guest.active_invitation_id !== null || guest.active_link_id !== null

  const content = (
    <>
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-medium"
        style={{ backgroundColor: guest.color ? `${guest.color}22` : '#C4A88222', color: guest.color ?? '#8B7355' }}
      >
        {guest.linked_user_avatar_url
          ? <img src={guest.linked_user_avatar_url} alt="" className="h-10 w-10 object-cover" />
          : initials}
      </div>

      {/* Infos */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-neutral-900">
              {guest.first_name} {guest.last_name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <GuestCategoryBadge category={guest.category} />
              <GuestStatusBadge status={guest.status} />
              {/* Badge lien envoyé */}
              {!isLinked && hasActiveInvitation && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  ✉ Lien envoyé
                </span>
              )}
            </div>
          </div>

          {/* Bouton Inviter — uniquement si organisateur et fiche pas encore liée */}
          {isOrganizer && !isLinked && onInvite && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onInvite(guest) }}
              className="shrink-0 rounded-lg border border-[var(--stay-primary)] px-2.5 py-1 text-xs font-medium text-[var(--stay-primary)] hover:bg-[var(--stay-primary)] hover:text-[var(--stay-primary-text)] transition-colors"
            >
              Inviter
            </button>
          )}
        </div>

        {/* Boutons Copier / Révoquer — si invitation active */}
        {isOrganizer && !isLinked && hasActiveInvitation && (
          <div
            className="mt-3 flex gap-2 border-t border-neutral-100 pt-3"
            onClick={e => e.stopPropagation()}
          >
            {onCopyLink && (
              <button
                type="button"
                onClick={() => onCopyLink(guest)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copier le lien
              </button>
            )}
            {onRevoke && (
              <button
                type="button"
                onClick={() => onRevoke(guest)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                Révoquer
              </button>
            )}
          </div>
        )}

        {(guest.arrival_at || guest.departure_at) && (
          <div className="mt-3 space-y-1 text-xs text-neutral-500">
            {guest.arrival_at && <p>Arrivée : {formatDateTime(guest.arrival_at)}</p>}
            {guest.departure_at && <p>Départ : {formatDateTime(guest.departure_at)}</p>}
          </div>
        )}

        {isOwner && guest.linked_user_id && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onMakeCoOrganizer?.(guest)}
              className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50"
            >
              Nommer co-organisateur
            </button>
            <button
              type="button"
              onClick={() => onRemoveCoOrganizer?.(guest)}
              className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Retirer co-organisateur
            </button>
          </div>
        )}

        {/* Bouton supprimer — owner uniquement */}
        {isOwner && onRemove && (
          <div className="mt-3 border-t border-neutral-100 pt-3" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onRemove(guest)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Supprimer du séjour
            </button>
          </div>
        )}
      </div>
    </>
  )

  const className = "flex w-full gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all duration-150"

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
        className={`${className} cursor-pointer hover:border-neutral-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)] focus:ring-offset-2`}
      >
        {content}
      </div>
    )
  }

  return <div className={className}>{content}</div>
}
