import { Suspense } from 'react'
import JoinPageClient from './JoinPageClient'

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinSkeleton />}>
      <JoinPageClient />
    </Suspense>
  )
}

function JoinSkeleton() {
  return (
    <div className="join-page">
      <div className="join-card skeleton-card">
        <div className="skeleton skeleton-icon" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-btn" />
      </div>
    </div>
  )
}
