import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageClient } from '@/core/stays/components/SettingsPageClient'
import { StayLayout } from '@/core/stays/components/StayLayout'
import type { MyStay, StayEnabledFeature, StaySettings } from '@/shared/types/database.types'

type Props = { params: { stayId: string } }

export const metadata = { title: 'Paramètres' }

export default async function SettingsPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stay, error: stayError } = await supabase.from('my_stays').select('*').eq('id', params.stayId).single()
  if (stayError || !stay) notFound()

  const typedStay = stay as MyStay
  if (!['owner', 'co_organizer'].includes(typedStay.my_role)) redirect(`/stays/${params.stayId}`)

  const { data: settings } = await supabase.from('stay_settings').select('*').eq('stay_id', params.stayId).single()
  const { data: features } = await supabase.from('stay_enabled_features').select('*').eq('stay_id', params.stayId).order('feature_key')

  return (
    <StayLayout stay={typedStay}>
      <SettingsPageClient stay={typedStay} settings={settings as StaySettings | null} features={(features ?? []) as StayEnabledFeature[]} isOwner={typedStay.my_role === 'owner'} />
    </StayLayout>
  )
}
