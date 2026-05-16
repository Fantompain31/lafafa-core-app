import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StayHome } from '@/core/stays/components/StayHome'
import { StayLayout } from '@/core/stays/components/StayLayout'
import type { MyStay, GuestSummary } from '@/shared/types/database.types'
import type {
  StayHomeEvent,
  StayHomeLogisticsItem,
  StayHomeLogisticsSection,
} from '@/core/stays/components/StayHome'

type Props = { params: { stayId: string } }

export async function generateMetadata({ params }: Props) {
  const supabase = createClient()
  const { data } = await supabase
    .from('stays_summary')
    .select('title')
    .eq('id', params.stayId)
    .single()

  return { title: data?.title ?? 'Séjour' }
}

export default async function StayPage({ params }: Props) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: stay, error } = await supabase
    .from('my_stays')
    .select('*')
    .eq('id', params.stayId)
    .single()

  if (error || !stay) notFound()

  const typedStay = stay as MyStay

  const today = new Date().toISOString().slice(0, 10)

  const [
    scoreResult,
    myGuestResult,
    participantsResult,
    eventsResult,
    sectionsResult,
    itemsResult,
  ] = await Promise.all([
    supabase.rpc('get_preparation_score', { p_stay_id: params.stayId }),

    supabase
      .from('guests_summary')
      .select('*')
      .eq('stay_id', params.stayId)
      .eq('linked_user_id', user.id)
      .neq('status', 'cancelled')
      .limit(1)
      .maybeSingle(),

    supabase
      .from('guests_summary')
      .select('*')
      .eq('stay_id', params.stayId)
      .neq('status', 'cancelled')
      .order('first_name'),

    supabase
      .from('organization_events')
      .select('id, title, event_type, event_date, start_time, end_time, location, status, source_type, source_id, logistics_section_id')
      .eq('stay_id', params.stayId)
      .neq('status', 'cancelled')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(6),

    supabase
      .from('logistics_sections')
      .select('id, title, section_type, source_type, source_id, is_hidden, created_at')
      .eq('stay_id', params.stayId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true })
      .limit(8),

    supabase
      .from('logistics_items')
      .select('id, section_id, is_checked, assigned_guest_id')
      .eq('stay_id', params.stayId),
  ])

  const score = typeof scoreResult.data === 'number' ? scoreResult.data : 0
  const myGuest = (myGuestResult.data ?? null) as GuestSummary | null
  const participants = (participantsResult.data ?? []) as GuestSummary[]
  const programEvents = (eventsResult.data ?? []) as StayHomeEvent[]
  const logisticsSections = (sectionsResult.data ?? []) as StayHomeLogisticsSection[]
  const logisticsItems = (itemsResult.data ?? []) as StayHomeLogisticsItem[]

  return (
    <StayLayout stay={typedStay}>
      <StayHome
        stay={typedStay}
        score={score}
        myGuest={myGuest}
        participants={participants}
        myRole={typedStay.my_role}
        programEvents={programEvents}
        logisticsSections={logisticsSections}
        logisticsItems={logisticsItems}
      />
    </StayLayout>
  )
}
