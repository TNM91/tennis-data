import type { LeagueWeeklyCourt } from './league-weekly-format'
import { isValidCalendarDate } from './calendar-date'

export type WeeklyReadinessItem = { key: string; label: string; ready: boolean; detail: string }
export function getWeeklyLaunchReadiness(input: {
  name: string; facility: string; players: string[]; startTimes: string[]; courtCount: number;
  playOn: string; deadline: string | null; seasonStatus: string; startsOn?: string; endsOn?: string; timeZone?: string;
}, now = Date.now()): WeeklyReadinessItem[] {
  const dateReady = isValidCalendarDate(input.playOn) && (!input.startsOn || input.playOn >= input.startsOn) && (!input.endsOn || input.playOn <= input.endsOn)
  const deadline = input.deadline ? Date.parse(input.deadline) : Number.NaN
  const firstStart = [...input.startTimes].sort()[0]
  let deadlineBeforePlay = false
  if (Number.isFinite(deadline) && firstStart) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(deadline))
      const part = (type: string) => parts.find(item => item.type === type)?.value || ''
      deadlineBeforePlay = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}` < `${input.playOn}T${firstStart}`
    } catch { deadlineBeforePlay = false }
  }
  return [
    { key: 'name', label: 'League name', ready: Boolean(input.name.trim()), detail: 'Give players a recognizable league name.' },
    { key: 'site', label: 'Court location', ready: Boolean(input.facility.trim()), detail: 'Choose the actual court site and address in Edit league.' },
    { key: 'players', label: 'Players', ready: input.players.some(name => name.trim()), detail: 'Add players before sharing the weekly reply link.' },
    { key: 'waves', label: 'Courts and start times', ready: Number.isInteger(input.courtCount) && input.courtCount > 0 && input.startTimes.length > 0 && input.startTimes.every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)), detail: 'Choose at least one court and a valid start time.' },
    { key: 'date', label: 'League date', ready: dateReady && input.seasonStatus !== 'completed' && input.seasonStatus !== 'archived', detail: 'Choose a date within this season, or renew the league.' },
    { key: 'deadline', label: 'Response deadline', ready: Number.isFinite(deadline) && deadline > now && deadlineBeforePlay, detail: 'Choose a future response deadline before play.' },
  ]
}

export function getWeeklyPlayerStatus(input: {
  playerName: string; status: string; responseStatus?: string | null; withdrawalPending?: boolean;
  roster: string[]; assignments: LeagueWeeklyCourt[];
}) {
  if (!input.playerName) return { label: 'Choose your name', detail: 'See your response, court, and start time.' }
  if (input.withdrawalPending) return { label: 'Withdrawal requested', detail: 'Your court place stays reserved until League Office confirms the change.' }
  const court = input.assignments.find(item => item.players.includes(input.playerName))
  if (court) return { label: input.status === 'completed' ? 'Week complete' : 'Confirmed to play', detail: `Court ${court.courtNumber} · ${court.startTime} · ${court.players.filter(name => name !== input.playerName).join(', ')}` }
  if (input.responseStatus === 'out') return { label: 'You’re out', detail: 'You are not requesting a place this week.' }
  if (input.status === 'collecting') return input.responseStatus === 'in'
    ? { label: 'You’re in · awaiting confirmation', detail: 'Your reply is saved. League Office will confirm your place and court.' }
    : { label: 'No reply yet', detail: 'Choose in or out before the response deadline.' }
  if (input.status === 'roster_confirmed' && input.roster.includes(input.playerName)) return { label: 'Roster confirmed', detail: 'Your place is confirmed. Your court and start time will appear when League Office publishes the plan.' }
  if (input.responseStatus === 'in' || input.roster.includes(input.playerName)) return { label: 'Waitlisted', detail: 'You do not have a confirmed court yet. League Office can offer you a substitute place.' }
  return { label: 'Not playing this week', detail: 'Contact League Office if your availability changes.' }
}

export function getAffectedWeeklyPlayers(before: LeagueWeeklyCourt[], after: LeagueWeeklyCourt[]) {
  const changed = new Set<number>()
  for (const court of [...before, ...after]) {
    const previous = before.find(item => item.courtNumber === court.courtNumber)
    const next = after.find(item => item.courtNumber === court.courtNumber)
    if (JSON.stringify(previous) !== JSON.stringify(next)) changed.add(court.courtNumber)
  }
  return [...new Set([...before, ...after].filter(court => changed.has(court.courtNumber)).flatMap(court => court.players))]
}

export function replaceWeeklyPlayer(courts: LeagueWeeklyCourt[], outgoing: string, incoming: string) {
  if (!outgoing || !incoming || outgoing === incoming) throw new Error('Choose two different players.')
  if (!courts.some(court => court.players.includes(outgoing))) throw new Error('Choose a player on a published court.')
  if (courts.some(court => court.players.includes(incoming))) throw new Error('That player already has a court.')
  return courts.map(court => ({ ...court, players: court.players.map(name => name === outgoing ? incoming : name) as LeagueWeeklyCourt['players'],
    sets: court.sets.map(set => ({ ...set, sideA: set.sideA.map(name => name === outgoing ? incoming : name) as [string, string], sideB: set.sideB.map(name => name === outgoing ? incoming : name) as [string, string] })) }))
}
