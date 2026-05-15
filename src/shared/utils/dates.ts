function parseDateOnly(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()

  const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' })
  const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long' })
  const yearFmt = new Intl.DateTimeFormat('fr-FR', { year: 'numeric' })

  if (sameMonth) return `${dayFmt.format(start)} – ${dayFmt.format(end)} ${monthFmt.format(start)} ${yearFmt.format(start)}`
  if (sameYear) return `${dayFmt.format(start)} ${monthFmt.format(start)} – ${dayFmt.format(end)} ${monthFmt.format(end)} ${yearFmt.format(start)}`
  return `${dayFmt.format(start)} ${monthFmt.format(start)} ${yearFmt.format(start)} – ${dayFmt.format(end)} ${monthFmt.format(end)} ${yearFmt.format(end)}`
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(parseDateOnly(date))
}

export function formatDateTime(dateTime: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateTime)).replace(',', ' à')
}

// Convertit la valeur d'un input datetime-local en ISO UTC pour les colonnes timestamptz.
export function dateTimeLocalToUtcIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

// Convertit un timestamptz Supabase en valeur compatible input datetime-local.
export function utcIsoToDateTimeLocal(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}
