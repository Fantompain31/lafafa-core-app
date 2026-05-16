// src/core/integrations/guest-arrival.sync.ts
//
// Pont de synchronisation entre le Core (guests) et le module Organisation.
// Placé dans core/integrations pour que le Core ne dépende pas directement
// d'un module, et que le module Organisation ne devienne pas une dépendance du Core.
//
// Couplage faible : on passe uniquement par la RPC sync_guest_arrival_event.

import { createClient } from '@/lib/supabase/client'

interface ArrivalSyncParams {
  guestId:   string
  stayId:    string
  firstName: string
  lastName?: string | null
  arrivalAt: string | null   // ISO UTC datetime ou null (= effacer l'événement)
}

export async function syncGuestArrivalToOrganisation({
  guestId,
  stayId,
  firstName,
  lastName,
  arrivalAt,
}: ArrivalSyncParams): Promise<void> {
  const supabase = createClient()

  let arrivalDate: string | null = null
  let arrivalTime: string | null = null

  if (arrivalAt) {
    const d = new Date(arrivalAt)
    arrivalDate = d.toLocaleDateString('fr-CA')           // "YYYY-MM-DD"
    arrivalTime = d.toLocaleTimeString('fr-FR', {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    })                                                     // "HH:MM"
  }

  const guestName = [firstName, lastName].filter(Boolean).join(' ')

  try {
    const { error } = await supabase.rpc('sync_guest_arrival_event', {
      p_guest_id:     guestId,
      p_stay_id:      stayId,
      p_guest_name:   guestName,
      p_arrival_date: arrivalDate,
      p_arrival_time: arrivalTime,
    })

    if (error) {
      console.warn('[GuestArrivalSync] sync_guest_arrival_event :', error.message)
    }
  } catch (e) {
    console.warn('[GuestArrivalSync] Erreur inattendue :', e)
  }
}
