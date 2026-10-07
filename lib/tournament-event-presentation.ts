import type { TiqTournamentRecord } from './tiq-tournament-registry'

export type TournamentEventDetails = {
  subtitle?: string
  startsAt?: string
  finishLabel?: string
  timeZone?: string
  timeZoneLabel?: string
  registrationClosesOn?: string
  feePerPlayer?: number
  feePerTeam?: number
  currency?: string
  directorName?: string
  venueName?: string
  venueAddress?: string
  formatSummary?: string
  hospitalitySummary?: string
  sanctioningLabel?: string
  sponsors?: string[]
}

function text(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function normalizeTournamentEventDetails(value: unknown): TournamentEventDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const details: TournamentEventDetails = {}
  const keys = ['subtitle', 'finishLabel', 'timeZoneLabel', 'directorName', 'venueName', 'venueAddress',
    'formatSummary', 'hospitalitySummary', 'sanctioningLabel'] as const
  for (const key of keys) {
    const cleaned = text(input[key])
    if (cleaned) details[key] = cleaned
  }
  const startsAt = text(input.startsAt)
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startsAt)) details.startsAt = startsAt
  const deadline = text(input.registrationClosesOn)
  if (isDate(deadline)) details.registrationClosesOn = deadline
  const zone = text(input.timeZone, 100)
  if (zone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); details.timeZone = zone } catch { /* Leave an invalid zone unset. */ }
  }
  for (const key of ['feePerPlayer', 'feePerTeam'] as const) {
    const fee = input[key]
    if (typeof fee === 'number' && Number.isFinite(fee) && fee >= 0 && fee <= 100000) details[key] = Math.round(fee * 100) / 100
  }
  const currency = text(input.currency, 3).toUpperCase()
  if (currency) {
    try { new Intl.NumberFormat('en-US', { style: 'currency', currency }); details.currency = currency } catch { /* Default currency is USD. */ }
  }
  if (Array.isArray(input.sponsors)) details.sponsors = input.sponsors.map(item => text(item, 160)).filter(Boolean).slice(0, 8)
  return details
}

export function formatTournamentEventDate(value: string, short = false) {
  return isDate(value) ? new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', ...(short ? {} : { year: 'numeric' as const }),
  }).format(new Date(`${value}T12:00:00Z`)) : 'Date to be confirmed'
}

export function formatTournamentEventTime(value?: string) {
  if (!value || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return 'Time to be confirmed'
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function formatTournamentEventFee(amount: number | undefined, currency = 'USD') {
  if (amount === undefined) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount)
}

export function isTournamentEventRegistrationClosed(event: Pick<TiqTournamentRecord, 'status' | 'startsOn' | 'eventDetails'>, now = new Date()) {
  if (event.status === 'completed') return true
  const details = normalizeTournamentEventDetails(event.eventDetails)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: details.timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const cutoff = details.registrationClosesOn || event.startsOn
  return isDate(cutoff) && cutoff < today
}

export function buildTournamentEventSignupHref(event: TiqTournamentRecord, division?: TiqTournamentRecord) {
  if (!event.registrationEmail || !division) return ''
  const team = division.entrantType === 'teams'
  const doubles = /doubles/i.test(division.name)
  const body = [`Hi ${event.eventDetails?.directorName?.split(' ')[0] || 'there'},`, '',
    `I'd like to sign up for ${event.name}.`, `Division: ${division.name}`, '',
    doubles ? 'Player name: ' : team ? 'Team name: ' : 'Player name: ',
    doubles ? 'Partner name: ' : team ? 'Contact name: ' : '', '', 'Thank you!'].filter((line, index, lines) => line || lines[index - 1] !== '').join('\n')
  return `mailto:${encodeURIComponent(event.registrationEmail).replace(/%40/g, '@')}?subject=${encodeURIComponent(`${event.name} — ${division.name}`)}&body=${encodeURIComponent(body)}`
}
