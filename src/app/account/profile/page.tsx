import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfilePageClient from '@/core/profiles/components/ProfilePageClient'
import type { UserProfile } from '@/core/profiles/services/profile.service'

export const metadata = { title: 'Mon profil' }

export default async function ProfilePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, avatar_url, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const safeProfile: UserProfile = profile ?? {
    id: user.id,
    email: user.email ?? '',
    first_name: null,
    last_name: null,
    avatar_url: null,
  }

  return <ProfilePageClient initialProfile={safeProfile} />
}
