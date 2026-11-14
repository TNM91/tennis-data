import { eventCalendarStart, isValidCalendarDate } from './calendar-date'
import { lineupRecord } from './native-captain-lineup-contract'
import { entryLeague } from './native-league-entry-contract'
import { updateId, updateTimestamp } from './native-updates-contract'
import { leagueAttentionFixture } from './native-league-attention-contract'
import { readLeagueScoreFixture } from './native-league-score-contract'

export type ScheduledLeagueMatch = {
  id: string; date: string; time: string; facility: string; court: string
  a: string; b: string; status: string; duration: number | null
}
export type LeagueScheduleSlot = {
  date: string; time: string; venueId: string; court: string; duration: number
}
export type LeagueScheduleChange = LeagueScheduleSlot & {
  leagueId: string; requestId: string; matchId: string | null; version: string
  a: string; b: string; notify: boolean
}
export type LeaguePostponement = {
  action: 'postpone'; leagueId: string; requestId: string; matchId: string; version: string
  fixture: ReturnType<typeof leagueAttentionFixture>
}
export type LeagueScheduleReview = {
  owner: string; leagueId: string; name: string; format: 'team' | 'individual'; zone: string
  startsOn: string; endsOn: string; defaultTime: string; defaultVenueId: string
  entries: { id: string; name: string }[]
  venues: { id: string; name: string; detail: string }[]
  matches: (ScheduledLeagueMatch & { aId: string; bId: string; version: string; venueId: string; canPostpone?: true })[]
}

const text = (value: unknown, max: number) => {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw Error('Check the match details.')
  return value.trim()
}
const uuid = (value: unknown) => {
  if (!updateId(value)) throw Error('Choose a match or participant from this league.')
  return value.toLowerCase()
}
const clock = (value: unknown) => {
  const time = text(value, 5)
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Choose a start time.')
  return time
}
const day = (value: unknown) => {
  const date = text(value, 10)
  if (!isValidCalendarDate(date)) throw Error('Choose a valid match date.')
  return date
}
const duration = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 30 || value > 360) throw Error('Choose a match length from 30 to 360 minutes.')
  return value
}
const venue = (value: unknown) => value === 'league-venue' ? value : uuid(value)
export const defaultLeagueMatchDuration = (format: 'team' | 'individual') => format === 'team' ? 120 : 90

export function leagueScheduleChange(value: unknown): LeagueScheduleChange {
  const row = lineupRecord(value)
  const keys = ['leagueId', 'requestId', 'matchId', 'version', 'a', 'b', 'date', 'time', 'venueId', 'court', 'duration', 'notify']
  if (Object.keys(row).length !== keys.length || !keys.every(key => Object.hasOwn(row, key))) throw Error('Check the match details.')
  const a = uuid(row.a), b = uuid(row.b), matchId = row.matchId === null ? null : uuid(row.matchId)
  if (a === b || typeof row.notify !== 'boolean' || (matchId ? !updateTimestamp(row.version) : row.version !== '')) {
    throw Error('Choose two different participants and review the match again.')
  }
  const court = text(row.court, 20).replace(/^court\s+/i, '')
  if (court && !/^[\p{L}\p{N}][\p{L}\p{N} &/-]*$/u.test(court)) throw Error('Enter a short court label, such as 3 or Indoor 2.')
  return { leagueId: entryLeague(row.leagueId), requestId: uuid(row.requestId), matchId, version: row.version as string,
    a, b, date: day(row.date), time: clock(row.time), venueId: venue(row.venueId), court, duration: duration(row.duration), notify: row.notify }
}

export function leaguePostponement(value: unknown): LeaguePostponement {
  const row = lineupRecord(value), fixture = lineupRecord(row.fixture)
  const match = readLeagueScoreFixture(fixture)
  const matchId = uuid(row.matchId)
  if (row.action !== 'postpone' || Object.keys(row).length !== 6 || !updateTimestamp(row.version) ||
      matchId !== match.id || (fixture.status !== 'confirmed' && fixture.status !== 'coordinator_set')) {
    throw Error('Review the scheduled match before postponing it.')
  }
  return { action: 'postpone', leagueId: entryLeague(row.leagueId), requestId: uuid(row.requestId), matchId,
    version: row.version, fixture: { ...match, status: fixture.status, facility: text(fixture.facility, 240) } }
}

