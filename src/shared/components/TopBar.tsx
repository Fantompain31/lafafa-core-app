'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const HIDDEN_ON = ['/auth/login', '/auth/register', '/join']

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()

  // Masquer sur les pages auth et join
  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="topbar">
      <span className="topbar-logo">La Fafa</span>
      <button className="topbar-signout" onClick={handleSignOut}>
        Déconnexion
      </button>
    </header>
  )
}
