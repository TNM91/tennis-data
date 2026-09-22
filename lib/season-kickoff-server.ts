import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canManageTeamRoom, normalizeTeamRoomKey } from './team-room'
import { normalizeTeamName } from './captain-formatters'
import { currentSeasonReplies, seasonFixtures, type SeasonInvite, type SeasonPlayer, type SeasonReply, type SeasonScope, type SeasonLineupAnswer } from './season-kickoff'
import type { TeamSeasonMatch } from './team-season-calendar'
import { isUuid } from './captain-availability-request-server'

export const seasonPrivateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' }
export function seasonToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function readSeasonScope(params: URLSearchParams): SeasonScope {
  const scope = { team: params.get('team')?.trim() || '', league: params.get('league')?.trim() || '', flight: params.get('flight')?.trim() || '', seasonKey: params.get('seasonKey') || '' }
  if (!scope.team || !scope.league || !scope.seasonKey || Object.values(scope).some(value => value.length > 500)) throw new Error('Choose a team and season.')
  return scope
}
export async function authorizeSeason(service: SupabaseClient, userId: string, scope: SeasonScope) {
  const { data, error } = await service.from('team_profile_links').select('league_name,flight,team_role,team_roles')
    .eq('profile_user_id', userId).eq('normalized_team_name', normalizeTeamRoomKey(scope.team)).eq('status', 'accepted')
  if (error) throw new Error('Team access could not be checked. Please retry.')
  return (data || []).some(link => normalizeTeamRoomKey(link.league_name) === normalizeTeamRoomKey(scope.league)
    && normalizeTeamRoomKey(link.flight) === normalizeTeamRoomKey(scope.flight)
    && canManageTeamRoom(Array.isArray(link.team_roles) && link.team_roles.length ? link.team_roles : [link.team_role]))
}
export async function loadSeasonFixtures(service: SupabaseClient, scope: SeasonScope) {
  const escaped = scope.team.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const { data, error } = await service.from('matches')
    .select('id,external_match_id,home_team,away_team,league_name,flight,match_date,match_time,facility,line_number,match_type,status')
    .eq('league_name', scope.league).eq('flight', scope.flight).is('line_number', null)
    .or(`home_team.eq."${escaped}",away_team.eq."${escaped}"`).order('match_date').order('id').limit(251)
  if (error || (data?.length || 0) > 250) throw new Error('The complete team schedule could not be loaded. Please retry before inviting players.')
  return seasonFixtures(scope, data || [])
}
export async function loadSeasonRoster(service: SupabaseClient, scope: SeasonScope): Promise<SeasonPlayer[]> {
  const { data, error } = await service.from('team_roster_members').select('id,player_id,player_name')
    .eq('normalized_team_name', normalizeTeamName(scope.team)).eq('league_name', scope.league).eq('flight', scope.flight).limit(251)
  if (error || (data?.length || 0) > 250) throw new Error('Your season roster could not be loaded. Please retry.')
  return [...new Map((data || []).filter(row => row.player_name).map(row => [row.player_id || row.id,
    { key: String(row.player_id || row.id), playerId: row.player_id, name: String(row.player_name) }])).values()].sort((a, b) => a.name.localeCompare(b.name))
}
export async function loadSeasonInvites(service: SupabaseClient, scope: SeasonScope) {
  const { data, error } = await service.from('season_availability_invites').select('id,roster_key,player_id,player_name,response_token,revoked_at,match_ids')
    .eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).eq('season_key', scope.seasonKey)
  if (error) throw new Error('Season invitations are unavailable. Please try again shortly.')
  return (data || []) as SeasonInvite[]
}
export async function loadSeasonSelf(service: SupabaseClient, userId: string, roster: SeasonPlayer[]) {
  const { data, error } = await service.from('profiles').select('linked_player_id').eq('id', userId).maybeSingle()
  if (error) throw new Error('Your linked player record could not be checked. Please retry.')
  return roster.find(player => player.playerId && player.playerId === data?.linked_player_id) || null
}
export async function loadSeasonResponses(service: SupabaseClient, ids: string[]) {
  if (!ids.length) return []
  const rows: SeasonReply[] = []
  for (let offset = 0; offset <= 15000; offset += 500) {
    const { data, error } = await service.from('season_availability_responses').select('invite_id,match_id,status,match_date,match_time,responded_at')
      .in('invite_id', ids).order('invite_id').order('match_id').range(offset, offset + 499)
    if (error) throw new Error('Replies could not be loaded. Please retry.')
    rows.push(...(data || []) as SeasonReply[])
    if ((data?.length || 0) < 500) return rows
  }
  throw new Error('The full reply list could not be loaded. Please retry.')
}

export async function loadSeasonLineupAnswers(service: SupabaseClient, userId: string, scope: SeasonScope, matches: TeamSeasonMatch[]): Promise<SeasonLineupAnswer[]> {
  if (!scope.league || !await authorizeSeason(service, userId, scope)) return []
  const { data, error } = await service.from('season_availability_invites').select('id,player_id,match_ids')
    .eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).is('revoked_at', null)
  if (error) throw new Error('Season availability could not be loaded. Please retry before choosing players.')
  const invites = new Map((data || []).map(row => [row.id, row]))
  const scopedMatches = matches.filter(match => match.league_name === scope.league && (match.flight || '') === scope.flight)
  return currentSeasonReplies(scopedMatches, await loadSeasonResponses(service, [...invites.keys()])).flatMap(reply => {
    const invite = invites.get(reply.invite_id || '')
    if (!invite?.player_id || !invite.match_ids.includes(reply.match_id)) return []
    return [{ id: `season:${invite.id}:${reply.match_id}`, match_id: reply.match_id, player_id: invite.player_id,
      match_date: reply.match_date, team_name: scope.team, league_name: scope.league, flight: scope.flight,
      status: reply.status === 'available' ? 'season-available' : reply.status,
      notes: 'Season availability. Confirm the selected lineup separately.', responded_at: reply.responded_at }]
  })
}
export async function loadSeasonRecipient(service: SupabaseClient, token: string, calendarOnly = false) {
  if (!isUuid(token)) return null
  const { data, error } = await service.from('season_availability_invites').select('id,player_name,team_name,league_name,flight,season_key,match_ids,revoked_at,calendar_token')
    .eq(calendarOnly ? 'calendar_token' : 'response_token', token).maybeSingle()
  if (error) throw new Error('This season link could not be opened. Please retry.')
  if (!data || data.revoked_at) return null
  const scope = { team: data.team_name, league: data.league_name, flight: data.flight, seasonKey: data.season_key }
  const matches = (await loadSeasonFixtures(service, scope)).filter(match => data.match_ids.includes(match.id))
  const replies = calendarOnly ? [] : currentSeasonReplies(matches, await loadSeasonResponses(service, [data.id]))
  return { scope, playerName: calendarOnly ? '' : data.player_name, matches, replies, today: seasonToday(), calendarToken: data.calendar_token }
}
