'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GuestForm } from '@/core/guests/components/GuestForm'
import type { GuestSummary } from '@/shared/types/database.types'

type Props = {
  stayId: string
  userId: string
  guest: GuestSummary | null
  stayStartDate?: string | null
  stayEndDate?: string | null
}

export default function MyStayGuestPageClient({
  stayId,
  userId,
  guest,
  stayStartDate = null,
  stayEndDate = null,
}: Props) {
  const router = useRouter()
  const [success, setSuccess] = useState(false)

  function handleSuccess() {
    setSuccess(true)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--stay-primary)]">
            Fiche séjour
          </p>
          <h2 className="text-base font-semibold text-neutral-900">Ma fiche dans ce séjour</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Ici, vous pouvez choisir le nom affiché uniquement dans ce séjour. Pratique pour mettre un pseudo entre amis, tout en gardant votre vrai profil global ailleurs.
          </p>
        </div>

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Fiche enregistrée.
          </div>
        )}

        <GuestForm
          stayId={stayId}
          stayStartDate={stayStartDate}
          stayEndDate={stayEndDate}
          guest={guest ?? undefined}
          linkedUserId={guest ? undefined : userId}
          onSuccess={handleSuccess}
          onCancel={() => router.push(`/stays/${stayId}`)}
        />
      </div>
    </div>
  )
}
