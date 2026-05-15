'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import './InviteGuestModal.css'

type Tab = 'email' | 'link'

interface Props {
  stayId: string
  guestId?: string
  onClose: () => void
}

export default function InviteGuestModal({ stayId, guestId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin

  async function handleSendEmail() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: token, error: rpcError } = await supabase.rpc('create_stay_invitation', {
      p_stay_id: stayId,
      p_email: email.trim(),
      p_guest_id: guestId ?? null,
      p_expires_in_days: 7,
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    // TODO : envoyer l'email via un service (Resend, etc.)
    // Pour l'instant on affiche le lien à copier
    const inviteUrl = `${appUrl}/join?token=${token}`
    setGeneratedLink(inviteUrl)
    setEmailSent(true)
    setLoading(false)
  }

  async function handleGenerateLink() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: token, error: rpcError } = await supabase.rpc('create_guest_access_link', {
      p_stay_id: stayId,
      p_label: 'Lien partageable',
      p_guest_id: guestId ?? null,
      p_expires_in_days: null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    const linkUrl = `${appUrl}/join?token=${token}`
    setGeneratedLink(linkUrl)
    setLoading(false)
  }

  async function handleCopy() {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setGeneratedLink(null)
    setEmailSent(false)
    setEmail('')
    setError(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Inviter quelqu'un</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'email' ? 'active' : ''}`}
            onClick={() => { setTab('email'); handleReset() }}
          >
            ✉️ Par email
          </button>
          <button
            className={`modal-tab ${tab === 'link' ? 'active' : ''}`}
            onClick={() => { setTab('link'); handleReset() }}
          >
            🔗 Lien partageable
          </button>
        </div>

        {/* Contenu */}
        <div className="modal-body">

          {/* Erreur */}
          {error && (
            <div className="modal-error">{error}</div>
          )}

          {/* Tab email */}
          {tab === 'email' && !generatedLink && (
            <div className="modal-section">
              <p className="modal-desc">
                Entrez l'adresse email de la personne à inviter. Elle recevra un lien pour rejoindre le séjour.
              </p>
              <label className="input-label" htmlFor="invite-email">Adresse email</label>
              <input
                id="invite-email"
                type="email"
                className="input"
                placeholder="prenom@exemple.fr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                autoFocus
              />
              <button
                className="btn-primary"
                onClick={handleSendEmail}
                disabled={loading || !email.trim()}
              >
                {loading ? 'Génération…' : 'Envoyer l\'invitation'}
              </button>
            </div>
          )}

          {/* Tab email - après génération */}
          {tab === 'email' && generatedLink && (
            <div className="modal-section">
              <div className="modal-success-badge">
                ✅ Invitation générée
              </div>
              <p className="modal-desc">
                Copiez ce lien et envoyez-le à <strong>{email}</strong>.
              </p>
              <div className="link-box">
                <span className="link-text">{generatedLink}</span>
                <button className="btn-copy" onClick={handleCopy}>
                  {copied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              <button className="btn-ghost" onClick={handleReset}>
                Inviter une autre personne
              </button>
            </div>
          )}

          {/* Tab lien partageable */}
          {tab === 'link' && !generatedLink && (
            <div className="modal-section">
              <p className="modal-desc">
                Générez un lien unique à partager par WhatsApp, SMS, Messenger ou tout autre canal.
              </p>
              <div className="share-icons">
                <span title="WhatsApp">💬</span>
                <span title="SMS">📱</span>
                <span title="Messenger">💙</span>
                <span title="Instagram">📸</span>
              </div>
              <button
                className="btn-primary"
                onClick={handleGenerateLink}
                disabled={loading}
              >
                {loading ? 'Génération…' : 'Générer un lien'}
              </button>
            </div>
          )}

          {/* Tab lien - après génération */}
          {tab === 'link' && generatedLink && (
            <div className="modal-section">
              <div className="modal-success-badge">
                🔗 Lien prêt à partager
              </div>
              <p className="modal-desc">
                Ce lien est valable jusqu'à révocation. Partagez-le avec qui vous voulez.
              </p>
              <div className="link-box">
                <span className="link-text">{generatedLink}</span>
                <button className="btn-copy" onClick={handleCopy}>
                  {copied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              <div className="share-actions">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent('Rejoins notre séjour sur La Fafa ! ' + generatedLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-share whatsapp"
                >
                  WhatsApp
                </a>
                <a
                  href={`sms:?body=${encodeURIComponent('Rejoins notre séjour ! ' + generatedLink)}`}
                  className="btn-share sms"
                >
                  SMS
                </a>
              </div>
              <button className="btn-ghost" onClick={handleReset}>
                Générer un nouveau lien
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
