export function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} est obligatoire.`)
  return trimmed
}

export function assertDateRange(startDate: string | null | undefined, endDate: string | null | undefined): void {
  if (startDate && endDate && endDate < startDate) {
    throw new Error('La date de fin doit être après la date de début.')
  }
}

export function assertDateTimeRange(arrivalAt: string | null | undefined, departureAt: string | null | undefined): void {
  if (arrivalAt && departureAt && new Date(departureAt).getTime() < new Date(arrivalAt).getTime()) {
    throw new Error("L'heure de départ doit être après l'heure d'arrivée.")
  }
}
