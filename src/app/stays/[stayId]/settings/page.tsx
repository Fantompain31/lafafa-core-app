import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageClient } from '@/core/stays/components/SettingsPageClient'
import { StayLayout } from '@/core/stays/components/StayLayout'
import type { MyStay, StayEnabledFeature, StaySettings } from '@/shared/types/database.types'

type Props = { params: { stayId: string } }

export const metadata = { title: 'Paramètres' }

export default async function SettingsPage({ params }: Props) {
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

  const typedStay = stay as MyStay

  if (!typedStay.my_role) redirect(`/stays/${params.stayId}`)

  const { data: settings } = await supabase
    .from('stay_settings')
    .select('*')
    .eq('stay_id', params.stayId)
    .single()

  const features = [
    {
      stay_id: params.stayId,
      feature_key: 'guests',
      is_enabled: true,
    },
    {
      stay_id: params.stayId,
      feature_key: 'organisation',
      is_enabled: true,
    },
    {
      stay_id: params.stayId,
      feature_key: 'logistics',
      is_enabled: true,
    },
    {
      stay_id: params.stayId,
      feature_key: 'budget',
      is_enabled: true,
    },
    {
      stay_id: params.stayId,
      feature_key: 'memories',
      is_enabled: true,
    },
  ] as StayEnabledFeature[]

  return (
    <StayLayout stay={typedStay}>
      <SettingsPageClient
        stay={typedStay}
        settings={settings as StaySettings | null}
        features={features}
        isOwner={typedStay.my_role === 'owner'}
        myRole={typedStay.my_role}
      />
    </StayLayout>
  )
}