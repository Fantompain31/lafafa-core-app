import type { GuestCategory, GuestStatus } from '@/shared/types/database.types'

const STATUS_CONFIG: Record<GuestStatus, { label: string; className: string }> = {
  invited: { label: 'Invité', className: 'bg-blue-50 text-blue-700' },
  confirmed: { label: 'Confirmé', className: 'bg-green-50 text-green-700' },
  maybe: { label: 'Peut-être', className: 'bg-amber-50 text-amber-700' },
  declined: { label: 'Décliné', className: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Annulé', className: 'bg-neutral-100 text-neutral-500' },
}

const CATEGORY_CONFIG: Record<GuestCategory, { label: string; icon: string }> = {
  adult: { label: 'Adulte', icon: '👤' },
  child: { label: 'Enfant', icon: '🧒' },
  baby: { label: 'Bébé', icon: '👶' },
}

export function GuestStatusBadge({ status }: { status: GuestStatus }) {
  const config = STATUS_CONFIG[status]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>{config.label}</span>
}

export function GuestCategoryBadge({ category }: { category: GuestCategory }) {
  const config = CATEGORY_CONFIG[category]
  return <span className="flex items-center gap-1 text-xs text-neutral-500"><span>{config.icon}</span><span>{config.label}</span></span>
}
