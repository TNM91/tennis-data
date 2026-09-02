export type TeamScheduleCalendarMatch = {
  externalMatchId?: string
  matchDate?: string
  matchTime?: string
  homeTeam?: string
  awayTeam?: string
  facility?: string
}

export type TeamScheduleCalendarItem = {
  id: string
  title: string
  date: string
  time: string
  location: string
  kind: 'match'
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeTeam(value: unknown) {
  return cleanText(value)
    .replace(/\s*\([A-Za-z]\)\s*$/g, '')
    .toLocaleLowerCase()
}

function slug(value: unknown) {
  return cleanText(value)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeScheduleCalendarDate(value: unknown) {
  const text = cleanText(value)
  const iso = /^(20\d{2})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const slash = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})$/.exec(text)
  if (!slash) return ''
  const month = Number(slash[1])
  const day = Number(slash[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${slash[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function normalizeScheduleCalendarTime(value: unknown) {
  const text = cleanText(value)
  const twentyFourHour = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(text)
  if (twentyFourHour) return text

  const twelveHour = /^(\d{1,2})[:.]([0-5]\d)\s*(AM|PM)$/i.exec(text)
  if (!twelveHour) return ''
  const rawHour = Number(twelveHour[1])
  if (rawHour < 1 || rawHour > 12) return ''
  const hour = (rawHour % 12) + (twelveHour[3].toUpperCase() === 'PM' ? 12 : 0)
  return `${String(hour).padStart(2, '0')}:${twelveHour[2]}`
}

export function getTeamScheduleCalendarItemId(teamName: string, match: TeamScheduleCalendarMatch, index = 0, calendarOwnerId = '') {
  const teamKey = slug(teamName) || 'team'
  const ownerKey = slug(calendarOwnerId) || 'account'
  const matchKey = cleanText(match.externalMatchId).replace(/[^a-zA-Z0-9_-]/g, '')
    || [normalizeScheduleCalendarDate(match.matchDate), slug(match.homeTeam), slug(match.awayTeam), index + 1].filter(Boolean).join('-')
  return `team-schedule-${ownerKey}-${teamKey}-${matchKey || index + 1}`.slice(0, 180)
}

export function buildTeamScheduleCalendarItems(input: {
  teamName: string
  leagueName?: string
  matches: TeamScheduleCalendarMatch[]
  calendarOwnerId?: string
}): TeamScheduleCalendarItem[] {
  const teamName = cleanText(input.teamName)
  const teamKey = normalizeTeam(teamName)
  const seen = new Set<string>()
  const items: TeamScheduleCalendarItem[] = []

  input.matches.forEach((match, index) => {
    const date = normalizeScheduleCalendarDate(match.matchDate)
    if (!date) return
    const id = getTeamScheduleCalendarItemId(teamName, match, index, input.calendarOwnerId)
    if (seen.has(id)) return
    seen.add(id)

    const homeTeam = cleanText(match.homeTeam)
    const awayTeam = cleanText(match.awayTeam)
    const opponent = normalizeTeam(homeTeam) === teamKey ? awayTeam : homeTeam
    const opponentLabel = opponent || 'Team match'
    const league = cleanText(input.leagueName)
    items.push({
      id,
      title: `${teamName || 'My team'} vs ${opponentLabel}${league ? ` · ${league}` : ''}`,
      date,
      time: normalizeScheduleCalendarTime(match.matchTime),
      location: cleanText(match.facility),
      kind: 'match',
    })
  })

  return items
}
