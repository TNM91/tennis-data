import type { SupabaseClient } from '@supabase/supabase-js'
import { loadEligibleTeamRoster } from './first-party-team-replies'
import type { ReviewedTeamRoom } from './first-party-team-scopes'
import { loadManualTeamFixture, teamMatchHasStarted } from './first-party-team-schedule'
import { readTeamRecord, readTeamResultEntry, readTeamResultPlayers, type TeamResultChange, type TeamResultEntry, type TeamResults } from './team-results-contract'

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
