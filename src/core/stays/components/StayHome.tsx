'use client'

import { useRouter } from 'next/navigation'
import type { MyStay, GuestSummary, MemberRole } from '@/shared/types/database.types'
import './StayHome.css'

type Props = {
  stay: MyStay
  score: number
  myGuest: GuestSummary | null
  participants: GuestSummary[]
  myRole: MemberRole
}

export function StayHome({ stay, score, myGuest, participants, myRole }: Props) {
  const router = useRouter()
  const isOrganizer = myRole === 'owner' || myRole === 'co_organizer'
  const safeScore = Math.max(0, Math.min(100, Math.round(score)))
  const confirmed = participants.filter(p => p.status === 'confirmed')
  const total = participants.length

  const startDate = stay.start_date ? new Date(stay.start_date) : null
  const endDate = stay.end_date ? new Date(stay.end_date) : null
  const today = new Date()
  const daysUntil = startDate
    ? Math.max(0, Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : null

  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const fmtDay = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long' })

  function getInitials(g: GuestSummary) {
    return [g.first_name[0], g.last_name?.[0]].filter(Boolean).join('').toUpperCase()
  }

  return (
    <div className="sh">

      {/* HERO */}
      <div className="sh-hero">
        <div className="sh-hero-cover" />
        <div className="sh-hero-body">
          <div className="sh-hero-eyebrow">
            <span className="sh-badge-confirmed">✓ Confirmé</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Accueil du séjour</span>
          </div>
          <h1 className="sh-hero-title">{stay.title}</h1>
          {stay.location_name && (
            <p className="sh-hero-location">
              <IconPin />
              {stay.location_name}
            </p>
          )}
          {startDate && endDate && (
            <div className="sh-dates">
              <div className="sh-date-box">
                <span className="sh-date-label">Arrivée</span>
                <span className="sh-date-value">{fmt(startDate)}</span>
                <span className="sh-date-day">{fmtDay(startDate)}</span>
              </div>
              <div className="sh-date-arrow"><IconArrow /></div>
              <div className="sh-date-box sh-date-box-right">
                <span className="sh-date-label">Départ</span>
                <span className="sh-date-value">{fmt(endDate)}</span>
                <span className="sh-date-day">{fmtDay(endDate)}</span>
              </div>
              {daysUntil !== null && daysUntil > 0 && (
                <div className="sh-countdown">
                  <span className="sh-countdown-dot" />
                  Dans {daysUntil} jours
                </div>
              )}
              {daysUntil === 0 && (
                <div className="sh-countdown">
                  <span className="sh-countdown-dot" />
                  C&apos;est aujourd&apos;hui !
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Score préparation — organisateurs uniquement */}
      {isOrganizer && (
        <div className="sh-score">
          <div className="sh-score-row">
            <span className="sh-score-label">Préparation</span>
            <span className="sh-score-value">{safeScore}%</span>
          </div>
          <div className="sh-score-bar">
            <div className="sh-score-fill" style={{ width: `${safeScore}%` }} />
          </div>
        </div>
      )}

      <div className="sh-grid">

        {/* Colonne principale */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* MA FICHE */}
          <div className="sh-card">
            <div className="sh-card-header">
              <div className="sh-card-title-row">
                {myGuest ? (
                  <div className="sh-avatar" style={{ background: myGuest.color ?? '#C4A882' }}>
                    {myGuest.linked_user_avatar_url
                      ? <img src={myGuest.linked_user_avatar_url} alt="" />
                      : getInitials(myGuest)}
                  </div>
                ) : (
                  <div className="sh-avatar sh-avatar-empty">?</div>
                )}
                <div>
                  <p className="sh-section-label">Ma fiche</p>
                  <p className="sh-card-name">
                    {myGuest
                      ? `${myGuest.first_name}${myGuest.last_name ? ' ' + myGuest.last_name : ''}`
                      : 'Fiche non créée'}
                  </p>
                </div>
              </div>
              <button
                className="sh-btn-outline"
                onClick={() => myGuest
                  ? router.push(`/stays/${stay.id}/guests`)
                  : router.push(`/join/complete?stayId=${stay.id}`)
                }
              >
                <IconEdit />
                {myGuest ? 'Modifier' : 'Créer ma fiche'}
              </button>
            </div>

            {myGuest ? (
              <div className="sh-meta-grid">
                <MetaCell label="Catégorie" value={
                  myGuest.category === 'adult' ? 'Adulte'
                  : myGuest.category === 'child' ? 'Enfant' : 'Bébé'
                } />
                {(myGuest.food_preferences as any)?.diet && (
                  <MetaCell label="Régime" value={(myGuest.food_preferences as any).diet} />
                )}
                {myGuest.arrival_at && (
                  <MetaCell label="Arrivée" value={new Date(myGuest.arrival_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} />
                )}
                {myGuest.departure_at && (
                  <MetaCell label="Départ" value={new Date(myGuest.departure_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} />
                )}
                {myGuest.notes && (
                  <MetaCell label="Notes" value={myGuest.notes} wide />
                )}
              </div>
            ) : (
              <p className="sh-empty-hint">
                Créez votre fiche pour que l&apos;organisateur puisse vous inclure dans la planification.
              </p>
            )}
          </div>

          {/* Placeholders modules */}
          <PlaceholderCard title="Programme" icon={<IconProgram />}
            desc="Les activités, randos et moments libres apparaîtront ici dès que l'organisateur les aura ajoutés." />
          <PlaceholderCard title="Repas" icon={<IconMeal />}
            desc="Qui cuisine, qui fait les courses, qui dîne. Bientôt, vous pourrez vous inscrire sur les créneaux." />
          <PlaceholderCard title="Budget" icon={<IconBudget />}
            desc="Les dépenses partagées et votre solde apparaîtront ici. Pour l'instant, rien à régler." />
        </div>

        {/* Sidebar */}
        <div className="sh-sidebar">

          {/* LE GROUPE */}
          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <p className="sh-section-label">Le groupe</p>
                <p className="sh-card-name">{confirmed.length} confirmé{confirmed.length > 1 ? 's' : ''}</p>
                <p style={{ fontSize: 12, color: '#a08870', margin: '2px 0 0' }}>
                  sur {total} participant{total > 1 ? 's' : ''}
                </p>
              </div>
              {isOrganizer && (
                <button className="sh-btn-outline" onClick={() => router.push(`/stays/${stay.id}/guests`)}>
                  <IconPlus /> Inviter
                </button>
              )}
            </div>

            <div className="sh-participants">
              {participants.slice(0, 8).map(p => (
                <div key={p.id} className="sh-participant">
                  <div className="sh-participant-avatar" style={{ background: p.color ?? '#C4A882' }}>
                    {p.linked_user_avatar_url
                      ? <img src={p.linked_user_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : getInitials(p)}
                  </div>
                  <span className={`sh-participant-name ${p.linked_user_id ? 'sh-participant-name-me' : ''}`}>
                    {p.first_name}
                  </span>
                </div>
              ))}
            </div>

            {total > 0 && (
              <>
                <div className="sh-progress-bar">
                  <div className="sh-progress-fill" style={{ width: `${(confirmed.length / total) * 100}%` }} />
                </div>
                <div className="sh-progress-meta">
                  <span>{confirmed.length}/{total} confirmés</span>
                  <span>{Math.round((confirmed.length / total) * 100)}%</span>
                </div>
              </>
            )}
          </div>

          {/* Infos séjour — organisateurs */}
          {isOrganizer && (
            <div className="sh-card">
              <p className="sh-section-label">Informations</p>
              <InfoRow label="Alertes" value={
                stay.open_alerts_count > 0
                  ? `${stay.open_alerts_count} ouverte(s)`
                  : 'Aucune alerte'
              } />
              <InfoRow label="Membres actifs" value={`${stay.active_member_count}`} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Sous-composants ───

function MetaCell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`sh-meta-cell${wide ? ' sh-meta-cell-wide' : ''}`}>
      <div className="sh-meta-cell-label">{label}</div>
      <div className="sh-meta-cell-value">{value}</div>
    </div>
  )
}

function PlaceholderCard({ title, icon, desc }: { title: string; icon: React.ReactNode; desc: string }) {
  return (
    <div className="sh-placeholder">
      <div className="sh-placeholder-header">
        <div className="sh-placeholder-icon">{icon}</div>
        <span className="sh-placeholder-title">{title}</span>
        <span className="sh-placeholder-badge">À venir</span>
      </div>
      <p className="sh-placeholder-desc">{desc}</p>
      <div className="sh-placeholder-strip" />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 10, borderBottom: '0.5px solid rgba(196,168,130,0.15)' }}>
      <span style={{ color: '#7a6a5a' }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#2c2420' }}>{value}</span>
    </div>
  )
}

// ─── Icônes ───
const IconPin = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
const IconArrow = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>
const IconEdit = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4l6 6-11 11H3v-6L14 4z"/></svg>
const IconPlus = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconProgram = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6.5 12 12 16 14"/></svg>
const IconMeal = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v8a3 3 0 0 0 3 3v7"/><line x1="8" y1="3" x2="8" y2="9"/><path d="M16 3c-1.5 0-2.5 1.5-2.5 4s1 4 2.5 4v10"/></svg>
const IconBudget = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><line x1="3" y1="10.5" x2="21" y2="10.5"/><circle cx="17" cy="15" r="1.4"/></svg>
