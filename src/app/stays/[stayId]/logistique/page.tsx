// src/app/stays/[stayId]/logistique/page.tsx

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StayLayout } from '@/core/stays/components/StayLayout'
import LogisticsPageClient from '@/modules/logistics/LogisticsPageClient'
import type { MyStay } from '@/shared/types/database.types'
import type {
  LogisticsGuest,
  LogisticsItem,
  LogisticsSection,
  LogisticsSectionWithItems,
} from '@/modules/logistics/logistics.types'

interface Props {
  params: { stayId: string }
}

export async function generateMetadata({ params }: Props) {
  const supabase = createClient()

  const { data } = await supabase
    .from('stays_summary')
    .select('title')
    .eq('id', params.stayId)
    .single()

  return {
    title: data?.title ? `Logistique · ${data.title}` : 'Logistique',
  }
}

export default async function LogisticsPage({ params }: Props) {
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

  const [sectionsResult, itemsResult, guestsResult] = await Promise.all([
    supabase
      .from('logistics_sections')
      .select('*')
      .eq('stay_id', stayId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true }),

    supabase
      .from('logistics_items')
      .select('*')
      .eq('stay_id', stayId)
      .order('created_at', { ascending: true }),

    supabase
      .from('guests_summary')
      .select('id, first_name, last_name, color, linked_user_id, linked_user_avatar_url, food_preferences')
      .eq('stay_id', stayId)
      .neq('status', 'cancelled')
      .order('first_name', { ascending: true }),
  ])

  const sections = (sectionsResult.data ?? []) as LogisticsSection[]
  const items = (itemsResult.data ?? []) as LogisticsItem[]
  const guests = (guestsResult.data ?? []) as LogisticsGuest[]

  const currentGuest = guests.find((guest) => guest.linked_user_id === user.id) ?? null

  const initialSections: LogisticsSectionWithItems[] = sections.map((section) => ({
    ...section,
    items: items.filter((item) => item.section_id === section.id),
  }))

  return (
    <StayLayout stay={typedStay}>
      <LogisticsPageClient
        stayId={stayId}
        isEnabled={true}
        initialSections={initialSections}
        guests={guests}
        currentGuestId={currentGuest?.id ?? null}
      />
    </StayLayout>
  )
}
