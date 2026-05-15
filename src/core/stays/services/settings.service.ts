import { createClient } from '@/lib/supabase/client'
import type { StayEnabledFeature, StaySettings } from '@/shared/types/database.types'
import { omitUndefined } from '@/shared/utils/object'

export const settingsService = {
  async getSettings(stayId: string): Promise<StaySettings | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('stay_settings')
      .select('*')
      .eq('stay_id', stayId)
      .single()
    if (error) return null
    return data as StaySettings
  },

  async updateSettings(stayId: string, payload: Partial<{
    defaultCurrency: string
    guestCanInvite: boolean
    guestCanSeeBudget: boolean
    guestCanSeeGuests: boolean
    guestCanAddExpenses: boolean
    primaryColor: string | null
    accentColor: string | null
  }>) {
    const supabase = createClient()
    const updatePayload = omitUndefined({
      default_currency: payload.defaultCurrency,
      guest_can_invite: payload.guestCanInvite,
      guest_can_see_budget: payload.guestCanSeeBudget,
      guest_can_see_guests: payload.guestCanSeeGuests,
      guest_can_add_expenses: payload.guestCanAddExpenses,
      primary_color: payload.primaryColor,
      accent_color: payload.accentColor,
    })

    const { error } = await supabase.from('stay_settings').update(updatePayload).eq('stay_id', stayId)
    if (error) throw new Error(error.message)
  },

  async setFeatureEnabled(stayId: string, featureKey: string, enabled: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('stay_enabled_features')
      .upsert({ stay_id: stayId, feature_key: featureKey, is_enabled: enabled }, { onConflict: 'stay_id,feature_key' })
    if (error) throw new Error(error.message)
  },

  async getFeatures(stayId: string): Promise<StayEnabledFeature[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('stay_enabled_features')
      .select('*')
      .eq('stay_id', stayId)
      .order('feature_key')
    if (error) throw new Error(error.message)
    return (data ?? []) as StayEnabledFeature[]
  },
}
