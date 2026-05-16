'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { guestsService } from '@/core/guests/services/guests.service'
import { GuestForm } from '@/core/guests/components/GuestForm'
import type { GuestSummary } from '@/shared/types/database.types'
import '../join.css'

type Step = 'loading' | 'linked-guest' | 'no-guest' | 'done' | 'error'

export default function JoinCompleteClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const stayId = searchParams.get('stayId')
  const guestId = searchParams.get('guestId')

  const [step, setStep] = useState<Step>('loading')
  const [guest, setGuest] = useState<GuestSummary | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!stayId) {
      setError('Paramètres manquants.')
      setStep('error')
      return
    }
    init()
  }, [stayId, guestId])

  async function init() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    setUserId(user.id)

    if (guestId) {
      try {
        const guests = await guestsService.getGuests(stayId!)
        const linked = guests.find(g => g.id === guestId) ?? null
        setGuest(linked)
        setStep('linked-guest')
      } catch {
        setStep('no-guest')
      }
    } else {
      setStep('no-guest')
    }
  }

  function handleDone() {
    setStep('done')
    setTimeout(() => router.push(`/stays/${stayId}`), 1500)
  }

  function handleSkip() {
    router.push(`/stays/${stayId}`)
  }

  return (
    <div className="join-page">
      <div className="join-card" style={{ maxWidth: '520px' }}>

        {step === 'loading' && (
          <div className="join-state">
            <div className="join-spinner" />
            <p className="join-hint">Chargement…</p>
          </div>
        )}

        {step === 'linked-guest' && guest && (
          <div className="join-state" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
            <div style={{ width: '100%' }}>
              <div className="join-icon" style={{ textAlign: 'center', width: '100%' }}>🎉</div>
              <h1 className="join-title" style={{ textAlign: 'center', width: '100%' }}>Bienvenue !</h1>
              <p className="join-subtitle" style={{ textAlign: 'center', width: '100%', marginBottom: '1.5rem' }}>
                Une fiche a déjà été créée pour vous. Vérifiez et complétez vos informations.
              </p>
              <GuestForm
                stayId={stayId!}
                guest={guest}
                onSuccess={handleDone}
                onCancel={handleSkip}
              />
            </div>
          </div>
        )}

        {step === 'no-guest' && (
          <div className="join-state" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
            <div style={{ width: '100%' }}>
              <div className="join-icon" style={{ textAlign: 'center', width: '100%' }}>👋</div>
              <h1 className="join-title" style={{ textAlign: 'center', width: '100%' }}>Créez votre fiche</h1>
              <p className="join-subtitle" style={{ textAlign: 'center', width: '100%', marginBottom: '1.5rem' }}>
                Complétez votre profil pour que les organisateurs puissent vous retrouver.
              </p>
              <GuestForm
                stayId={stayId!}
                linkedUserId={userId ?? undefined}
                onSuccess={handleDone}
                onCancel={handleSkip}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="join-state">
            <div className="join-icon">✅</div>
            <h1 className="join-title">C&apos;est tout bon !</h1>
            <p className="join-subtitle">Redirection vers le séjour…</p>
          </div>
        )}

        {step === 'error' && (
          <div className="join-state">
            <div className="join-icon">😕</div>
            <h1 className="join-title">Erreur</h1>
            <p className="join-subtitle">{error}</p>
            <button className="btn-secondary" onClick={() => router.push('/')}>
              Retour à l&apos;accueil
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
