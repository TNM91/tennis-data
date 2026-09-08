import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { loadSeasonFixtures, loadSeasonRoster, loadSeasonSelf, readSeasonScope, seasonPrivateHeaders } from '@/lib/season-kickoff-server'
import { normalizeTeamRoomKey } from '@/lib/team-room'

export const runtime = 'nodejs'
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: seasonPrivateHeaders })

export async function GET(request: Request) {
  try {
    // Replying through a group invitation requires sign-in, not a paid Captain subscription.
    const auth = await getSignedInPlayerApiAuth(request)
    if (!auth.ok) return json({ message: 'Sign in to open your own availability.' }, 401)
    let scope
    const params = new URL(request.url).searchParams
    try { scope = readSeasonScope(params) } catch { return json({ message: 'This team link is incomplete. Ask your captain for the full group message.' }, 400) }
    const service = getCaptainAvailabilityServiceClient()
    const { data: links, error: linkError } = await service.from('team_profile_links').select('league_name,flight')
      .eq('profile_user_id', auth.userId).eq('normalized_team_name', normalizeTeamRoomKey(scope.team)).eq('status', 'accepted')
    if (linkError) throw new Error('Access unavailable')
    if (!(links || []).some(link => normalizeTeamRoomKey(link.league_name) === normalizeTeamRoomKey(scope.league)
      && normalizeTeamRoomKey(link.flight) === normalizeTeamRoomKey(scope.flight))) {
      return json({ message: 'Connect this team to your account first, then return to this group link.', action: 'team' }, 403)
    }
    const self = await loadSeasonSelf(service, auth.userId, await loadSeasonRoster(service, scope))
    if (!self?.playerId) return json({ message: 'Link your own player record in Profile. It must be on this season’s roster.', action: 'profile' }, 403)
    // Query only this authenticated player's invitation. Never return the roster or other players' tokens.
    const { data: invite, error } = await service.from('season_availability_invites').select('response_token,revoked_at,match_ids')
      .eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).eq('season_key', scope.seasonKey)
      .eq('roster_key', self.key).eq('player_id', self.playerId).maybeSingle()
    if (error) throw new Error('Invitation unavailable')
    if (!invite || invite.revoked_at) return json({ message: 'Your season invitation is not active. Ask your captain to prepare or reopen your personal invitation.' }, 404)
    const matches = await loadSeasonFixtures(service, scope)
    const focus = params.get('match') || ''
    if (focus && (!matches.some(match => match.id === focus) || !invite.match_ids.includes(focus))) {
      return json({ message: 'That match is no longer in your season invitation. Ask your captain for an updated request.' }, 409)
    }
    return json({ responseToken: invite.response_token, focusMatchId: focus })
  } catch { return json({ message: 'Your team availability could not be opened. Please retry.' }, 503) }
}
