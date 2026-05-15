import Link from 'next/link'
import type { MyStay } from '@/shared/types/database.types'
import { formatDateRange } from '@/shared/utils/dates'

export function StayHome({ stay, score }: { stay: MyStay; score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Préparation</h2>
          <span className="text-2xl font-medium text-[var(--stay-primary)]">{safeScore}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-[var(--stay-primary)] transition-all" style={{ width: `${safeScore}%` }} />
        </div>
      </div>

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        <InfoRow label="Dates" value={stay.start_date && stay.end_date ? formatDateRange(stay.start_date, stay.end_date) : 'À définir'} />
        <InfoRow label="Lieu" value={stay.location_name ?? 'À définir'} />
        <InfoRow label="Invités" value={`${stay.confirmed_guest_count} confirmé(s) / ${stay.guest_count} au total`} />
        <InfoRow label="Alertes" value={stay.open_alerts_count > 0 ? `${stay.open_alerts_count} ouverte(s)` : 'Aucune alerte ouverte'} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink href={`/stays/${stay.id}/guests`} title="Invités" description="Ajouter et gérer les participants." />
        <QuickLink href={`/stays/${stay.id}/settings`} title="Paramètres" description="Modifier les informations du séjour." />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-right text-sm font-medium text-neutral-900">{value}</span>
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm">
      <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </Link>
  )
}
