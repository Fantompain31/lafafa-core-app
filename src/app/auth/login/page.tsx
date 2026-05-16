import { Suspense } from 'react'
import LoginClient from './LoginClient'

export const metadata = {
  title: 'Connexion',
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  )
}

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-warm)] px-4">
      <div className="w-full max-w-sm text-center text-sm text-neutral-500">
        Chargement…
      </div>
    </div>
  )
}
