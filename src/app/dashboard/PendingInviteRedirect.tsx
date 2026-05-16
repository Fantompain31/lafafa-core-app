'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PendingInviteRedirect() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('pending_invite_token')
    if (token) {
      // Ne pas supprimer ici — sera supprimé après acceptation dans JoinPageClient
      router.push(`/join?token=${token}`)
    }
  }, [])

  return null
}
