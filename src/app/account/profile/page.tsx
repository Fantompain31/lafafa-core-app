import Link from 'next/link'
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

  return (
    <div className="flex flex-col gap-4">
      <ProfilePageClient initialProfile={safeProfile} />

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Listes personnelles
            </p>
            <h2 className="mt-1 text-base font-semibold text-neutral-900">
              Mes listes modèles
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Créez des listes privées réutilisables dans vos séjours : week-end, plage, mariage, sport…
            </p>
          </div>

          <Link
            href="/account/profile/lists"
            className="rounded-lg border border-neutral-200 px-4 py-2 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Gérer mes listes
          </Link>
        </div>
      </div>
    </div>
  )
}
