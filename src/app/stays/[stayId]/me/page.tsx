import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StayLayout } from '@/core/stays/components/StayLayout'
import MyStayGuestPageClient from '@/core/guests/components/MyStayGuestPageClient'
import type { GuestSummary, MyStay } from '@/shared/types/database.types'

type Props = { params: { stayId: string } }

export const metadata = { title: 'Ma fiche' }

export default async function MyStayGuestPage({ params }: Props) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: stay, error: stayError } = await supabase
    .from('my_stays')
    .select('*')
    .eq('id', params.stayId)
    .single()

  if (stayError || !stay) notFound()

  const currentStay = stay as MyStay

  const { data: guest } = await supabase
    .from('guests_summary')
    .select('*')
    .eq('stay_id', params.stayId)
    .eq('linked_user_id', user.id)
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle()

  return (
    <StayLayout stay={currentStay}>
      <MyStayGuestPageClient
        stayId={params.stayId}
        userId={user.id}
        guest={(guest ?? null) as GuestSummary | null}
        stayStartDate={currentStay.start_date ?? null}
        stayEndDate={currentStay.end_date ?? null}
      />
    </StayLayout>
  )
}
