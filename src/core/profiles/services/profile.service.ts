import { createClient } from '@/lib/supabase/client'
import { emptyToNull } from '@/shared/utils/object'
import { requireNonEmpty } from '@/shared/utils/validation'

export type UserProfile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  created_at?: string
  updated_at?: string
}

export type UpdateProfilePayload = {
  firstName: string
  lastName?: string | null
  avatarUrl?: string | null
}

export const profileService = {
  async updateMyProfile(payload: UpdateProfilePayload) {
    const supabase = createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw new Error(userError.message)
    if (!user) throw new Error('Utilisateur non connecté')

    const firstName = requireNonEmpty(payload.firstName, 'Prénom')

    const updatePayload = {
      first_name: firstName,
      last_name: payload.lastName === undefined ? undefined : emptyToNull(payload.lastName ?? ''),
      avatar_url: payload.avatarUrl === undefined ? undefined : emptyToNull(payload.avatarUrl ?? ''),
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select('id, email, first_name, last_name, avatar_url, created_at, updated_at')
      .single()

    if (error) throw new Error(error.message)

    await supabase.auth.updateUser({
      data: {
        first_name: firstName,
        last_name: payload.lastName ?? null,
        avatar_url: payload.avatarUrl ?? null,
      },
    })

    return data as UserProfile
  },
}
