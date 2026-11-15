import { isValidCalendarDate } from './calendar-date'
import { nativeTournamentPublicationId, tournamentDraftRevision } from './native-tournament-draft-contract'
import { isCompleteEventSlot } from './tournament-event-desk'
import { maxTournamentDivisions } from './native-tournament-setup-contract'
import { readTournamentMatch, type TournamentMatch, type TournamentSummary } from './native-tournaments-contract'
import { readPlayedTennisScore, readRetirementScore, type TennisMatchOutcome } from './tennis-match-result'

export const tournamentSlotMinutes = 60
export const tournamentMatchId = (id: unknown): id is string => typeof id === 'string' && /^r[1-9][0-9]?-m[1-9][0-9]?$/.test(id)
export const tournamentPlanRevision = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id)

export function tournamentScheduleUpdateLink(url: URL) {
  if (url.pathname !== '/compete' || url.hash !== '#tournament-schedule' || url.searchParams.size !== 4) return null
  const parent = url.searchParams.get('event')
  const division = url.searchParams.get('division')
  const matchId = url.searchParams.get('match')
  const receiptId = url.searchParams.get('entry')
  return nativeTournamentPublicationId(parent, 'event') && nativeTournamentPublicationId(division, 'division') &&
    tournamentMatchId(matchId) && tournamentDraftRevision(receiptId) ? { parent, division, matchId, receiptId } : null
}
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export type TournamentSlot = { date: string; time: string; court: string }
export type TournamentScore = { outcome: TennisMatchOutcome; score: string; side: 'A' | 'B' }
export type TournamentPlanWrite = { division: string; revision: string } & (
  { action: 'publish' } | { action: 'slot'; match: string; slot: TournamentSlot | null } |
  { action: 'result'; match: string; sides: [string, string]; result: TournamentScore }
)
export type TournamentPlanDivision = {
  id: string
  name: string
  format: 'round_robin' | 'single_elimination'
  status: TournamentSummary['status']
  entries: number
  pending: number
  drawNotice: string
}
export type TournamentPlanMatch = TournamentMatch & { playerOverlap?: true }
export type TournamentPlan = {
  id: string
  name: string
  date: string
  zone: string
  revision: string
  divisions: TournamentPlanDivision[]
  division: string
  matches: TournamentPlanMatch[]
}

export function readTournamentSlot(value: unknown): TournamentSlot {
  if (!isRecord(value) || Object.keys(value).length !== 3 || typeof value.date !== 'string' ||
      typeof value.time !== 'string' || typeof value.court !== 'string' || value.court.length > 40 ||
      /[\u0000-\u001f\u007f]/.test(value.court)) throw Error('Choose a date, time and court.')
  const slot = { date: value.date, time: value.time, court: value.court.trim().replace(/\s+/g, ' ') }
  if (!isCompleteEventSlot(slot)) throw Error('Choose a valid date, time and court.')
  return slot
}

export function readTournamentScore(value: unknown): TournamentScore {
  if (!isRecord(value) || Object.keys(value).some(key => !['outcome', 'score', 'side'].includes(key))) {
    throw Error('Check the match result.')
  }
  const { outcome, score, side } = value
  if (outcome === 'played') {
    const played = readPlayedTennisScore(score)
    if (side !== undefined && side !== played.winner) throw Error('The result and score show different winners.')
    return { outcome, score: played.score, side: played.winner }
  }
  if (outcome !== 'walkover' && outcome !== 'retirement') throw Error('Choose a match outcome.')
  if (side !== 'A' && side !== 'B') throw Error('Select who won the match.')
  if (outcome === 'walkover' && score !== '') throw Error('Leave the score blank for a walkover.')
  return { outcome, score: outcome === 'retirement' ? readRetirementScore(score) : '', side }
}

export function readTournamentPlanWrite(value: unknown): TournamentPlanWrite {
  if (!isRecord(value) || !nativeTournamentPublicationId(value.division, 'division') || !tournamentPlanRevision(value.revision)) {
    throw Error('Choose a division and refresh the draw.')
  }
  const base = { division: value.division, revision: value.revision }
  if (value.action === 'publish' && Object.keys(value).length === 3) return { ...base, action: 'publish' }
  if (value.action === 'slot' && Object.keys(value).length === 5 && tournamentMatchId(value.match)) {
    return { ...base, action: 'slot', match: value.match, slot: value.slot === null ? null : readTournamentSlot(value.slot) }
  }
  if (value.action === 'result' && Object.keys(value).length === 6 && tournamentMatchId(value.match) &&
      Array.isArray(value.sides) && value.sides.length === 2 &&
      value.sides.every(side => typeof side === 'string' && side.trim() && side.length <= 256) &&
      value.sides[0] !== value.sides[1]) {
    return { ...base, action: 'result', match: value.match, sides: [value.sides[0], value.sides[1]], result: readTournamentScore(value.result) }
  }
  throw Error('Choose a match and check the court assignment.')
}

export function readTournamentPlan(value: unknown): TournamentPlan {
  if (!isRecord(value) || !nativeTournamentPublicationId(value.id, 'event') || !tournamentPlanRevision(value.revision) ||
      typeof value.date !== 'string' || !isValidCalendarDate(value.date) || typeof value.name !== 'string' ||
      typeof value.zone !== 'string' || !Array.isArray(value.divisions) || !value.divisions.length ||
      value.divisions.length > maxTournamentDivisions || !nativeTournamentPublicationId(value.division, 'division') ||
      !Array.isArray(value.matches) || value.matches.length > 500) throw Error('Draw unavailable')
  const divisions = value.divisions.map((division): TournamentPlanDivision => {
    if (!isRecord(division) || !nativeTournamentPublicationId(division.id, 'division') || typeof division.name !== 'string' ||
        (division.format !== 'round_robin' && division.format !== 'single_elimination') ||
        (division.status !== 'open' && division.status !== 'scheduled' && division.status !== 'completed') ||
        typeof division.entries !== 'number' || !Number.isSafeInteger(division.entries) || division.entries < 0 ||
        typeof division.pending !== 'number' || !Number.isSafeInteger(division.pending) || division.pending < 0 ||
        typeof division.drawNotice !== 'string') throw Error('Division unavailable')
    return { id: division.id, name: division.name, format: division.format, status: division.status,
      entries: division.entries, pending: division.pending, drawNotice: division.drawNotice }
  })
  if (new Set(divisions.map(division => division.id)).size !== divisions.length ||
      !divisions.some(division => division.id === value.division)) throw Error('Division selection changed')
  const matches = value.matches.map((value): TournamentPlanMatch => {
    if (!isRecord(value) || value.playerOverlap !== undefined && value.playerOverlap !== true) throw Error('Invalid court assignment')
    return { ...readTournamentMatch(value), ...(value.playerOverlap ? { playerOverlap: true as const } : {}) }
  })
  if (matches.some(match => !tournamentMatchId(match.id)) ||
      new Set(matches.map(match => match.id)).size !== matches.length) throw Error('Invalid match list')
  return { id: value.id, name: value.name, date: value.date, zone: value.zone, revision: value.revision,
    divisions, division: value.division, matches }
}
