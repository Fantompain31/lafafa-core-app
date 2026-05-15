'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MyStay } from '@/shared/types/database.types'

const nav = [
  { label: 'Accueil', href: '' },
  { label: 'Invités', href: '/guests' },
  { label: 'Paramètres', href: '/settings' },
]

export function StayLayout({ stay, children }: { stay: MyStay; children: React.ReactNode }) {
  const pathname = usePathname()
  const baseHref = `/stays/${stay.id}`

  return (
    <div className="min-h-screen bg-[var(--surface-warm)]">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-neutral-700">← Mes séjours</Link>
            <h1 className="mt-1 text-lg font-medium text-neutral-900">{stay.title}</h1>
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-4 pb-3">
          {nav.map(item => {
            const href = `${baseHref}${item.href}`
            const isActive = item.href === ''
              ? pathname === baseHref
              : pathname === href || pathname.startsWith(`${href}/`)

            return (
              <Link
                key={item.href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'border-[var(--stay-primary)] bg-[var(--stay-primary)] text-[var(--stay-primary-text)]'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
