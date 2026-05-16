'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/core/auth/auth.service'
import type { RegisterFormValues } from '@/core/auth/auth.types'

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'

  const [values, setValues] = useState<RegisterFormValues>({
    firstName: '',
    lastName:  '',
    email:     '',
    password:  '',
  })
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function update(field: keyof RegisterFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues(v => ({ ...v, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authService.signUpWithEmail(
        values.email,
        values.password,
        values.firstName,
        values.lastName,
        redirectTo !== '/dashboard' ? redirectTo : undefined,
      )
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-warm)] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-xl border border-neutral-200 p-8">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-neutral-900 mb-2">Vérifiez votre email</h2>
            <p className="text-sm text-neutral-500">
              Un lien de confirmation a été envoyé à <strong>{values.email}</strong>.
              Cliquez sur le lien pour activer votre compte.
            </p>
            {redirectTo !== '/dashboard' && (
              <p className="mt-3 text-xs text-neutral-400">
                Après confirmation, vous serez redirigé automatiquement vers votre invitation.
              </p>
            )}
            <Link
              href={`/auth/login${redirectTo !== '/dashboard' ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
              className="mt-6 block text-sm text-[var(--stay-primary)] font-medium hover:underline"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-warm)] px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-medium text-neutral-900 mb-1">La Fafa</h1>
          <p className="text-sm text-neutral-500">Créer un compte</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-6 flex flex-col gap-4">

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firstName" className="text-sm font-medium text-neutral-700">Prénom</label>
              <input
                id="firstName"
                type="text"
                required
                value={values.firstName}
                onChange={update('firstName')}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)] focus:border-transparent"
                placeholder="Alice"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lastName" className="text-sm font-medium text-neutral-700">Nom</label>
              <input
                id="lastName"
                type="text"
                required
                value={values.lastName}
                onChange={update('lastName')}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)] focus:border-transparent"
                placeholder="Dupont"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-neutral-700">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={update('email')}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)] focus:border-transparent"
              placeholder="alice@exemple.fr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-neutral-700">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={values.password}
              onChange={update('password')}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)] focus:border-transparent"
              placeholder="8 caractères minimum"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--stay-primary)] text-[var(--stay-primary-text)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-4">
          Déjà un compte ?{' '}
          <Link
            href={`/auth/login${redirectTo !== '/dashboard' ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
            className="text-[var(--stay-primary)] font-medium hover:underline"
          >
            Se connecter
          </Link>
        </p>

      </div>
    </div>
  )
}
