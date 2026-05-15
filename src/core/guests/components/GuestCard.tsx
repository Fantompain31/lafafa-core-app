import type { GuestSummary } from '@/shared/types/database.types'
import { formatDateTime } from '@/shared/utils/dates'
import { GuestCategoryBadge, GuestStatusBadge } from './GuestBadge'

type Props = {
  guest: GuestSummary
  onClick?: () => void
}

export function GuestCard({ guest, onClick }: Props) {
  const initials = [guest.first_name[0], guest.last_name?.[0]].filter(Boolean).join('').toUpperCase()
  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-medium" style={{ backgroundColor: guest.color ? `${guest.color}22` : '#C4A88222', color: guest.color ?? '#8B7355' }}>
        {guest.linked_user_avatar_url ? <img src={guest.linked_user_avatar_url} alt="" className="h-10 w-10 object-cover" /> : initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="truncate text-sm font-medium text-neutral-900">{guest.first_name} {guest.last_name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2"><GuestCategoryBadge category={guest.category} /><GuestStatusBadge status={guest.status} /></div>
          </div>
        </div>
        {(guest.arrival_at || guest.departure_at) && (
          <div className="mt-3 space-y-1 text-xs text-neutral-500">
            {guest.arrival_at && <p>Arrivée : {formatDateTime(guest.arrival_at)}</p>}
            {guest.departure_at && <p>Départ : {formatDateTime(guest.departure_at)}</p>}
          </div>
        )}
      </div>
    </>
  )

  const className = "flex w-full gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all duration-150"

  if (onClick) {
    return <button type="button" onClick={onClick} className={`${className} hover:border-neutral-300 hover:shadow-sm`}>{content}</button>
  }

  return <div className={className}>{content}</div>
}
