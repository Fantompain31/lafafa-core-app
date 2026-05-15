'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './join.css'

type Step = 'loading' | 'unauthenticated' | 'ready' | 'accepting' | 'error'

export default function JoinPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [step, setStep] = useState<Step>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStep('error')
      setErrorMsg('Lien invalide ou incomplet.')
      return
    }
    checkAuth()
  }, [token])

  async function checkAuth() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setStep(user ? 'ready' : 'unauthenticated')
  }

  async function handleAccept() {
    if (!token) return
    setStep('accepting')
    const supabase = createClient()

    const { data, error } = await supabase.rpc('accept_stay_invitation', { p_token: token })

    if (error) {
      setStep('error')
      setErrorMsg(error.message ?? 'Une erreur est survenue.')
      return
    }

    // Redirige vers la page de complétion de fiche
    const params = new URLSearchParams({ stayId: data.stay_id })
    if (data.guest_id) params.set('guestId', data.guest_id)
    router.push(`/join/complete?${params.toString()}`)
  }

  function handleLogin() {
    const redirectTo = encodeURIComponent(`/join?token=${token}`)
    router.push(`/auth/login?redirectTo=${redirectTo}`)
  }

  function handleRegister() {
    const redirectTo = encodeURIComponent(`/join?token=${token}`)
    router.push(`/auth/register?redirectTo=${redirectTo}`)
  }

  return (
    <div className="join-page">
      <div className="join-card">

        {step === 'loading' && (
          <div className="join-state">
            <div className="join-spinner" />
            <p className="join-hint">Vérification du lien…</p>
          </div>
        )}

        {step === 'unauthenticated' && (
          <div className="join-state">
            <div className="join-icon">🏡</div>
            <h1 className="join-title">Vous êtes invité !</h1>
            <p className="join-subtitle">
              Connectez-vous ou créez un compte pour rejoindre le séjour.
            </p>
            <div className="join-actions">
              <button className="btn-primary" onClick={handleLogin}>Se connecter</button>
              <button className="btn-secondary" onClick={handleRegister}>Créer un compte</button>
            </div>
          </div>
        )}

        {step === 'ready' && (
          <div className="join-state">
            <div className="join-icon">🎉</div>
            <h1 className="join-title">Vous êtes invité !</h1>
            <p className="join-subtitle">
              Cliquez ci-dessous pour rejoindre le séjour.
            </p>
            <div className="join-actions">
              <button className="btn-primary" onClick={handleAccept}>Rejoindre le séjour</button>
            </div>
          </div>
        )}

        {step === 'accepting' && (
          <div className="join-state">
            <div className="join-spinner" />
            <p className="join-hint">Vous rejoignez le séjour…</p>
          </div>
        )}

        {step === 'error' && (
          <div className="join-state">
            <div className="join-icon">😕</div>
            <h1 className="join-title">Lien invalide</h1>
            <p className="join-subtitle">{errorMsg}</p>
            <div className="join-actions">
              <button className="btn-secondary" onClick={() => router.push('/')}>
                Retour à l&apos;accueil
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
