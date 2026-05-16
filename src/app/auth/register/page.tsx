import { Suspense } from 'react'
import RegisterClient from './RegisterClient'

export const metadata = {
  title: 'Inscription',
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterClient />
    </Suspense>
  )
}

function RegisterFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-warm)] px-4">
      <div className="w-full max-w-sm text-center text-sm text-neutral-500">
        Chargement…
      </div>
    </div>
  )
}
