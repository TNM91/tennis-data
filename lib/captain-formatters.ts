export function formatDate(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) return fallback
  const parsed = parseDisplayDate(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
}

export function formatShortDate(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  const parsed = parseDisplayDate(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export function formatWeekdayDate(value: string | null | undefined, fallback = 'Not scheduled') {
  if (!value) return fallback
  const parsed = parseDisplayDate(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatRating(value: number | null | undefined, digits = 2, fallback = '—') {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return value.toFixed(digits)
}

export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeTeamName(value: unknown): string {
  return cleanText(value).replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').toLowerCase()
}

export function parseDisplayDate(value: string) {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
  }
  return new Date(value)
}

export function safeText(value: unknown, fallback = 'Unknown'): string {
  return cleanText(value) || fallback
}

export function formatMonthDay(value: string | null | undefined, fallback = 'No date set') {
  if (!value) return fallback
  const d = parseDisplayDate(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDateTime(value: string | null | undefined, fallback = 'Not updated yet') {
  if (!value) return fallback
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function inferSeasonLabel(matchDate: string | null | undefined) {
  if (!matchDate) return null
  const date = parseDisplayDate(matchDate)
  if (Number.isNaN(date.getTime())) return null
  return String(date.getFullYear())
}

export function inferSessionLabel(matchDate: string | null | undefined) {
  if (!matchDate) return null
  const date = parseDisplayDate(matchDate)
  if (Number.isNaN(date.getTime())) return null
  const month = date.getMonth()
  if (month <= 2) return 'Winter'
  if (month <= 5) return 'Spring'
  if (month <= 7) return 'Summer'
  return 'Fall'
}

export function safeKey(...parts: Array<string | null | undefined>) {
  return parts.map((part) => (part ?? '').trim().toLowerCase() || '—').join('|')
}

export function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function winPct(wins: number, losses: number) {
  const total = wins + losses
  return total ? wins / total : 0
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, '')
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

export function buildSmsHref(recipients: string[], body: string) {
  const address = recipients.map(cleanPhone).filter(Boolean).join(',')
  const query = body.trim() ? `?body=${encodeURIComponent(body.trim())}` : ''
  return `sms:${address}${query}`
}

export function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1', 'available', 'in', 'confirmed'].includes(normalized)) return true
    if (['false', 'no', 'n', '0', 'unavailable', 'out', 'declined'].includes(normalized)) return false
  }
  return null
}

export function pickFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function pickNullableString(record: Record<string, unknown>, keys: string[]) {
  const value = pickFirstString(record, keys)
  return value || null
}

export function readLocalItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function readLocalArray<T>(key: string): T[] {
  const value = readLocalItem<T[]>(key)
  return Array.isArray(value) ? value : []
}
