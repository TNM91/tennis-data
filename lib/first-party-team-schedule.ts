import type { SupabaseClient } from '@supabase/supabase-js'
import { eventCalendarStart } from './calendar-date'
import { loadActiveReviewedTeamRoomIds, loadReviewedTeamLinks, readReviewedTeamRooms, type ReviewedTeamRoom } from './first-party-team-scopes'
import { readCalendarTeamMatches, type CalendarRange } from './native-calendar-contract'
import { loadFirstPartyNativeCompetitions } from './native-competitions'
import { fixtureId, readReviewedNextMatch, type ReviewedNextMatch, type TeamNextMatchChange } from './team-fixtures-contract'
import { readSavedTeamLineup } from './team-match-lineup-contract'
import { todayDateKey } from './team-room-match-flow'

export function upcomingTeamMatch(match: ReviewedNextMatch, now = new Date()) {
  if (!match.time) return match.date >= todayDateKey(now, match.timeZone)
  const start = eventCalendarStart(match.date, match.time, match.timeZone)
  return Boolean(start && start >= now)
}

export function teamMatchHasStarted(match: ReviewedNextMatch, now = new Date()) {
  if (!match.time) return match.date <= todayDateKey(now, match.timeZone)
  const start = eventCalendarStart(match.date, match.time, match.timeZone)
  return Boolean(start && start <= now)
}

export async function loadManualTeamFixture(service: SupabaseClient, room: ReviewedTeamRoom, includeLineup = false) {
  const table = service.from('native_team_next_fixtures')
  const query = includeLineup ? table.select('revision,fixture,lineup') : table.select('revision,fixture')
  const { data, error } = await query.eq('room_id', room.roomId).maybeSingle()
  if (error || data && !fixtureId(data.revision)) throw Error('Team match unavailable')
  const match = readReviewedNextMatch(data?.fixture)
  if (data?.fixture != null && !match) throw Error('Invalid team match')
  const lineup = includeLineup && data && 'lineup' in data ? readSavedTeamLineup(data.lineup) : null
  return { revision: data ? String(data.revision) : null, match, lineup }
}

export async function loadManualTeamNextMatch(service: SupabaseClient, room: ReviewedTeamRoom, includeLineup = false) {
  const { revision, match, lineup } = await loadManualTeamFixture(service, room, includeLineup)
  return { revision, nextMatch: match && upcomingTeamMatch(match) ? match : null, ...(lineup ? { lineup } : {}) }
}

export async function loadCalendarTeamMatches(service: SupabaseClient, owner: string, range: CalendarRange, now = new Date()) {
  const links = (await loadReviewedTeamLinks(service, owner, readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)))
    .filter(room => !room.scheduleLeagueId)
  const ids = await loadActiveReviewedTeamRoomIds(service, owner, links)
  if (!ids.length) return []
  const scopes = new Map(links.map(({ roomId, teamName, leagueName, leagueLabel, flight }) => [roomId, { teamName, leagueName, leagueLabel, flight }]))
  const { data, error } = await service.from('native_team_next_fixtures').select('room_id,revision,fixture')
    .in('room_id', ids).limit(ids.length)
  if (error || !Array.isArray(data) || data.some(row => !ids.includes(row.room_id))) throw Error('Team match dates unavailable')
  return readCalendarTeamMatches(data.flatMap(({ room_id: roomId, revision, fixture }) => {
    if (fixture === null) return []
    const match = readReviewedNextMatch(fixture)
    if (!match) throw Error('Invalid team match')
    return match.date >= range.from && match.date <= range.to && upcomingTeamMatch(match, now)
      ? [{ roomId, revision, match, scope: scopes.get(roomId) }] : []
  }), range)
}

export async function saveManualTeamNextMatch(service: SupabaseClient, owner: string, room: ReviewedTeamRoom, change: TeamNextMatchChange) {
  const previous = change.expected && change.nextMatch ? await loadManualTeamFixture(service, room) : null
  const archive = previous && previous.revision === change.expected && previous.match && change.nextMatch &&
    (previous.match.date !== change.nextMatch.date || previous.match.opponent !== change.nextMatch.opponent ||
     previous.match.time && (previous.match.time !== change.nextMatch.time || previous.match.timeZone !== change.nextMatch.timeZone)) &&
    teamMatchHasStarted(previous.match)
  const { data, error } = await service.rpc('set_native_team_next_fixture', {
    p_owner: owner, p_room: room.roomId, p_team: room.teamName, p_league: room.leagueName, p_flight: room.flight,
    p_expected: change.expected, p_revision: change.revision, p_fixture: change.nextMatch, p_archive: Boolean(archive),
  }).retry(false)
  if (error || ![200, 400, 403, 409].includes(data)) throw Error('Team match could not be confirmed')
  return data as 200 | 400 | 403 | 409
}

export async function loadReviewedTeamNextMatch(db: SupabaseClient, owner: string, room: ReviewedTeamRoom, now = new Date()) {
  if (!room.scheduleLeagueId) return null
  const { detail, publishedSchedule } = await loadFirstPartyNativeCompetitions(db, owner, {
    scope: 'discover', query: '', selected: room.scheduleLeagueId,
  }, false, true)
  if (!detail || detail.league.format !== 'team' || detail.league.name !== room.leagueName ||
      detail.league.flight !== room.flight || detail.league.status !== 'active' ||
      detail.moreFixtures || detail.moreParticipants ||
      (!publishedSchedule && detail.participants.filter(team => team.name === room.teamName && team.status === 'active').length !== 1)) return null

  const { timeZone } = detail.league
  const today = todayDateKey(now, timeZone)
  const candidates: ReviewedNextMatch[] = []
  for (const fixture of publishedSchedule ?? detail.fixtures) {
    if (fixture.date < today || !['confirmed', 'coordinator_set'].includes(fixture.status)) continue
    const home = fixture.a === room.teamName, away = fixture.b === room.teamName
    if (home === away) continue
    const match = readReviewedNextMatch({
      opponent: home ? fixture.b : fixture.a, date: fixture.date, time: fixture.time.slice(0, 5), facility: fixture.facility, timeZone,
    })
    if (match && upcomingTeamMatch(match, now)) candidates.push(match)
  }
  return candidates.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '24:00').localeCompare(b.time || '24:00'))[0] ?? null
}
