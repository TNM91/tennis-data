import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReviewedTeamRoom } from './first-party-team-scopes'
import { loadManualTeamFixture, teamMatchHasStarted } from './first-party-team-schedule'
import { readTeamRecord, readTeamResultEntry, type TeamResultChange, type TeamResults } from './team-results-contract'

export async function loadTeamResults(service: SupabaseClient, room: ReviewedTeamRoom, canEdit: boolean): Promise<TeamResults> {
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
  return { canEdit, entries: entries.slice(0, 20), more: entries.length > 20, record }
}

export async function saveTeamResult(service: SupabaseClient, room: ReviewedTeamRoom, owner: string, change: TeamResultChange) {
  const current = change.expected === null ? await loadManualTeamFixture(service, room) : null
  const allowCurrent = current?.revision === change.fixtureId && current.match && teamMatchHasStarted(current.match)
  const { data, error } = await service.rpc('save_native_team_result', {
    p_owner: owner, p_room: room.roomId, p_team: room.teamName, p_league: room.leagueName, p_flight: room.flight,
    p_fixture: change.fixtureId, p_expected: change.expected, p_revision: change.revision,
    p_won: change.won, p_lost: change.lost, p_allow_current: Boolean(allowCurrent), p_court_scores: change.courtScores ?? null,
  }).retry(false)
  if (error || ![200, 400, 403, 409].includes(data)) throw Error('Result could not be confirmed')
  return data as 200 | 400 | 403 | 409
}
