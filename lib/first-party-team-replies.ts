import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReviewedTeamRoom } from './first-party-team-scopes'
import { fixtureId } from './team-fixtures-contract'
import { isTeamMatchChoice, type TeamLineupPlayer, type TeamMatchReplyChange, type TeamMatchReplies } from './team-match-replies-contract'

const rosterLimit = 100

export async function loadEligibleTeamRoster(service: SupabaseClient, room: ReviewedTeamRoom, owner: string) {
  const participants = await service.from('internal_conversation_participants').select('profile_id')
    .eq('conversation_id', room.roomId).order('profile_id').limit(rosterLimit + 1)
  if (participants.error || !Array.isArray(participants.data) ||
      participants.data.some(row => !fixtureId(row.profile_id))) throw Error('Roster unavailable')
  const rosterComplete = participants.data.length <= rosterLimit
  const roomIds = [...new Set<string>([...(rosterComplete ? [] : [owner]), ...participants.data.map(row => row.profile_id)])]
  const ids = roomIds.slice(0, rosterLimit)
  if (!ids.length) return { ids, rosterComplete }
  const [members, removals] = await Promise.all([
    service.from('team_profile_links').select('profile_user_id').eq('team_name', room.teamName)
      .eq('league_name', room.leagueName).eq('flight', room.flight).eq('status', 'accepted').is('archived_at', null)
      .in('source_type', ['manual_invite', 'tiq_entry']).in('profile_user_id', ids).limit(rosterLimit + 1),
    service.from('team_room_member_removals').select('profile_id').eq('conversation_id', room.roomId).in('profile_id', ids).limit(rosterLimit + 1),
  ])
  if (members.error || removals.error || !Array.isArray(members.data) || !Array.isArray(removals.data)) throw Error('Roster unavailable')
  const eligible = new Set(members.data.map(row => row.profile_user_id))
  for (const removal of removals.data) eligible.delete(removal.profile_id)
  return { ids: ids.filter(id => eligible.has(id)), rosterComplete }
}

export async function loadTeamMatchReplies(service: SupabaseClient, room: ReviewedTeamRoom, owner: string, revision: string, captain: boolean): Promise<TeamMatchReplies> {
  const roster = captain ? await loadEligibleTeamRoster(service, room, owner) : null
  if (roster && !roster.ids.length) return { own: null, team: [], awaiting: [], awaitingTeammates: 0, rosterComplete: roster.rosterComplete, lineupRoster: [] }

  const query = service.from('native_team_fixture_replies').select('profile_id,operation_id,choice')
    .eq('room_id', room.roomId).eq('fixture_revision', revision)
  const [replyResult, profiles] = await Promise.all([
    roster ? query.in('profile_id', roster.ids).limit(rosterLimit) : query.eq('profile_id', owner).limit(1),
    roster ? service.from('profiles').select('id,message_display_name').in('id', roster.ids).limit(rosterLimit) : null,
  ])
  const { data, error } = replyResult
  if (error || !Array.isArray(data) || data.some(row =>
    !fixtureId(row.profile_id) || !fixtureId(row.operation_id) || !isTeamMatchChoice(row.choice))) throw Error('Availability unavailable')
  const byProfile = new Map(data.map(row => [row.profile_id, row]))
  const own = byProfile.get(owner)
  const result: TeamMatchReplies = { own: own ? { id: own.operation_id, choice: own.choice } : null }
  if (!roster) return result
  if (!profiles || profiles.error || !Array.isArray(profiles.data)) throw Error('Team names unavailable')

  const names = new Map(profiles.data.map(row => [row.id, row.message_display_name?.replace(/\p{Cc}/gu, '').trim().slice(0, 100)]))
  const team: NonNullable<TeamMatchReplies['team']> = [], awaiting: string[] = [], lineupRoster: TeamLineupPlayer[] = []
  let awaitingTeammates = 0
  for (const id of roster.ids) {
    const displayName = names.get(id) || 'Teammate ' + id.slice(-4).toUpperCase()
    const name = id === owner ? 'You' : displayName
    const reply = byProfile.get(id)
    lineupRoster.push({ id, name: displayName, choice: reply?.choice ?? null })
    if (reply) team.push({ name, choice: reply.choice })
    else {
      awaiting.push(name)
      if (id !== owner) awaitingTeammates++
    }
  }
  return {
    ...result,
    team: team.sort((a, b) => a.name.localeCompare(b.name)),
    awaiting: awaiting.sort((a, b) => a.localeCompare(b)),
    awaitingTeammates,
    rosterComplete: roster.rosterComplete,
    lineupRoster,
  }
}

export async function saveTeamMatchReply(service: SupabaseClient, room: ReviewedTeamRoom, owner: string, change: TeamMatchReplyChange) {
  const { data, error } = await service.rpc('reply_to_native_team_fixture', {
    p_owner: owner, p_room: room.roomId, p_team: room.teamName, p_league: room.leagueName, p_flight: room.flight,
    p_revision: change.revision, p_expected: change.expected, p_operation: change.id, p_choice: change.choice,
  }).retry(false)
  if (error || ![200, 400, 403, 409].includes(data)) throw Error('Reply could not be confirmed')
  return data as 200 | 400 | 403 | 409
}
