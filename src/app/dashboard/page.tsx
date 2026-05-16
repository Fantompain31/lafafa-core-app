import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StayCard } from '@/core/stays/components/StayCard'
import PendingInviteRedirect from './PendingInviteRedirect'
import type { MyStay } from '@/shared/types/database.types'

export const metadata = { title: 'Mes séjours' }

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stays, error } = await supabase.from('my_stays').select('*')
  if (error) console.error('Erreur chargement séjours:', error.message)

  const myStays = (stays ?? []) as MyStay[]
  const activeStays = myStays.filter(s => s.status !== 'archived')
  const archivedStays = myStays.filter(s => s.status === 'archived')

  return (
    <div className="min-h-screen bg-[var(--surface-warm)]">
      {/* Redirige automatiquement si un token d'invitation est en attente */}
      <PendingInviteRedirect />

      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4">
        <h1 className="text-xl font-medium text-neutral-900">La Fafa</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-700">Déconnexion</button>
        </form>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-neutral-900">Mes séjours</h2>
          <Link href="/stays/create" className="rounded-lg bg-[var(--stay-primary)] px-4 py-2 text-sm font-medium text-[var(--stay-primary-text)] transition-opacity hover:opacity-90">
            + Nouveau séjour
          </Link>
        </div>

        {activeStays.length === 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center">
            <p className="mb-4 text-sm text-neutral-500">Vous n&apos;avez pas encore de séjour.</p>
            <Link href="/stays/create" className="rounded-lg bg-[var(--stay-primary)] px-4 py-2 text-sm font-medium text-[var(--stay-primary-text)] transition-opacity hover:opacity-90">
              Créer mon premier séjour
            </Link>
          </div>
        )}

        {activeStays.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeStays.map(stay => <StayCard key={stay.id} stay={stay} />)}
          </div>
        )}

        {archivedStays.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-neutral-500">Archivés</h3>
            <div className="grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2">
              {archivedStays.map(stay => <StayCard key={stay.id} stay={stay} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