export function validateLeagueScheduleSlot(slot: LeagueScheduleSlot, league: Pick<LeagueScheduleReview, 'zone' | 'startsOn' | 'endsOn'>, now: Date | null = new Date()) {
  if ((league.startsOn && slot.date < league.startsOn) || (league.endsOn && slot.date > league.endsOn)) {
    throw Error('Choose a date within this league season.')
  }
  const start = eventCalendarStart(slot.date, slot.time, league.zone)
  if (!start || (now && start <= now)) throw Error('Choose a future time that exists in the league’s time zone.')
}

export function readScheduledLeagueMatch(value: unknown): ScheduledLeagueMatch {
  const row = lineupRecord(value)
  const status = text(row.status, 24)
  if (!['proposed', 'confirmed', 'coordinator_set', 'completed', 'cancelled', 'postponed'].includes(status)) throw Error('Match status changed.')
  const a = text(row.a, 160), b = text(row.b, 160)
  if (!a || !b || a === b) throw Error('Match participants changed.')
  return { id: uuid(row.id), date: day(row.date), time: row.time === '' ? '' : clock(row.time),
    facility: text(row.facility, 240), court: text(row.court, 20), a, b, status,
    duration: row.duration === null ? null : duration(row.duration) }
}

export function readLeagueScheduleReview(value: unknown, owner: string, leagueId: string): LeagueScheduleReview {
  const row = lineupRecord(value)
  if (row.ok !== true || row.owner !== owner || row.leagueId !== leagueId ||
      (row.format !== 'team' && row.format !== 'individual')) throw Error('League access changed.')
  const zone = text(row.zone, 80)
  new Intl.DateTimeFormat('en', { timeZone: zone })
  function list<T extends { id: string }>(value: unknown, limit: number, read: (row: Record<string, unknown>) => T) {
    if (!Array.isArray(value) || value.length > limit) throw Error('League schedule unavailable.')
    const rows = value.map(item => read(lineupRecord(item)))
    if (new Set(rows.map(item => item.id)).size !== rows.length) throw Error('League schedule unavailable.')
    return rows
  }
  const entries = list(row.entries, 500, item => ({ id: uuid(item.id), name: text(item.name, 160) }))
  const venues = list(row.venues, 100, item => ({ id: venue(item.id), name: text(item.name, 240), detail: text(item.detail, 240) }))
  const matches = list(row.matches, 500, item => {
    if (!updateTimestamp(item.version)) throw Error('Match version unavailable.')
    return { ...readScheduledLeagueMatch(item), aId: uuid(item.aId), bId: uuid(item.bId), version: item.version,
      venueId: item.venueId === '' ? '' : venue(item.venueId), ...(item.canPostpone === true ? { canPostpone: true as const } : {}) }
  })
  return { owner, leagueId, name: text(row.name, 240), format: row.format, zone,
    startsOn: row.startsOn === '' ? '' : day(row.startsOn), endsOn: row.endsOn === '' ? '' : day(row.endsOn),
    defaultTime: row.defaultTime === '' ? '' : clock(row.defaultTime), defaultVenueId: row.defaultVenueId === '' ? '' : venue(row.defaultVenueId),
    entries, venues, matches }
}

export function leagueScheduleUpdateLink(url: URL) {
  const leagueId = /^\/explore\/leagues\/tiq\/([a-zA-Z0-9_-]{1,80})$/.exec(url.pathname)?.[1]
  const matchId = url.searchParams.get('scheduledMatch')
  if (leagueId && updateId(matchId) && [...url.searchParams].length === 1 && url.hash === '#league-schedule') return { leagueId, matchId }
}
