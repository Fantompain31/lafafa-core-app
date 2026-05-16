import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StayHome } from '@/core/stays/components/StayHome'
import { StayLayout } from '@/core/stays/components/StayLayout'
import type { MyStay, GuestSummary } from '@/shared/types/database.types'

type Props = { params: { stayId: string } }

export async function generateMetadata({ params }: Props) {
  const supabase = createClient()
  const { data } = await supabase.from('stays_summary').select('title').eq('id', params.stayId).single()
  return { title: data?.title ?? 'Séjour' }
}

export default async function StayPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stay, error } = await supabase
    .from('my_stays').select('*').eq('id', params.stayId).single()
  if (error || !stay) notFound()

  const typedStay = stay as MyStay

  // Fetch en parallèle
  const [scoreResult, myGuestResult, participantsResult] = await Promise.all([
    supabase.rpc('get_preparation_score', { p_stay_id: params.stayId }),
    supabase.from('guests_summary').select('*').eq('stay_id', params.stayId).eq('linked_user_id', user.id).single(),
    supabase.from('guests_summary').select('*').eq('stay_id', params.stayId).neq('status', 'cancelled').order('first_name'),
  ])

  const score = typeof scoreResult.data === 'number' ? scoreResult.data : 0
  const myGuest = (myGuestResult.data ?? null) as GuestSummary | null
  const participants = (participantsResult.data ?? []) as GuestSummary[]

  return (
    <StayLayout stay={typedStay}>
      <StayHome
        stay={typedStay}
        score={score}
        myGuest={myGuest}
        participants={participants}
        myRole={typedStay.my_role}
      />
    </StayLayout>
  )
}
