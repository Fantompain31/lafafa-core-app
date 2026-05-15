import { Suspense } from 'react'
import JoinCompleteClient from './JoinCompleteClient'

export default function JoinCompletePage() {
  return (
    <Suspense fallback={
      <div className="join-page">
        <div className="join-card">
          <div className="join-state">
            <div className="join-spinner" />
            <p className="join-hint">Chargement…</p>
          </div>
        </div>
      </div>
    }>
      <JoinCompleteClient />
    </Suspense>
  )
}
