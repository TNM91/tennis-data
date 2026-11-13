import { reviewedRevisionDigest } from './first-party-revisions'
import { accountClient } from './mobile-account-auth'
import type { OfficeDetail, OfficeFixture, OfficeLeague } from './native-league-office-contract'
import { readScheduledLeagueMatch, type LeagueScheduleChange } from './native-league-schedule-contract'
import { lineupRecord } from './native-captain-lineup-contract'

export function leagueScheduleService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw Error('League scheduling unavailable')
  return accountClient(key)
}

export async function loadLeagueScheduling(owner: string, league: OfficeLeague) {
  const { data, error } = await leagueScheduleService().rpc('native_first_party_league_schedule_review', {
    p_actor: owner, p_league: league.id, p_version: league.updatedAt,
  }).retry(false)
  if (error || !data) throw Error('League schedule changed')
  return lineupRecord(data)
}

export async function saveLeagueScheduling(owner: string, league: OfficeLeague, input: LeagueScheduleChange) {
  const { data, error } = await leagueScheduleService().rpc('native_first_party_save_league_match', {
    p_actor: owner, p_league: league.id, p_league_version: league.updatedAt, p_request: input.requestId,
    p_match: input.matchId, p_match_version: input.version || null, p_a: input.a, p_b: input.b,
    p_date: input.date, p_time: input.time, p_venue: input.venueId, p_court: input.court,
    p_duration: input.duration, p_notify: input.notify,
  }).retry(false)
  if (error) throw Error('Match save could not be confirmed')
  return lineupRecord(data)
}

// A saved revision may replace its reviewed predecessor, or add a fixture.
// Any other league edits still require the existing review.
export function mergeAttestedLeagueMatches(detail: OfficeDetail, value: unknown, approvedDigest: string) {
  if (!Array.isArray(value) || value.length > 500) throw Error('League schedule unavailable')
  const matches = new Map<string, { current: OfficeFixture; original: OfficeFixture | null }>()
  for (const entry of value) {
    const row = lineupRecord(entry)
    const { id, a, b, date, time, facility, status } = readScheduledLeagueMatch(row.match)
    if (status !== 'coordinator_set' || matches.has(id)) throw Error('Invalid match revision')
    let original: OfficeFixture | null = null
    if (row.original !== null) {
      const old = lineupRecord(row.original)
      const keys = ['id', 'a', 'b', 'date', 'time', 'facility', 'status'] as const
      if (keys.some(key => typeof old[key] !== 'string' || old[key].length > 240) ||
          old.id !== id || old.a !== a || old.b !== b || !['confirmed', 'coordinator_set'].includes(String(old.status))) {
        throw Error('Invalid previous match revision')
      }
      original = Object.fromEntries(keys.map(key => [key, old[key]])) as OfficeFixture
    }
    matches.set(id, { current: { id, a, b, date, time, facility, status }, original })
  }
  const chronological = (a: OfficeFixture, b: OfficeFixture) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  const seen = new Set<string>()
  const baseline = detail.fixtures.flatMap(fixture => {
    const attested = matches.get(fixture.id)
    if (!attested) return [fixture]
    seen.add(fixture.id)
    // The live read and the attestation query may straddle a website update.
    const { current, original } = attested
    if (fixture.a !== current.a || fixture.b !== current.b || fixture.date !== current.date ||
        fixture.time.slice(0, 5) !== current.time || fixture.facility !== current.facility || fixture.status !== current.status) {
      throw Error('Match changed while loading')
    }
    return original ? [original] : []
  })
  const publishedSchedule = [...matches.values()].map(({ current }) => current).sort(chronological).slice(0, 100)
  const fullDetail = !detail.moreFixtures && seen.size === matches.size && matches.size > 0 &&
    reviewedRevisionDigest({ ...detail, fixtures: baseline.sort(chronological) }) === approvedDigest
  return { publishedSchedule, fullDetail }
}

export async function attestedLeagueSchedule(league: OfficeLeague) {
  const { data, error } = await leagueScheduleService().rpc('native_first_party_league_matches', {
    p_league: league.id, p_version: league.updatedAt,
  }).retry(false)
  if (error || !Array.isArray(data)) throw Error('League schedule unavailable')
  return data
}
