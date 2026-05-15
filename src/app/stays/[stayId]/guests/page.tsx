import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GuestsPageClient } from '@/core/guests/components/GuestsPageClient'
import { StayLayout } from '@/core/stays/components/StayLayout'
import type { GuestSummary, MyStay } from '@/shared/types/database.types'

type Props = { params: { stayId: string } }

export const metadata = { title: 'Invités' }

export default async function GuestsPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stay, error: stayError } = await supabase.from('my_stays').select('*').eq('id', params.stayId).single()
  if (stayError || !stay) notFound()

  const { data: guests } = await supabase.from('guests_summary').select('*').eq('stay_id', params.stayId).order('first_name')

  return (
    <StayLayout stay={stay as MyStay}>
      <GuestsPageClient stayId={params.stayId} initialGuests={(guests ?? []) as GuestSummary[]} myRole={(stay as MyStay).my_role} />
    </StayLayout>
  )
}
