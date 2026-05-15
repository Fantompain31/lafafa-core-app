import { createClient } from '@/lib/supabase/client'
import type { MyStay } from '@/shared/types/database.types'
import { emptyToNull, omitUndefined } from '@/shared/utils/object'
import { assertDateRange, requireNonEmpty } from '@/shared/utils/validation'

export const staysService = {
  async getMyStays(): Promise<MyStay[]> {
    const supabase = createClient()
    const { data, error } = await supabase.from('my_stays').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []) as MyStay[]
  },

  async getStayById(stayId: string): Promise<MyStay> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('my_stays')
      .select('*')
      .eq('id', stayId)
      .single()
    if (error) throw new Error(error.message)
    return data as MyStay
  },

  async createStay(payload: {
  title: string
  description?: string | null
  startDate: string
  endDate: string
  locationName: string
  locationAddress?: string | null
  locationUrl?: string | null
  timezone?: string
}) {
  const title = requireNonEmpty(payload.title, 'Nom du séjour')
  const locationName = requireNonEmpty(payload.locationName, 'Lieu')
  assertDateRange(payload.startDate, payload.endDate)

  const supabase = createClient()

  const { data: stayId, error } = await supabase.rpc('create_stay', {
    p_name: title,
    p_destination: locationName,
    p_start_date: payload.startDate,
    p_end_date: payload.endDate,
    p_description: emptyToNull(payload.description ?? ''),
    p_color: 'sand',
  })

  if (error) throw new Error(error.message)
  return { id: stayId as string }
},

  async updateStay(stayId: string, payload: {
    title?: string
    description?: string | null
    startDate?: string | null
    endDate?: string | null
    locationName?: string | null
    locationAddress?: string | null
    locationUrl?: string | null
  }) {
    const nextTitle = payload.title === undefined ? undefined : requireNonEmpty(payload.title, 'Nom du séjour')
    const nextStartDate = payload.startDate ?? undefined
    const nextEndDate = payload.endDate ?? undefined
    assertDateRange(nextStartDate, nextEndDate)

    const supabase = createClient()
    const updatePayload = omitUndefined({
      title: nextTitle,
      description: payload.description === undefined ? undefined : emptyToNull(payload.description ?? ''),
      start_date: payload.startDate === undefined ? undefined : payload.startDate,
      end_date: payload.endDate === undefined ? undefined : payload.endDate,
      location_name: payload.locationName === undefined ? undefined : emptyToNull(payload.locationName ?? ''),
      location_address: payload.locationAddress === undefined ? undefined : emptyToNull(payload.locationAddress ?? ''),
      location_url: payload.locationUrl === undefined ? undefined : emptyToNull(payload.locationUrl ?? ''),
    })

    const { error } = await supabase.from('stays').update(updatePayload).eq('id', stayId)
    if (error) throw new Error(error.message)
  },

  async archiveStay(stayId: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('archive_stay', { p_stay_id: stayId })
    if (error) throw new Error(error.message)
  },
}
