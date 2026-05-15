import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StayHome } from '@/core/stays/components/StayHome'
import { StayLayout } from '@/core/stays/components/StayLayout'
import type { MyStay } from '@/shared/types/database.types'

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

  const { data: stay, error } = await supabase.from('my_stays').select('*').eq('id', params.stayId).single()
  if (error || !stay) notFound()

  const { data: scoreData } = await supabase.rpc('get_preparation_score', { p_stay_id: params.stayId })
  const score = typeof scoreData === 'number' ? scoreData : 0

  return <StayLayout stay={stay as MyStay}><StayHome stay={stay as MyStay} score={score} /></StayLayout>
}
