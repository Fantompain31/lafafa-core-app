'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './account-shell.css'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Mes séjours', icon: '🏠' },
  { href: '/account/profile', label: 'Mon profil', icon: '👤' },
  { href: '/account/profile/lists', label: 'Mes listes', icon: '✅' },
]

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="account-shell">
      <aside className="account-sidebar">
        <div className="account-sidebar-brand">
          <span className="account-sidebar-logo">La Fafa</span>
          <small>Compte</small>
        </div>

        <nav className="account-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`account-sidebar-link${pathname === item.href || pathname.startsWith(`${item.href}/`) ? ' active' : ''}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <button type="button" className="account-sidebar-signout" onClick={handleSignOut}>
          <span>↩</span>
          Déconnexion
        </button>
      </aside>

      <main className="account-shell-main">
        <div className="account-mobile-nav">
          <Link href="/dashboard">Mes séjours</Link>
          <Link href="/account/profile">Profil</Link>
          <Link href="/account/profile/lists">Mes listes</Link>
        </div>
        {children}
      </main>
    </div>
  )
}
