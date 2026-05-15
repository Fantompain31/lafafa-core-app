import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateStayForm } from '@/core/stays/create/CreateStayForm'

export const metadata = { title: 'Nouveau séjour' }

export default async function CreateStayPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-[var(--surface-warm)]">
      <header className="border-b border-neutral-200 bg-white px-4 py-4"><h1 className="text-lg font-medium text-neutral-900">Nouveau séjour</h1></header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <p className="mb-6 text-sm text-neutral-500">Créer un séjour avec une date et un lieu définis.</p>
        <div className="rounded-xl border border-neutral-200 bg-white p-6"><CreateStayForm /></div>
      </main>
    </div>
  )
}
