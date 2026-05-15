import type { MemberRole } from '@/shared/types/database.types'

export const permissions = {
  canEditStay: (role: MemberRole) => role === 'owner' || role === 'co_organizer',
  canManageGuests: (role: MemberRole) => role === 'owner' || role === 'co_organizer',
  canManageMembers: (role: MemberRole) => role === 'owner' || role === 'co_organizer',
  canEditSettings: (role: MemberRole) => role === 'owner' || role === 'co_organizer',
  canArchiveStay: (role: MemberRole) => role === 'owner',
  canTransferOwner: (role: MemberRole) => role === 'owner',
  canViewBudget: (role: MemberRole) => role !== 'viewer',
  canAddExpenses: (role: MemberRole) => role === 'owner' || role === 'co_organizer',
}
