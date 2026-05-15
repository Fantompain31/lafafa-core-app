import Link from 'next/link'
import type { MyStay } from '@/shared/types/database.types'
import { formatDateRange } from '@/shared/utils/dates'

export function StayCard({ stay }: { stay: MyStay }) {
  return (
    <Link href={`/stays/${stay.id}`} className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-neutral-900">{stay.title}</h3>
          <p className="mt-1 text-xs text-neutral-500">
            {stay.start_date && stay.end_date ? formatDateRange(stay.start_date, stay.end_date) : 'Dates à définir'}
          </p>
        </div>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{stay.my_role}</span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
        <span>{stay.confirmed_guest_count}/{stay.guest_count} confirmés</span>
        {stay.open_alerts_count > 0 && <span className="text-amber-700">{stay.open_alerts_count} alerte(s)</span>}
      </div>
    </Link>
  )
}
