import type { LeagueWeeklyCourt } from './league-weekly-format'

export type LeagueWeeklyDeliveryKind = 'availability_open' | 'court_plan'

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return {
    weekday: read('weekday'),
    date: `${read('year')}-${read('month')}-${read('day')}`,
    hour: Number(read('hour')),
  }
}

function daysBetween(from: string, to: string) {
  const fromTime = Date.parse(`${from}T00:00:00Z`)
  const toTime = Date.parse(`${to}T00:00:00Z`)
  return Number.isFinite(fromTime) && Number.isFinite(toTime) ? Math.round((toTime - fromTime) / 86_400_000) : -1
}

export function getLeagueWeeklyDeliveryKind(input: {
  now: Date
  timeZone: string
  playOn: string
  status: string
}): LeagueWeeklyDeliveryKind | null {
  const local = localParts(input.now, input.timeZone || 'America/Chicago')
  if (local.hour !== 8) return null
  if (local.date === input.playOn && ['published', 'completed'].includes(input.status)) return 'court_plan'
  const daysUntilPlay = daysBetween(local.date, input.playOn)
  if (local.weekday === 'Mon' && daysUntilPlay >= 1 && daysUntilPlay <= 6 && input.status === 'collecting') return 'availability_open'
  return null
}

export function findLeagueWeeklyPlayerCourt(assignments: LeagueWeeklyCourt[], playerName: string) {
  const normalizedName = playerName.trim().toLowerCase()
  return assignments.find((court) => court.players.some((player) => player.trim().toLowerCase() === normalizedName)) || null
}

export function buildLeagueWeeklyEmail(input: {
  kind: LeagueWeeklyDeliveryKind
  leagueName: string
  playOn: string
  playerName: string
  facility: string
  assignments: LeagueWeeklyCourt[]
  href: string
}) {
  const court = findLeagueWeeklyPlayerCourt(input.assignments, input.playerName)
  if (input.kind === 'court_plan') {
    const courtLine = court
      ? `Court ${court.courtNumber} at ${court.startTime}. You’ll play with ${court.players.filter((name) => name !== input.playerName).join(', ')}.`
      : 'You are not currently assigned to a court. Open the weekly plan for the latest roster.'
    return {
      subject: `${input.leagueName}: courts for ${input.playOn}`,
      heading: 'Your weekly court plan is ready.',
      body: [courtLine, input.facility ? `Site: ${input.facility}.` : ''].filter(Boolean).join(' '),
      cta: 'Open court plan',
      href: input.href,
    }
  }
  return {
    subject: `${input.leagueName}: are you in this week?`,
    heading: `In or out for ${input.playOn}?`,
    body: `Reply for this week’s ${input.leagueName} roster${input.facility ? ` at ${input.facility}` : ''}.`,
    cta: 'Reply for this week',
    href: input.href,
  }
}
