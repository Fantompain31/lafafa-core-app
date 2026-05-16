'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { profileService, type UserProfile } from '@/core/profiles/services/profile.service'
import './profile.css'

type Props = {
  initialProfile: UserProfile
}

export default function ProfilePageClient({ initialProfile }: Props) {
  const router = useRouter()

  const [firstName, setFirstName] = useState(initialProfile.first_name ?? '')
  const [lastName, setLastName] = useState(initialProfile.last_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await profileService.updateMyProfile({
        firstName,
        lastName,
        avatarUrl,
      })

      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour du profil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="profile-root">
      <div className="profile-header">
        <div>
          <p className="profile-eyebrow">Compte</p>
          <h1>Mon profil</h1>
          <p className="profile-subtitle">
            Ces informations servent de base pour vos futurs séjours. Vous pourrez garder un pseudo différent dans chaque séjour.
          </p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-preview">
          <div className="profile-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
          </div>
          <div>
            <p className="profile-name-preview">
              {firstName || lastName ? `${firstName}${lastName ? ` ${lastName}` : ''}` : 'Profil sans nom'}
            </p>
            <p className="profile-email">{initialProfile.email}</p>
          </div>
        </div>

        {error && <div className="profile-alert profile-alert-error">{error}</div>}
        {success && <div className="profile-alert profile-alert-success">Profil mis à jour.</div>}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="profile-field-row">
            <Field label="Prénom *">
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Philippe" />
            </Field>
            <Field label="Nom">
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Jalao" />
            </Field>
          </div>

          <Field label="URL de l’avatar">
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </Field>

          <div className="profile-hint">
            Pour un séjour précis, modifiez plutôt votre fiche séjour : vous pouvez y mettre un pseudo, une couleur, vos horaires, vos allergies, etc.
          </div>

          <div className="profile-actions">
            <button type="button" className="profile-btn-ghost" onClick={() => router.back()}>
              Retour
            </button>
            <button type="submit" className="profile-btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      {children}
    </label>
  )
}
