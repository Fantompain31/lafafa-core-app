import { createClient } from '@/lib/supabase/client'
import type { FoodPreferences, GuestCategory, GuestStatus, GuestSummary } from '@/shared/types/database.types'
import { dateTimeLocalToUtcIso } from '@/shared/utils/dates'
import { emptyToNull, omitUndefined } from '@/shared/utils/object'
import { assertDateTimeRange, requireNonEmpty } from '@/shared/utils/validation'

type GuestPayload = {
  firstName: string
  lastName?: string | null
  category?: GuestCategory
  status?: GuestStatus
  color?: string | null
  arrivalAt?: string | null
  departureAt?: string | null
  foodPreferences?: FoodPreferences
  notes?: string | null
}

function normalizeGuestPayload(payload: GuestPayload) {
  const firstName = requireNonEmpty(payload.firstName, 'Prénom')
  const arrivalIso = payload.arrivalAt ? dateTimeLocalToUtcIso(payload.arrivalAt) : null
  const departureIso = payload.departureAt ? dateTimeLocalToUtcIso(payload.departureAt) : null
  assertDateTimeRange(arrivalIso, departureIso)

  return {
    first_name: firstName,
    last_name: payload.lastName === undefined ? undefined : emptyToNull(payload.lastName ?? ''),
    category: payload.category,
    status: payload.status,
    color: payload.color === undefined ? undefined : emptyToNull(payload.color ?? ''),
    arrival_at: payload.arrivalAt === undefined ? undefined : arrivalIso,
    departure_at: payload.departureAt === undefined ? undefined : departureIso,
    food_preferences: payload.foodPreferences,
    notes: payload.notes === undefined ? undefined : emptyToNull(payload.notes ?? ''),
  }
}

export const guestsService = {
  async getGuests(stayId: string): Promise<GuestSummary[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('guests_summary')
      .select('*')
      .eq('stay_id', stayId)
      .order('first_name')
    if (error) throw new Error(error.message)
    return (data ?? []) as GuestSummary[]
  },

  async getGuestById(guestId: string): Promise<GuestSummary | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('guests_summary')
      .select('*')
      .eq('id', guestId)
      .single()
    if (error) return null
    return data as GuestSummary
  },

  async addGuest(stayId: string, payload: GuestPayload) {
    const supabase = createClient()
    const normalized = normalizeGuestPayload(payload)
    const { data, error } = await supabase
      .from('guests')
      .insert({
        stay_id: stayId,
        first_name: normalized.first_name,
        last_name: normalized.last_name ?? null,
        category: normalized.category ?? 'adult',
        status: normalized.status ?? 'invited',
        color: normalized.color ?? null,
        arrival_at: normalized.arrival_at ?? null,
        departure_at: normalized.departure_at ?? null,
        food_preferences: normalized.food_preferences ?? {},
        notes: normalized.notes ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return data as { id: string }
  },

  async updateGuest(guestId: string, payload: Partial<GuestPayload>) {
    const supabase = createClient()
    const normalized = payload.firstName !== undefined
      ? normalizeGuestPayload(payload as GuestPayload)
      : {
          last_name: payload.lastName === undefined ? undefined : emptyToNull(payload.lastName ?? ''),
          category: payload.category,
          status: payload.status,
          color: payload.color === undefined ? undefined : emptyToNull(payload.color ?? ''),
          arrival_at: payload.arrivalAt === undefined ? undefined : dateTimeLocalToUtcIso(payload.arrivalAt ?? ''),
          departure_at: payload.departureAt === undefined ? undefined : dateTimeLocalToUtcIso(payload.departureAt ?? ''),
          food_preferences: payload.foodPreferences,
          notes: payload.notes === undefined ? undefined : emptyToNull(payload.notes ?? ''),
        }

    assertDateTimeRange(normalized.arrival_at, normalized.departure_at)

    const { error } = await supabase
      .from('guests')
      .update(omitUndefined(normalized))
      .eq('id', guestId)
    if (error) throw new Error(error.message)
  },

  async cancelGuest(guestId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('guests')
      .update({ status: 'cancelled' })
      .eq('id', guestId)
    if (error) throw new Error(error.message)
  },
}
