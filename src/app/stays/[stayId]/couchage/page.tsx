import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StayLayout } from '@/core/stays/components/StayLayout'
import AccommodationPageClient from '@/modules/accommodation/AccommodationPageClient'
import type { MyStay } from '@/shared/types/database.types'
import type {
  AccommodationAssignment,
  AccommodationBed,
  AccommodationGuest,
  AccommodationRoom,
  AccommodationRoomWithBeds,
} from '@/modules/accommodation/accommodation.types'

type Props = { params: { stayId: string } }

export const metadata = { title: 'Couchage' }

export default async function AccommodationPage({ params }: Props) {
  const { stayId } = params
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: stay, error: stayError } = await supabase
    .from('my_stays')
    .select('*')
    .eq('id', stayId)
    .single()

  if (stayError || !stay) notFound()

  const typedStay = stay as MyStay

  const [roomsResult, bedsResult, assignmentsResult, guestsResult] = await Promise.all([
    supabase
      .from('accommodation_rooms')
      .select('*')
      .eq('stay_id', stayId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
      .from('accommodation_beds')
      .select('*')
      .eq('stay_id', stayId)
      .order('created_at', { ascending: true }),

    supabase
      .from('accommodation_assignments')
      .select('*')
      .eq('stay_id', stayId)
      .order('created_at', { ascending: true }),

    supabase
      .from('guests_summary')
      .select('id, first_name, last_name, color, linked_user_id, linked_user_avatar_url, status')
      .eq('stay_id', stayId)
      .neq('status', 'cancelled')
      .order('first_name', { ascending: true }),
  ])

  const rooms = (roomsResult.data ?? []) as AccommodationRoom[]
  const beds = (bedsResult.data ?? []) as AccommodationBed[]
  const assignments = (assignmentsResult.data ?? []) as AccommodationAssignment[]
  const guests = (guestsResult.data ?? []) as AccommodationGuest[]

  const initialRooms: AccommodationRoomWithBeds[] = rooms.map((room) => ({
    ...room,
    beds: beds
      .filter((bed) => bed.room_id === room.id)
      .map((bed) => ({
        ...bed,
        assignments: assignments.filter((assignment) => assignment.bed_id === bed.id),
      })),
  }))

  return (
    <StayLayout stay={typedStay}>
      <AccommodationPageClient
        stayId={stayId}
        initialRooms={initialRooms}
        guests={guests}
      />
    </StayLayout>
  )
}
