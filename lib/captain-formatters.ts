export function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
}

export function formatShortDate(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export function formatLongDate(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRating(value: number | null | undefined, digits = 2, fallback = '—') {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return value.toFixed(digits)
}
