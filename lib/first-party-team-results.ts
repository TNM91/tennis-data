import type { SupabaseClient } from '@supabase/supabase-js'
import { loadEligibleTeamRoster } from './first-party-team-replies'
import { loadActiveReviewedTeamRoomIds, loadReviewedTeamLinks, readReviewedTeamRooms, type ReviewedTeamRoom } from './first-party-team-scopes'
import { loadManualTeamFixture, teamMatchHasStarted } from './first-party-team-schedule'
import { fixtureId, readReviewedNextMatch } from './team-fixtures-contract'
import { readTeamCourtScore, readTeamRecord, readTeamResultEntry, readTeamResultPlayers, teamCourtScorecard, teamScorecardLimit,
  type TeamCourtScorecard, type TeamResultChange, type TeamResultEntry, type TeamResults } from './team-results-contract'

export async function loadTeamResultRoster(service: SupabaseClient, room: ReviewedTeamRoom, owner: string) {
  const { ids } = await loadEligibleTeamRoster(service, room, owner)
  if (!ids.length) return []
  const { data, error } = await service.from('profiles').select('id,message_display_name').in('id', ids).limit(100)
  if (error || !Array.isArray(data)) throw Error('Team roster unavailable')
  return readTeamResultPlayers(data.map(row => ({ id: row.id,
    name: row.message_display_name?.replace(/\p{Cc}/gu, '').trim().slice(0, 100) || `Teammate ${row.id.slice(-4).toUpperCase()}`,
  })), true).sort((a, b) => a.name.localeCompare(b.name))
}

async function attachTeamResultPlayers(service: SupabaseClient, room: ReviewedTeamRoom, owner: string, entries: TeamResultEntry[], canEdit: boolean) {
  const byFixture = new Map(entries.filter(entry => entry.score?.courtScores?.length).map(entry => [entry.fixtureId, entry.score!]))
  if (!byFixture.size) return
  const { data, error } = await service.rpc('read_native_team_result_players', { p_room: room.roomId, p_fixtures: [...byFixture.keys()] })
  if (error || !Array.isArray(data) || data.length > 1200) throw Error('Team result players unavailable')
  for (const row of data) {
    const score = byFixture.get(row.fixture_id)
    if (!score?.courtScores || score.revision !== row.result_revision) continue
    const index = row.court_number - 1
    if (!Number.isInteger(index) || index < 0 || index >= score.courtScores.length) throw Error('Invalid result court')
    const [player] = readTeamResultPlayers([{ name: row.name, ...(canEdit ? { id: row.profile_id } : {}) }], canEdit)
    score.courtPlayers ??= score.courtScores.map(() => [])
    score.courtPlayers[index].push(player)
    if (row.profile_id === owner) score.myCourt = row.court_number
  }
}

export async function loadTeamResults(service: SupabaseClient, room: ReviewedTeamRoom, owner: string, canEdit: boolean): Promise<TeamResults> {
  const { data, error } = await service.rpc('read_native_team_results', { p_room: room.roomId, p_can_edit: canEdit })
  const rows: unknown = data?.entries
  if (error || !Array.isArray(rows) || rows.length > 21) throw Error('Team results unavailable')
  const record = readTeamRecord(data.record)
  const entries = rows.map(readTeamResultEntry)
  if (canEdit && data.current) {
    const current = readTeamResultEntry(data.current)
    if (teamMatchHasStarted(current.match) && !entries.some(entry => entry.fixtureId === current.fixtureId)) entries.push(current)
  }
  entries.sort((a, b) => b.match.date.localeCompare(a.match.date) || a.fixtureId.localeCompare(b.fixtureId))
  const visible = entries.slice(0, 20)
  await attachTeamResultPlayers(service, room, owner, visible, canEdit)
  return { canEdit, entries: visible, more: entries.length > 20, record }
}

export async function loadPrivateTeamScorecards(service: SupabaseClient, owner: string, now = new Date()): Promise<TeamCourtScorecard[]> {
  const links = await loadReviewedTeamLinks(service, owner, readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS))
  const roomIds = await loadActiveReviewedTeamRoomIds(service, owner, links.filter(room => !room.scheduleLeagueId))
  if (!roomIds.length) return []

  const { data, error } = await service.from('native_team_fixture_history')
    .select(`room_id,fixture_id,fixture,match_date,result_revision,court_scores,
      own:native_team_result_players!inner(profile_id,result_revision,court_number),
      seats:native_team_result_players(result_revision,court_number)`)
    .in('room_id', roomIds).eq('own.profile_id', owner)
    .order('match_date', { ascending: false }).order('fixture_id').order('room_id').limit(teamScorecardLimit)
  if (error || !Array.isArray(data) || data.length > teamScorecardLimit) throw Error('Team court scores unavailable')

  return data.flatMap(row => {
    const own = Array.isArray(row.own) && row.own.length === 1 ? row.own[0] : undefined
    if (!roomIds.includes(row.room_id) || !fixtureId(row.fixture_id) || !fixtureId(row.result_revision) ||
        own?.profile_id !== owner || own.result_revision !== row.result_revision) return []
    const match = readReviewedNextMatch(row.fixture)
    const court = Array.isArray(row.court_scores) ? readTeamCourtScore(row.court_scores[own.court_number - 1]) : null
    if (!court || court.defaulted || !match || match.date !== row.match_date || !teamMatchHasStarted(match, now)) return []
    const seats = (row.seats ?? []).filter(seat => seat.result_revision === row.result_revision && seat.court_number === own.court_number)
    const card = teamCourtScorecard(row.room_id, { fixtureId: row.fixture_id, match }, own.court_number, court, seats.length)
    return card ? [card] : []
  })
}

export async function saveTeamResult(service: SupabaseClient, room: ReviewedTeamRoom, owner: string, change: TeamResultChange) {
  const current = change.expected === null ? await loadManualTeamFixture(service, room) : null
  const allowCurrent = current?.revision === change.fixtureId && current.match && teamMatchHasStarted(current.match)
  const { data, error } = await service.rpc('save_native_team_result_with_players', {
    p_owner: owner, p_room: room.roomId, p_team: room.teamName, p_league: room.leagueName, p_flight: room.flight,
    p_fixture: change.fixtureId, p_expected: change.expected, p_revision: change.revision,
    p_won: change.won, p_lost: change.lost, p_allow_current: Boolean(allowCurrent), p_court_scores: change.courtScores ?? null,
    p_court_players: change.courtPlayerIds ?? null,
  }).retry(false)
  if (error || ![200, 400, 403, 409].includes(data)) throw Error('Result could not be confirmed')
  return data as 200 | 400 | 403 | 409
}
