export type TiqLeagueCalendarInput = {
  startsOn: string
  maxWeeks: number
  defaultMatchDay?: string
  defaultMatchTime?: string
  defaultFacility?: string
  schedulingMode?: 'coordinator_fixed' | 'player_arranged'
}

export type TiqLeagueCalendarRow = {
  week: number
  date: string
  time: string
  site: string
}

export type TiqLeagueSchedulingPlanRow = TiqLeagueCalendarRow & {
  mode: 'coordinator_fixed' | 'player_arranged'
  label: string
  meta: string
  action: string
  windowStart: string
  windowEnd: string
}

const MATCH_DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

export function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split('-').map((part) => Number(part))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return ''
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getFirstScheduledDate(startsOn: string, matchDay: string | null | undefined) {
  if (!startsOn) return ''
  if (!matchDay || MATCH_DAY_INDEX[matchDay] === undefined) return startsOn

  const [year, month, day] = startsOn.split('-').map((part) => Number(part))
  const start = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(start.getTime())) return ''

  const startDay = start.getUTCDay()
  const targetDay = MATCH_DAY_INDEX[matchDay]
  const daysUntilMatchDay = (targetDay - startDay + 7) % 7
  return addDaysToDateString(startsOn, daysUntilMatchDay)
}

export function buildTiqLeagueSeasonCalendarRows(input: TiqLeagueCalendarInput): TiqLeagueCalendarRow[] {
  const firstDate = getFirstScheduledDate(input.startsOn, input.defaultMatchDay)
  const weeks = Math.max(1, Math.min(Number(input.maxWeeks) || 1, 12))

  return Array.from({ length: weeks }, (_, index) => ({
    week: index + 1,
    date: firstDate ? addDaysToDateString(firstDate, index * 7) : '',
    time: input.defaultMatchTime || '',
    site: input.defaultFacility || '',
  }))
}

export function buildTiqLeagueSchedulingPlanRows(input: TiqLeagueCalendarInput): TiqLeagueSchedulingPlanRow[] {
  const mode = input.schedulingMode === 'player_arranged' ? 'player_arranged' : 'coordinator_fixed'

  return buildTiqLeagueSeasonCalendarRows(input).map((row) => {
    if (mode === 'player_arranged') {
      const windowEnd = row.date ? addDaysToDateString(row.date, 6) : ''
      return {
        ...row,
        mode,
        time: '',
        site: '',
        label: row.date && windowEnd ? `${row.date} to ${windowEnd}` : 'Set start date',
        meta: row.date
          ? 'Pairings open for player scheduling. Players record agreed date, time, and site.'
          : 'Choose a start date to create weekly player scheduling windows.',
        action: 'Players schedule',
        windowStart: row.date,
        windowEnd,
      }
    }

    return {
      ...row,
      mode,
      label: row.date || 'Set start date',
      meta: [row.time || 'Time TBD', row.site || 'Site TBD'].join(' | '),
      action: 'Coordinator publishes',
      windowStart: row.date,
      windowEnd: row.date,
    }
  })
}
