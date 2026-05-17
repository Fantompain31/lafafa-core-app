import { createClient } from '@/lib/supabase/client'
import type { FoodPreferences, GuestCategory, GuestStatus, GuestSummary } from '@/shared/types/database.types'
import { dateTimeLocalToUtcIso } from '@/shared/utils/dates'
import { emptyToNull, omitUndefined } from '@/shared/utils/object'
import { assertDateTimeRange, requireNonEmpty } from '@/shared/utils/validation'
import { syncGuestArrivalToOrganisation } from '@/core/integrations/guest-arrival.sync'
import { syncGuestDepartureToOrganisation } from '@/core/integrations/guest-departure.sync'

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
  linkedUserId?: string | null
}

// Convertit une valeur datetime-local de manière sûre :
// - undefined → undefined (ne pas modifier le champ)
// - null ou '' → null (effacer en base)
// - string non vide → convertir en ISO UTC
function safeDateTimeToIso(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return dateTimeLocalToUtcIso(value)
}

function normalizeGuestPayload(payload: GuestPayload) {
  const firstName    = requireNonEmpty(payload.firstName, 'Prénom')
  const arrivalIso   = safeDateTimeToIso(payload.arrivalAt)
  const departureIso = safeDateTimeToIso(payload.departureAt)

  // assertDateTimeRange uniquement si les deux sont des strings non-null
  if (arrivalIso && departureIso) {
    assertDateTimeRange(arrivalIso, departureIso)
  }

  return {
    first_name:       firstName,
    last_name:        payload.lastName === undefined ? undefined : emptyToNull(payload.lastName ?? ''),
    category:         payload.category,
    status:           payload.status,
    color:            payload.color === undefined ? undefined : emptyToNull(payload.color ?? ''),
    arrival_at:       arrivalIso,
    departure_at:     departureIso,
    food_preferences: payload.foodPreferences,
    notes:            payload.notes === undefined ? undefined : emptyToNull(payload.notes ?? ''),
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

    if (payload.linkedUserId) {
      const { data, error } = await supabase.rpc('create_my_guest', {
        p_stay_id:          stayId,
        p_first_name:       normalized.first_name,
        p_last_name:        normalized.last_name ?? null,
        p_category:         normalized.category ?? 'adult',
        p_status:           normalized.status ?? 'confirmed',
        p_color:            normalized.color ?? null,
        p_arrival_at:       normalized.arrival_at ?? null,
        p_departure_at:     normalized.departure_at ?? null,
        p_food_preferences: normalized.food_preferences ?? {},
        p_notes:            normalized.notes ?? null,
      })
      if (error) throw new Error(error.message)

      const newId = data as string
      await Promise.all([
        normalized.arrival_at
          ? syncGuestArrivalToOrganisation({ guestId: newId, stayId, firstName: payload.firstName, lastName: payload.lastName, arrivalAt: normalized.arrival_at })
          : Promise.resolve(),
        normalized.departure_at
          ? syncGuestDepartureToOrganisation({ guestId: newId, stayId, firstName: payload.firstName, lastName: payload.lastName, departureAt: normalized.departure_at })
          : Promise.resolve(),
      ])
      return { id: newId }
    }

    const { data, error } = await supabase
      .from('guests')
      .insert({
        stay_id:          stayId,
        first_name:       normalized.first_name,
        last_name:        normalized.last_name ?? null,
        category:         normalized.category ?? 'adult',
        status:           normalized.status ?? 'invited',
        color:            normalized.color ?? null,
        arrival_at:       normalized.arrival_at ?? null,
        departure_at:     normalized.departure_at ?? null,
        food_preferences: normalized.food_preferences ?? {},
        notes:            normalized.notes ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    const newId = (data as { id: string }).id
    await Promise.all([
      normalized.arrival_at
        ? syncGuestArrivalToOrganisation({ guestId: newId, stayId, firstName: payload.firstName, lastName: payload.lastName, arrivalAt: normalized.arrival_at })
        : Promise.resolve(),
      normalized.departure_at
        ? syncGuestDepartureToOrganisation({ guestId: newId, stayId, firstName: payload.firstName, lastName: payload.lastName, departureAt: normalized.departure_at })
        : Promise.resolve(),
    ])
    return data as { id: string }
  },

  async updateGuest(guestId: string, payload: Partial<GuestPayload>) {
    const supabase = createClient()

    // Normalisation partielle — on n'utilise safeDateTimeToIso pour chaque champ date
    const normalized: Record<string, unknown> = {}

    if (payload.firstName !== undefined) normalized.first_name = requireNonEmpty(payload.firstName, 'Prénom')
    if (payload.lastName  !== undefined) normalized.last_name  = emptyToNull(payload.lastName ?? '')
    if (payload.category  !== undefined) normalized.category   = payload.category
    if (payload.status    !== undefined) normalized.status     = payload.status
    if (payload.color     !== undefined) normalized.color      = emptyToNull(payload.color ?? '')
    if (payload.foodPreferences !== undefined) normalized.food_preferences = payload.foodPreferences
    if (payload.notes     !== undefined) normalized.notes      = emptyToNull(payload.notes ?? '')

    // Dates : safe conversion
    if (payload.arrivalAt !== undefined) {
      normalized.arrival_at = safeDateTimeToIso(payload.arrivalAt)
    }
    if (payload.departureAt !== undefined) {
      normalized.departure_at = safeDateTimeToIso(payload.departureAt)
    }

    // Validation intervalle uniquement si les deux sont présentes et non-null
    const arrIso  = normalized.arrival_at   as string | null | undefined
    const depIso  = normalized.departure_at as string | null | undefined
    if (arrIso && depIso) {
      assertDateTimeRange(arrIso, depIso)
    }

    const { error } = await supabase
      .from('guests')
      .update(omitUndefined(normalized))
      .eq('id', guestId)
    if (error) throw new Error(error.message)

    // Sync Planning si dates ou nom touchés
    const touchesArrival   = payload.arrivalAt   !== undefined || payload.firstName !== undefined || payload.lastName !== undefined
    const touchesDeparture = payload.departureAt !== undefined || payload.firstName !== undefined || payload.lastName !== undefined

    if (touchesArrival || touchesDeparture) {
      const guest = await this.getGuestById(guestId)
      if (guest) {
        await Promise.all([
          touchesArrival
            ? syncGuestArrivalToOrganisation({ guestId, stayId: guest.stay_id, firstName: guest.first_name, lastName: guest.last_name ?? null, arrivalAt: guest.arrival_at ?? null })
            : Promise.resolve(),
          touchesDeparture
            ? syncGuestDepartureToOrganisation({ guestId, stayId: guest.stay_id, firstName: guest.first_name, lastName: guest.last_name ?? null, departureAt: guest.departure_at ?? null })
            : Promise.resolve(),
        ])
      }
    }
  },

  async cancelGuest(guestId: string) {
    const supabase = createClient()
    const guest = await this.getGuestById(guestId)

    const { error } = await supabase
      .from('guests')
      .update({ status: 'cancelled' })
      .eq('id', guestId)
    if (error) throw new Error(error.message)

    if (guest) {
      await Promise.all([
        syncGuestArrivalToOrganisation({ guestId, stayId: guest.stay_id, firstName: guest.first_name, lastName: guest.last_name ?? null, arrivalAt: null }),
        syncGuestDepartureToOrganisation({ guestId, stayId: guest.stay_id, firstName: guest.first_name, lastName: guest.last_name ?? null, departureAt: null }),
      ])
    }
  },

  async removeGuest(guestId: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('remove_guest_from_stay', { p_guest_id: guestId })
    if (error) throw new Error(error.message)
  },

  async leaveStay(stayId: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('leave_stay', { p_stay_id: stayId })
    if (error) throw new Error(error.message)
  },
}
