'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { staysService } from '@/core/stays/services/stays.service'

type FormValues = {
  title: string
  description: string
  startDate: string
  endDate: string
  locationName: string
  locationAddress: string
  locationUrl: string
}

const INITIAL: FormValues = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  locationName: '',
  locationAddress: '',
  locationUrl: '',
}

export function CreateStayForm() {
  const router = useRouter()
  const [values, setValues] = useState<FormValues>(INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function update(field: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues(v => ({ ...v, [field]: e.target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const stay = await staysService.createStay({
        title: values.title,
        description: values.description,
        startDate: values.startDate,
        endDate: values.endDate,
        locationName: values.locationName,
        locationAddress: values.locationAddress,
        locationUrl: values.locationUrl,
      })
      router.push(`/stays/${stay.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-neutral-700">Nom du séjour <span className="text-red-500">*</span></label>
        <input id="title" required value={values.title} onChange={update('title')} placeholder="Cousinades 2025, EVG de Marie…" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-neutral-700">Description <span className="font-normal text-neutral-400">(optionnel)</span></label>
        <textarea id="description" rows={2} value={values.description} onChange={update('description')} placeholder="Un petit mot sur ce séjour…" className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startDate" className="text-sm font-medium text-neutral-700">Début <span className="text-red-500">*</span></label>
          <input id="startDate" type="date" required value={values.startDate} onChange={update('startDate')} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endDate" className="text-sm font-medium text-neutral-700">Fin <span className="text-red-500">*</span></label>
          <input id="endDate" type="date" required min={values.startDate} value={values.endDate} onChange={update('endDate')} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)]" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-medium text-neutral-700">Lieu</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="locationName" className="text-xs text-neutral-500">Nom du lieu <span className="text-red-500">*</span></label>
          <input id="locationName" required value={values.locationName} onChange={update('locationName')} placeholder="Domaine de la Forge, Chalet des Alpes…" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="locationAddress" className="text-xs text-neutral-500">Adresse <span className="text-neutral-400">(optionnel)</span></label>
          <input id="locationAddress" value={values.locationAddress} onChange={update('locationAddress')} placeholder="24200 Sarlat-la-Canéda, France" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="locationUrl" className="text-xs text-neutral-500">Lien logement <span className="text-neutral-400">(optionnel)</span></label>
          <input id="locationUrl" type="url" value={values.locationUrl} onChange={update('locationUrl')} placeholder="https://…" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--stay-primary)]" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-50">Annuler</button>
        <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-[var(--stay-primary)] py-2.5 text-sm font-medium text-[var(--stay-primary-text)] transition-opacity hover:opacity-90 disabled:opacity-50">{loading ? 'Création…' : 'Créer le séjour'}</button>
      </div>
    </form>
  )
}
