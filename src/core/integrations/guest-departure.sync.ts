// src/core/integrations/guest-departure.sync.ts
//
// Pont de synchronisation entre le Core (guests) et le module Organisation
// pour les départs invités.
// Même pattern que guest-arrival.sync.ts.
// source_type = 'guest_departure', source_id = guest.id

import { createClient } from '@/lib/supabase/client'

interface DepartureSyncParams {
  guestId:     string
  stayId:      string
  firstName:   string
  lastName?:   string | null
  departureAt: string | null   // ISO UTC datetime ou null (= effacer l'événement)
}

export async function syncGuestDepartureToOrganisation({
  guestId,
  stayId,
  firstName,
  lastName,
  departureAt,
}: DepartureSyncParams): Promise<void> {
  const supabase = createClient()

  let departureDate: string | null = null
  let departureTime: string | null = null

  if (departureAt) {
    const d = new Date(departureAt)
    departureDate = d.toLocaleDateString('fr-CA')          // "YYYY-MM-DD"
    departureTime = d.toLocaleTimeString('fr-FR', {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    })                                                      // "HH:MM"
  }

  const guestName = [firstName, lastName].filter(Boolean).join(' ')

  try {
    const { error } = await supabase.rpc('sync_guest_departure_event', {
      p_guest_id:       guestId,
      p_stay_id:        stayId,
      p_guest_name:     guestName,
      p_departure_date: departureDate,
      p_departure_time: departureTime,
    })

    if (error) {
      console.warn('[GuestDepartureSync] sync_guest_departure_event :', error.message)
    }
  } catch (e) {
    console.warn('[GuestDepartureSync] Erreur inattendue :', e)
  }
}
